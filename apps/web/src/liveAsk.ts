// Ask a question (Q10, R1.4): one tap (or one earbud press) and just ask aloud — it sends when you pause (EndOfSpeech);
// tapping again sends at once; 10 s is the cap. "What's around me" sends the frame with a fixed question. Sends the current blurred frame
// and 16 kHz PCM from the microphone over /api/live; the text answer goes to the caller, which must pass it to
// AlertOutput.sayModelText (safety filter, P3, preemptible). The microphone is on only while asking (PRI-05); nothing is
// recorded or stored.
import { LIVE_SAMPLE_RATE, MAX_QUESTION_MS, type LiveServerMessage } from '@footprint/shared';
import { EndOfSpeech, rms } from './endOfSpeech';

/** `starting`: tapped, microphone and connection being prepared (shown at once — owner test: "can't tell if I pressed it"). */
export type AskState = 'idle' | 'starting' | 'listening' | 'thinking';

export interface LiveAskOptions {
  /** The user's language (R3.2): the Gemini session is opened in it. */
  language?: () => string;
  /** Blurred JPEG of the current view (FaceBlurrer.getUploadJpeg), or null (then the question is sent without a frame). */
  frame: () => Promise<Blob | null>;
  /** Model answer text — route to sayModelText. `question` = the user's own words (for voice commands). */
  /** `spoken`: the answer is to a spoken question (Ask), not "What's around me" — only then can it be a command. */
  onAnswer: (text: string, question: string | undefined, spoken: boolean) => void;
  /** Fixed-wording problems (fail loud). */
  onProblem: (text: string) => void;
  onState: (s: AskState) => void;
}

export const ASK_MESSAGES = {
  micDenied: 'Microphone permission was denied. Questions are off. Obstacle alerts still work.',
  unavailable: 'Questions are unavailable right now. Obstacle alerts still work.',
  busy: 'Still answering the last question.',
  tooMany: 'Too many questions. Try again in a minute.',
  didntHear: "I didn't hear a question.",
  noView: 'No camera view to describe yet.',
} as const;

