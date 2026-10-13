import { describe, expect, it, vi } from 'vitest';
import { buildServer } from './server.js';
import type { Synthesizer } from './tts.js';

async function setup(synth: Synthesizer, extra: object = {}) {
  const app = await buildServer({ webDist: '/nonexistent', tts: { synth, ...extra } });
  const say = (text: string, lang = 'en-IN', session = 'walk-tts-0001') =>
    app.inject({ method: 'POST', url: '/api/tts', payload: { text, lang }, headers: { 'x-session-id': session } });
  return { app, say };
}

describe('POST /api/tts (R3.4 natural voice)', () => {
  it('returns MP3 audio; the same phrase again comes from the cache (one synthesis)', async () => {
    const synth = vi.fn<Synthesizer>(async () => Buffer.from('ID3fake'));
    const { app, say } = await setup(synth);
    const a = await say('Stop! Bike');
    expect(a.statusCode).toBe(200);
    expect(a.headers['content-type']).toBe('audio/mpeg');
    expect((await say('Stop!   Bike')).statusCode).toBe(200);
    expect(synth).toHaveBeenCalledTimes(1);
    expect(synth).toHaveBeenCalledWith('Stop! Bike', 'en-IN', expect.anything());
    await app.close();
  });

  it('rejects unknown languages, empty or over-long text, and a missing walk ID', async () => {
    const { app, say } = await setup(async () => Buffer.from('x'));
    expect((await say('Hello', 'fr-FR')).statusCode).toBe(400);
    expect((await say('')).statusCode).toBe(400);
    expect((await say('a'.repeat(401))).statusCode).toBe(400);
    expect((await say('Hello', 'en-IN', 'x')).statusCode).toBe(400);
    await app.close();
  });

  it('daily character cap; synthesis errors → 502', async () => {
    const capped = await setup(async () => Buffer.from('x'), { dailyChars: 15 });
    expect((await capped.say('Person close, left')).statusCode).toBe(503);
    await capped.app.close();
    const broken = await setup(async () => {
      throw new Error('tts 500');
    });
    expect((await broken.say('Stop! Bike')).statusCode).toBe(502);
    await broken.app.close();
  });

  it('per-walk rate limit on new phrases', async () => {
    const { app, say } = await setup(async () => Buffer.from('x'), { perSessionPerMinute: 2 });
    expect((await say('one')).statusCode).toBe(200);
    expect((await say('two')).statusCode).toBe(200);
    expect((await say('three')).statusCode).toBe(429);
    expect((await say('one')).statusCode).toBe(200); // cached phrases stay free
    await app.close();
  });
});
