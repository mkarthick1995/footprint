// /api/live (R1.4, ADR-030): WebSocket proxy between the phone and Vertex Gemini Live. One Live session per walk
// (per WebSocket), opened on the first question, with context-window compression and session resumption. Push-to-talk:
// activityStart → blurred frame → PCM audio → activityEnd. Only the model's output transcript is sent back; its audio
// is discarded (SAF-21). Nothing is logged except event codes (PRI-05/PRI-10).
import { GoogleGenAI, Modality } from '@google/genai';
import type { FastifyInstance } from 'fastify';
import {
  ANSWER_TIMEOUT_MS,
  base64Bytes,
  DESCRIBE_PROMPT,
  LIVE_SAMPLE_RATE,
  LIVE_SYSTEM_INSTRUCTION,
  MAX_QUESTION_AUDIO_BYTES,
  parseLiveClientMessage,
  type LiveServerMessage,
} from '@footprint/shared';
import { MinuteLimiter } from './limits.js';

/** After turnComplete, transcript pieces (the answer's tail and the user's own words) may still arrive: collect this long. */
const QUESTION_GRACE_MS = 700;

/** The parts of a Live session we use. */
export interface LiveSessionLike {
  sendRealtimeInput(input: Record<string, unknown>): void;
  sendClientContent(content: Record<string, unknown>): void;
  close(): void;
}

/** A Live server message, reduced to what we use. */
export interface LiveEvent {
  transcript?: string;
  /** The user's own words (input transcription). */
  question?: string;
  turnComplete?: boolean;
  resumeHandle?: string;
  goAway?: boolean;
  closed?: boolean;
  error?: string;
}

export type LiveConnector = (opts: { resumeHandle?: string; onEvent: (e: LiveEvent) => void }) => Promise<LiveSessionLike>;

/** Vertex Live connector (us-central1 native-audio model; AUDIO + output transcription — TEXT is rejected, FACTS.md). */
export function vertexLiveConnector(env: NodeJS.ProcessEnv = process.env): LiveConnector {
  const ai = new GoogleGenAI({ vertexai: true, project: env.GOOGLE_CLOUD_PROJECT, location: env.GEMINI_LIVE_LOCATION || 'us-central1' });
  const model = env.GEMINI_LIVE_MODEL || 'gemini-live-2.5-flash-native-audio';
  return async ({ resumeHandle, onEvent }) => {
    // Input sent before the server's setupComplete is dropped (live test: the first question timed out), so the
    // session is handed out only once setup is acknowledged.
    let ready: () => void = () => {};
    const setupDone = new Promise<void>((resolve, reject) => {
      ready = resolve;
      setTimeout(() => reject(new Error('live setup timeout')), 10_000);
    });
    const session = await ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        inputAudioTranscription: {}, // the user's words, for voice commands (Q14)
        systemInstruction: LIVE_SYSTEM_INSTRUCTION,
        realtimeInputConfig: { automaticActivityDetection: { disabled: true } }, // push-to-talk
        contextWindowCompression: { slidingWindow: {} },
        sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
      },
      callbacks: {
        onmessage: (m) => {
          if (m.setupComplete) ready();
          const sc = m.serverContent;
          if (sc?.outputTranscription?.text) onEvent({ transcript: sc.outputTranscription.text });
          if (sc?.inputTranscription?.text) onEvent({ question: sc.inputTranscription.text });
          if (sc?.turnComplete) onEvent({ turnComplete: true });
          if (m.sessionResumptionUpdate?.resumable && m.sessionResumptionUpdate.newHandle) {
            onEvent({ resumeHandle: m.sessionResumptionUpdate.newHandle });
          }
          if (m.goAway) onEvent({ goAway: true });
        },
        onerror: (e) => onEvent({ error: (e as ErrorEvent)?.message || 'live_error' }),
        onclose: () => onEvent({ closed: true }),
      },
    });
    try {
      await setupDone;
    } catch (err) {
      session.close();
      throw err;
    }
    return session as unknown as LiveSessionLike;
  };
}

export interface LiveOptions {
  connector?: LiveConnector;
  questionsPerMinute?: number;
  /** Max questions over one walk (one WebSocket) — session cap (SEC-02). */
  questionsPerWalk?: number;
  dailyCap?: number;
  now?: () => number;
}

