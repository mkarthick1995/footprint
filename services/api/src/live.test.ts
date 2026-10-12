import { describe, expect, it, vi } from 'vitest';
import { parseLiveClientMessage, type LiveServerMessage } from '@footprint/shared';
import { LiveBridge, type LiveConnector, type LiveEvent } from './live.js';

function setup(allow: () => LiveServerMessage | null = () => null) {
  const sent: LiveServerMessage[] = [];
  const inputs: Record<string, unknown>[] = [];
  let emit: (e: LiveEvent) => void = () => {};
  const handles: (string | undefined)[] = [];
  const closed = vi.fn();
  const connector: LiveConnector = async ({ resumeHandle, onEvent }) => {
    handles.push(resumeHandle);
    emit = onEvent;
    return { sendRealtimeInput: (i) => inputs.push(i), sendClientContent: (c) => inputs.push({ clientContent: c }), close: closed };
  };
  let clock = 1000;
  const bridge = new LiveBridge((m) => sent.push(m), connector, allow, () => clock, () => {});
  const msg = (m: object) => bridge.onMessage(JSON.stringify(m));
  return { bridge, sent, inputs, emit: (e: LiveEvent) => emit(e), handles, closed, msg, tick: (ms: number) => (clock += ms) };
}

const AUDIO = Buffer.alloc(3200).toString('base64'); // 0.1 s of PCM16 at 16 kHz

describe('Live bridge (push-to-talk, transcript only)', () => {
  it('ask → frame + audio → end → transcript pieces → one answer with latency', async () => {
    const { sent, inputs, emit, msg, tick } = setup();
    await msg({ type: 'ask', frame: Buffer.from([0xff, 0xd8]).toString('base64') });
    await msg({ type: 'audio', data: AUDIO });
    await msg({ type: 'end' });
    tick(1200);
    emit({ transcript: 'There is a kerb ' });
    emit({ transcript: 'on your left.' });
    emit({ turnComplete: true });
    expect(inputs.map((i) => Object.keys(i)[0])).toEqual(['activityStart', 'video', 'audio', 'activityEnd']);
    expect((inputs[2] as { audio: { mimeType: string } }).audio.mimeType).toBe('audio/pcm;rate=16000');
    expect(sent).toEqual([{ type: 'answer', text: 'There is a kerb on your left.', ms: 1200 }]);
  });

  it('only the transcript is forwarded — model audio never reaches the phone (SAF-21)', async () => {
    const { sent, emit, msg } = setup();
    await msg({ type: 'ask' });
    await msg({ type: 'end' });
    emit({ transcript: 'Shops on the right.' });
    emit({ turnComplete: true });
    expect(JSON.stringify(sent)).not.toMatch(/audio|inlineData/);
  });

  it('"What\'s around me": photo + fixed question as one turn, answered like a question', async () => {
    const { sent, inputs, emit, msg } = setup();
    await msg({ type: 'describe', frame: Buffer.from([0xff, 0xd8]).toString('base64') });
    const turn = (inputs[0] as { clientContent: { turns: { parts: object[] }[]; turnComplete: boolean } }).clientContent;
    expect(turn.turnComplete).toBe(true);
    expect(turn.turns[0]!.parts).toHaveLength(2);
    emit({ transcript: 'A footpath with a bench on the left.' });
    emit({ turnComplete: true });
    expect(sent).toEqual([expect.objectContaining({ type: 'answer', text: 'A footpath with a bench on the left.' })]);
  });

  it('a second question while one is pending is refused ("busy")', async () => {
    const { sent, msg } = setup();
    await msg({ type: 'ask' });
    await msg({ type: 'ask' });
    expect(sent).toEqual([{ type: 'error', code: 'busy' }]);
  });

  it('too much audio cancels the question', async () => {
    const { sent, msg } = setup();
    await msg({ type: 'ask' });
    const big = Buffer.alloc(40_000).toString('base64');
    for (let i = 0; i < 12; i++) await msg({ type: 'audio', data: big });
    expect(sent).toContainEqual({ type: 'error', code: 'too_long' });
  });

  it('rate limit / daily cap refusals come from the guard, before any Live call', async () => {
    const { sent, inputs, handles, msg } = setup(() => ({ type: 'error', code: 'rate_limited' }));
    await msg({ type: 'ask' });
    expect(sent).toEqual([{ type: 'error', code: 'rate_limited' }]);
    expect(inputs).toEqual([]);
    expect(handles).toEqual([]);
  });

  it('GoAway → the next question reconnects with the resumption handle (context kept)', async () => {
    const { emit, msg, handles, closed } = setup();
    await msg({ type: 'ask' });
    await msg({ type: 'end' });
    emit({ resumeHandle: 'h-123' });
    emit({ transcript: 'Ok.' });
    emit({ turnComplete: true });
    emit({ goAway: true });
    await msg({ type: 'ask' });
    expect(handles).toEqual([undefined, 'h-123']);
    expect(closed).toHaveBeenCalled();
  });

  it('session error while waiting → model_error (fail loud); timeout when nothing comes back', async () => {
    vi.useFakeTimers();
    const a = setup();
    await a.msg({ type: 'ask' });
    await a.msg({ type: 'end' });
    a.emit({ error: 'boom' });
    expect(a.sent).toEqual([{ type: 'error', code: 'model_error' }]);
    const b = setup();
    await b.msg({ type: 'ask' });
    await b.msg({ type: 'end' });
    vi.advanceTimersByTime(15_001);
    expect(b.sent).toEqual([{ type: 'error', code: 'timeout' }]);
    vi.useRealTimers();
  });

  it('rejects malformed client messages', async () => {
    expect(parseLiveClientMessage('{"type":"audio","data":"not base64!"}')).toBeNull();
    expect(parseLiveClientMessage('{"type":"exec","cmd":"rm"}')).toBeNull();
    expect(parseLiveClientMessage('nope')).toBeNull();
    const { sent, msg } = setup();
    await msg({ type: 'hello' });
    expect(sent).toEqual([{ type: 'error', code: 'bad_message' }]);
  });
});