/** AudioWorklet that forwards mono Float32 frames to the main thread. Inline so no extra file is served. */
const WORKLET = `class P extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor('fp-mic',P)`;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Float32 [-1, 1] → little-endian PCM16. */
export function floatToPcm16(f: Float32Array): Uint8Array {
  const out = new Uint8Array(f.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(-1, Math.min(1, f[i]!));
    view.setInt16(i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return out;
}

export class LiveAsk {
  private ws: WebSocket | null = null;
  private state: AskState = 'idle';
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private pending: Uint8Array[] = [];
  private stopTimer: number | undefined;
  /** The question in flight was spoken (Ask), not "What's around me". */
  private spoken = false;
  private reconnectWhenIdle = false;

  constructor(private readonly opts: LiveAskOptions) {}

  get current(): AskState {
    return this.state;
  }

  /** The Ask button: idle → listening → (send) thinking → idle. */
  async toggle(): Promise<void> {
    if (this.state === 'starting') return; // a second tap while the mic opens must not start a second question
    if (this.state === 'listening') return this.finish();
    if (this.state === 'thinking') return this.opts.onProblem(ASK_MESSAGES.busy);
    await this.startListening();
  }

  /** "What's around me": describe the current view, no speaking needed. */
  async describe(): Promise<void> {
    if (this.state !== 'idle') return this.opts.onProblem(ASK_MESSAGES.busy);
    const blob = await this.opts.frame().catch(() => null);
    if (!blob) return this.opts.onProblem(ASK_MESSAGES.noView);
    let ws: WebSocket;
    try {
      ws = await this.connect();
    } catch {
      return this.opts.onProblem(ASK_MESSAGES.unavailable);
    }
    this.spoken = false;
    ws.send(JSON.stringify({ type: 'describe', frame: toBase64(new Uint8Array(await blob.arrayBuffer())) }));
    this.setState('thinking');
  }

  /** Walk started: connect now, so the server opens the Gemini session before the first question (≈ 2 s faster). */
  warm(): void {
    this.connect().catch(() => undefined); // a failure is reported when the user actually asks
  }

  /** Language changed: open a new Gemini session in it (now if idle, else after the current question). */
  relanguage(): void {
    const ws = this.ws;
    if (!ws) return;
    if (this.state !== 'idle') {
      this.reconnectWhenIdle = true;
      return;
    }
    this.ws = null;
    ws.close();
    this.warm();
  }

  /** Walk stopped. */
  stop(): void {
    this.releaseMic();
    void this.ctx?.close(); // walk over: free the audio engine too
    this.ctx = null;
    this.ws?.close();
    this.ws = null;
    this.setState('idle');
  }

  private setState(s: AskState): void {
    this.state = s;
    this.opts.onState(s);
    if (s === 'idle' && this.reconnectWhenIdle) {
      this.reconnectWhenIdle = false;
      queueMicrotask(() => this.relanguage());
    }
  }

  private async connect(): Promise<WebSocket> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return this.ws;
    const lang = encodeURIComponent(this.opts.language?.() ?? 'en-IN');
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/live?lang=${lang}`);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), { once: true });
      ws.addEventListener('error', () => reject(new Error('live socket')), { once: true });
      setTimeout(() => reject(new Error('live socket timeout')), 8000);
    });
    ws.addEventListener('message', (e) => this.onServer(JSON.parse(String(e.data)) as LiveServerMessage));
    ws.addEventListener('close', () => {
      if (this.ws === ws) this.ws = null;
      if (this.state === 'thinking') {
        this.setState('idle');
        this.opts.onProblem(ASK_MESSAGES.unavailable);
      }
    });
    this.ws = ws;
    return ws;
  }

  private async startListening(): Promise<void> {
    this.spoken = true;
    this.setState('starting');
    // Mic, connection, photo and audio engine in parallel (they used to run one after another — a slow, silent start).
    const [mic, conn, blob] = await Promise.allSettled([
      navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }),
      this.connect(),
      this.opts.frame().catch(() => null),
      this.audioEngine(),
    ]);
    if (mic.status === 'rejected') {
      this.setState('idle');
      return this.opts.onProblem(ASK_MESSAGES.micDenied);
    }
    this.stream = mic.value;
    if (conn.status === 'rejected' || !this.ctx || this.state !== 'starting') {
      this.releaseMic();
      this.setState('idle');
      if (conn.status === 'rejected' || !this.ctx) this.opts.onProblem(ASK_MESSAGES.unavailable);
      return;
    }
    const ws = conn.value;
    const photo = blob.status === 'fulfilled' ? blob.value : null;
    const frame = photo ? toBase64(new Uint8Array(await photo.arrayBuffer())) : undefined;
    ws.send(JSON.stringify({ type: 'ask', ...(frame ? { frame } : {}) }));
    void this.ctx.resume();
    const node = new AudioWorkletNode(this.ctx, 'fp-mic');
    this.node = node;
    const eos = new EndOfSpeech();
    node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (this.state !== 'listening') return;
      const s = eos.feed(rms(e.data), (e.data.length / LIVE_SAMPLE_RATE) * 1000);
      if (s === 'done') return void this.finish(); // the user paused: send without a second tap
      if (s === 'no_speech') return this.cancelListening();
      this.pending.push(floatToPcm16(e.data));
      const size = this.pending.reduce((n, b) => n + b.length, 0);
      if (size >= 3200 && this.ws?.readyState === WebSocket.OPEN) {
        const chunk = new Uint8Array(size);
        let o = 0;
        for (const b of this.pending) (chunk.set(b, o), (o += b.length));
        this.pending = [];
        this.ws.send(JSON.stringify({ type: 'audio', data: toBase64(chunk) }));
      }
    };
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.source.connect(node);
    this.setState('listening');
    this.stopTimer = window.setTimeout(() => void this.finish(), MAX_QUESTION_MS);
  }

  private async finish(): Promise<void> {
    if (this.state !== 'listening') return;
    window.clearTimeout(this.stopTimer);
    this.releaseMic();
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.setState('idle');
      return this.opts.onProblem(ASK_MESSAGES.unavailable);
    }
    this.ws.send(JSON.stringify({ type: 'end' }));
    this.setState('thinking');
  }

  /** Nothing was said: drop the question quietly on the server, tell the user. */
  private cancelListening(): void {
    this.releaseMic();
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'cancel' }));
    this.setState('idle');
    this.opts.onProblem(ASK_MESSAGES.didntHear);
  }

  private releaseMic(): void {
    window.clearTimeout(this.stopTimer);
    this.stream?.getTracks().forEach((t) => t.stop()); // the microphone is off between questions (PRI-05)
    this.stream = null;
    this.source?.disconnect();
    this.source = null;
    if (this.node) this.node.port.onmessage = null;
    this.node?.disconnect();
    this.node = null;
    void this.ctx?.suspend(); // kept (not closed): the next question starts faster
    this.pending = [];
  }

  /** One 16 kHz AudioContext with the capture worklet loaded, reused for every question. */
  private async audioEngine(): Promise<void> {
    if (this.ctx && this.ctx.state !== 'closed') return;
    const ctx = new AudioContext({ sampleRate: LIVE_SAMPLE_RATE }); // browser resamples the mic to 16 kHz
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
    this.ctx = ctx;
  }

  private onServer(m: LiveServerMessage): void {
    if (m.type === 'answer') {
      this.setState('idle');
      this.opts.onAnswer(m.text, m.question, this.spoken);
    } else if (m.type === 'error') {
      if (this.state === 'listening') this.releaseMic();
      this.setState('idle');
      this.opts.onProblem(m.code === 'rate_limited' || m.code === 'daily_cap' ? ASK_MESSAGES.tooMany : m.code === 'busy' ? ASK_MESSAGES.busy : ASK_MESSAGES.unavailable);
    }
  }
}