interface Socket {
  send(data: string): void;
  close(): void;
  on(ev: 'message', fn: (data: Buffer | string) => void): void;
  on(ev: 'close', fn: () => void): void;
}

/** One phone connection = one walk = at most one Live session. Exported for tests. */
export class LiveBridge {
  private session: LiveSessionLike | null = null;
  private opening: Promise<LiveSessionLike> | null = null;
  private resumeHandle: string | undefined;
  private stale = false;
  private asking = false;
  private waiting = false;
  private audioBytes = 0;
  /**
   * Audio (and "end") that arrived while the Vertex session was still opening. The first question of a walk used to
   * lose them — a short question like "Fewer alerts" fits entirely in that 1–2 s (test round 1, 2026-10-14).
   */
  private early: string[] = [];
  private earlyEnd = false;
  private answer = '';
  private question = '';
  /** Answer complete, briefly waiting for the user's words to be transcribed (they can arrive after the answer). */
  private finishing: NodeJS.Timeout | undefined;
  private endedAt = 0;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly send: (m: LiveServerMessage) => void,
    private readonly connector: LiveConnector,
    private readonly allowQuestion: () => LiveServerMessage | null,
    private readonly now: () => number,
    private readonly log: (code: string) => void,
  ) {}

  async onMessage(raw: unknown): Promise<void> {
    const msg = parseLiveClientMessage(raw);
    if (!msg) return this.send({ type: 'error', code: 'bad_message' });
    switch (msg.type) {
      case 'ask': {
        if (this.asking || this.waiting || this.finishing) return this.send({ type: 'error', code: 'busy' });
        const refused = this.allowQuestion();
        if (refused) return this.send(refused);
        this.asking = true;
        this.audioBytes = 0;
        this.answer = '';
        this.question = '';
        this.early = [];
        this.earlyEnd = false;
        try {
          const s = await this.ensureSession();
          if (!this.asking) return; // cancelled while the session was opening
          s.sendRealtimeInput({ activityStart: {} });
          if (msg.frame) s.sendRealtimeInput({ video: { data: msg.frame, mimeType: 'image/jpeg' } });
          for (const data of this.early) s.sendRealtimeInput({ audio: { data, mimeType: `audio/pcm;rate=${LIVE_SAMPLE_RATE}` } });
          this.early = [];
          if (this.earlyEnd && this.asking) {
            this.earlyEnd = false;
            this.asking = false;
            s.sendRealtimeInput({ activityEnd: {} });
            this.startWaiting();
          }
        } catch {
          this.early = [];
          this.earlyEnd = false;
          this.asking = false;
          this.log('live_connect_error');
          this.send({ type: 'error', code: 'model_error' });
        }
        return;
      }
      case 'describe': {
        // "What's around me": photo + a fixed question as one complete turn — no microphone involved.
        if (this.asking || this.waiting || this.finishing) return this.send({ type: 'error', code: 'busy' });
        const refused = this.allowQuestion();
        if (refused) return this.send(refused);
        this.answer = '';
        this.question = '';
        try {
          const s = await this.ensureSession();
          s.sendClientContent({
            turns: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: msg.frame } }, { text: DESCRIBE_PROMPT }] }],
            turnComplete: true,
          });
          this.startWaiting();
        } catch {
          this.log('live_connect_error');
          this.send({ type: 'error', code: 'model_error' });
        }
        return;
      }
      case 'audio': {
        if (!this.asking) return;
        this.audioBytes += base64Bytes(msg.data);
        if (this.audioBytes > MAX_QUESTION_AUDIO_BYTES) {
          this.cancel();
          return this.send({ type: 'error', code: 'too_long' });
        }
        if (!this.session) return void this.early.push(msg.data); // session still opening: keep it for the flush
        this.session.sendRealtimeInput({ audio: { data: msg.data, mimeType: `audio/pcm;rate=${LIVE_SAMPLE_RATE}` } });
        return;
      }
      case 'end': {
        if (!this.asking) return;
        if (!this.session) return void (this.earlyEnd = true); // sent with the flush once the session is open
        this.asking = false;
        this.session.sendRealtimeInput({ activityEnd: {} });
        this.startWaiting();
        return;
      }
      case 'cancel':
        this.cancel();
    }
  }

  private deliver(): void {
    clearTimeout(this.finishing);
    this.finishing = undefined;
    const text = this.answer.replace(/\s+/g, ' ').trim();
    const question = this.question.replace(/\s+/g, ' ').trim();
    this.answer = '';
    this.question = '';
    if (!text) return this.send({ type: 'error', code: 'model_error' });
    this.send({ type: 'answer', text, ms: this.now() - this.endedAt, ...(question ? { question } : {}) });
  }

  private startWaiting(): void {
    this.waiting = true;
    this.endedAt = this.now();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.waiting) return;
      this.waiting = false;
      this.log('live_timeout');
      this.send({ type: 'error', code: 'timeout' });
    }, ANSWER_TIMEOUT_MS);
  }

  /** Open the Vertex session ahead of the first question (it takes 1–2 s), so that question isn't slower. */
  warm(): void {
    this.ensureSession().catch(() => this.log('live_connect_error'));
  }

  close(): void {
    clearTimeout(this.timer);
    this.session?.close();
    this.session = null;
  }

  private cancel(): void {
    this.early = [];
    this.earlyEnd = false;
    if (this.asking && this.session) this.session.sendRealtimeInput({ activityEnd: {} });
    this.asking = false;
    this.waiting = false;
    this.answer = '';
    clearTimeout(this.timer);
  }

  private async ensureSession(): Promise<LiveSessionLike> {
    if (this.session && !this.stale) return this.session;
    if (this.session && this.stale) {
      // GoAway received: reconnect with the resumption handle (context kept) before the server drops us.
      this.session.close();
      this.session = null;
    }
    this.opening ??= this.connector({ resumeHandle: this.resumeHandle, onEvent: (e) => this.onEvent(e) }).finally(() => {
      this.opening = null;
    });
    this.session = await this.opening;
    this.stale = false;
    return this.session;
  }

  private onEvent(e: LiveEvent): void {
    if (e.resumeHandle) this.resumeHandle = e.resumeHandle;
    if (e.goAway) this.stale = true;
    // Transcript pieces can trail the turnComplete signal (live test: an answer's tail leaked into the next one), so
    // pieces are collected until the grace window closes; anything later is discarded.
    if (e.transcript && (this.waiting || this.finishing)) this.answer += e.transcript;
    if (e.question && (this.asking || this.waiting || this.finishing)) this.question += e.question;
    if (e.turnComplete && this.waiting) {
      this.waiting = false;
      clearTimeout(this.timer);
      this.finishing = setTimeout(() => this.deliver(), QUESTION_GRACE_MS);
    }
    if (e.closed || e.error) {
      if (e.error) this.log('live_session_error');
      this.session = null; // reopen (with the resumption handle) on the next question
      if (this.waiting) {
        this.waiting = false;
        clearTimeout(this.timer);
        this.send({ type: 'error', code: 'model_error' });
      }
    }
  }
}

