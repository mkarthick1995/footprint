// Scan-loop safety rules (Q6): stale results dropped (SAF-03), outages announced (fail loud), nothing sent without a
// blurred frame (PRI-01), the daily cap stops scanning. Runs in Node with minimal browser stubs.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const g = globalThis as unknown as Record<string, unknown>;
beforeEach(() => {
  g.document = { createElement: () => ({}), hidden: false };
  g.window = globalThis;
});
afterEach(() => {
  vi.restoreAllMocks();
  delete g.document;
  delete g.window;
});

const SCAN = {
  hazards: [{ type: 'pothole', direction: 'ahead', distance: 'near', confidence: 0.9 }],
  footpath: 'present',
  surface: 'wet',
  crossing: 'none',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function setup(responses: Array<Response | Error>, opts: { blurOk?: boolean; latencyMs?: number } = {}) {
  const { SceneScanner } = await import('./sceneScan');
  let clock = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  const status: string[] = [];
  const context: string[] = [];
  const sent: RequestInit[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    sent.push(init!);
    clock += opts.latencyMs ?? 800;
    const r = responses.shift()!;
    if (r instanceof Error) throw r;
    return r;
  });
  const blurrer = { getUploadJpeg: async () => (opts.blurOk === false ? null : { blob: new Blob([new Uint8Array([0xff, 0xd8])]), faces: 0, heads: 0, ms: 1 }) };
  const s = new SceneScanner({
    video: { videoWidth: 0 } as HTMLVideoElement,
    blurrer: () => blurrer as never,
    onStatus: (x) => status.push(x),
    onContext: (t) => context.push(t),
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  (s as unknown as { session: string }).session = 'test-session-0001';
  const once = () => (s as unknown as { scanOnce(): Promise<number> }).scanOnce();
  return { s, once, status, context, sent };
}

describe('SceneScanner', () => {
  it('a fresh result becomes alert candidates; surface notes go to the filtered context path', async () => {
    const { s, once, context, sent } = await setup([json(200, { scan: SCAN, usage: { inputTokens: 1100, outputTokens: 60 } })]);
    await once();
    expect(s.candidates().map((c) => c.id)).toEqual(['scan:pothole:ahead']);
    expect(context).toEqual(['Wet surface.']);
    expect(s.stats.ok).toBe(1);
    expect(s.stats.costUsd).toBeCloseTo(0.0010500, 6);
    expect((sent[0]!.headers as Record<string, string>)['content-type']).toBe('image/jpeg');
  });

  it('SAF-03: a result arriving more than 2 s after capture is discarded', async () => {
    const { s, once } = await setup([json(200, { scan: SCAN, usage: { inputTokens: 1, outputTokens: 1 } })], { latencyMs: 2300 });
    await once();
    expect(s.candidates()).toEqual([]);
    expect(s.stats.stale).toBe(1);
  });

  it('PRI-01: no blurred frame → nothing is sent', async () => {
    const { once, sent } = await setup([], { blurOk: false });
    await once();
    expect(sent).toHaveLength(0);
  });

  it('fail loud: three failures in a row announce "down" once, the next success announces "up"', async () => {
    const ok = json(200, { scan: SCAN, usage: { inputTokens: 1, outputTokens: 1 } });
    const { s, once, status } = await setup([new Error('offline'), json(502, {}), json(504, {}), json(502, {}), ok]);
    for (let i = 0; i < 4; i++) await once();
    expect(status).toEqual(['down']);
    expect(s.candidates()).toEqual([]);
    await once();
    expect(status).toEqual(['down', 'up']);
  });

  it('invalid model output is a failure, never a candidate', async () => {
    const { s, once } = await setup([json(200, { scan: { note: 'The road is clear' } })]);
    await once();
    expect(s.candidates()).toEqual([]);
    expect(s.stats.failed).toBe(1);
  });

  it('ST-03: rate limited → scan reported down at once and backs off 30 s; daily cap → announced once, scanning stops', async () => {
    const { s, once, status, sent } = await setup([json(429, {}), json(503, { error: 'daily_cap' })]);
    expect(await once()).toBe(30_000);
    expect(status).toEqual(['down']);
    expect((s as unknown as { down: boolean }).down).toBe(true);
    await once();
    expect(status).toEqual(['down', 'capped']);
    await once();
    expect(sent).toHaveLength(2);
  });
});