export async function registerLive(app: FastifyInstance, opts: LiveOptions = {}): Promise<void> {
  const now = opts.now ?? Date.now;
  const dailyCap = opts.dailyCap ?? Number(process.env.LIVE_DAILY_CAP || 1000);
  let connector = opts.connector;
  let day = '';
  let today = 0;
  await app.register((await import('@fastify/websocket')).default, { options: { maxPayload: 600_000 } });
  app.get('/api/live', { websocket: true }, (socket: Socket, req) => {
    const perMinute = new MinuteLimiter(opts.questionsPerMinute ?? 8);
    let asked = 0;
    const perWalk = opts.questionsPerWalk ?? 120;
    connector ??= vertexLiveConnector();
    const bridge = new LiveBridge(
      (m) => socket.send(JSON.stringify(m)),
      connector,
      () => {
        const t = now();
        const d = new Date(t).toISOString().slice(0, 10);
        if (d !== day) ((day = d), (today = 0));
        if (today >= dailyCap) return { type: 'error', code: 'daily_cap' };
        if (!perMinute.allow('q', t) || asked >= perWalk) return { type: 'error', code: 'rate_limited' };
        asked++;
        today++;
        return null;
      },
      now,
      (code) => req.log.warn({ code }, 'live event'),
    );
    socket.on('message', (data) => void bridge.onMessage(typeof data === 'string' ? data : data.toString('utf8')));
    socket.on('close', () => bridge.close());
    socket.send(JSON.stringify({ type: 'ready' } satisfies LiveServerMessage));
    bridge.warm();
  });
}
