// POST /api/tts (R3.4, ADR-041): our own already-chosen words → Google Cloud Text-to-Speech, Chirp 3 HD natural voice
// (MP3). Speaks only text the phone decided to say — fixed alert phrases and safety-filtered model answers — so the
// safety pipeline is unchanged (Gemini Live's own audio is still never played, SAF-21). The text is never logged.
import { GoogleAuth } from 'google-auth-library';
import type { FastifyInstance } from 'fastify';
import { MinuteLimiter } from './limits.js';

/** Languages with a Chirp 3 HD voice that Footprint offers (R3.2 adds the translations). */
export const TTS_VOICES: Record<string, string> = {
  'en-IN': 'en-IN-Chirp3-HD-Aoede',
  'hi-IN': 'hi-IN-Chirp3-HD-Aoede',
  'ta-IN': 'ta-IN-Chirp3-HD-Aoede',
  'te-IN': 'te-IN-Chirp3-HD-Aoede',
  'ja-JP': 'ja-JP-Chirp3-HD-Aoede',
};

export const TTS_MAX_CHARS = 400;

/** Text → MP3 bytes. */
export type Synthesizer = (text: string, lang: string, signal: AbortSignal) => Promise<Buffer>;

export function googleSynthesizer(env: NodeJS.ProcessEnv = process.env): Synthesizer {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const project = env.GOOGLE_CLOUD_PROJECT ?? '';
  return async (text, lang, signal) => {
    const token = await auth.getAccessToken();
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-goog-user-project': project },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: lang, name: TTS_VOICES[lang] },
        audioConfig: { audioEncoding: 'MP3' },
      }),
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const body = (await res.json()) as { audioContent?: string };
    if (!body.audioContent) throw new Error('tts empty');
    return Buffer.from(body.audioContent, 'base64');
  };
}

export interface TtsOptions {
  synth?: Synthesizer;
  /** Characters synthesised per day across all users (cost cap; cache hits are free). */
  dailyChars?: number;
  perSessionPerMinute?: number;
  cacheEntries?: number;
  now?: () => number;
}

const SESSION_RE = /^[A-Za-z0-9-]{8,64}$/;

export function registerTts(app: FastifyInstance, opts: TtsOptions = {}): void {
  const now = opts.now ?? Date.now;
  const dailyChars = opts.dailyChars ?? Number(process.env.TTS_DAILY_CHARS || 300_000);
  const perSession = new MinuteLimiter(opts.perSessionPerMinute ?? 120);
  const maxEntries = opts.cacheEntries ?? 2000;
  // Fixed phrases repeat across every walk and user: an in-memory LRU makes most requests free and instant.
  const cache = new Map<string, Buffer>();
  let synth = opts.synth;
  let day = '';
  let used = 0;

  // POST, not GET: the request logger records URLs, and the text must never reach a log (PRI-06).
  app.post('/api/tts', async (req, reply) => {
    const q = (req.body ?? {}) as { text?: unknown; lang?: unknown };
    const session = req.headers['x-session-id'];
    if (typeof session !== 'string' || !SESSION_RE.test(session)) return reply.code(400).send({ error: 'session_id' });
    const lang = typeof q.lang === 'string' ? q.lang : '';
    const text = typeof q.text === 'string' ? q.text.replace(/\s+/g, ' ').trim() : '';
    if (!TTS_VOICES[lang] || text.length === 0 || text.length > TTS_MAX_CHARS) return reply.code(400).send({ error: 'invalid_tts_request' });
    const key = `${lang}|${text}`;
    const hit = cache.get(key);
    const send = (audio: Buffer) =>
      reply.header('content-type', 'audio/mpeg').header('cache-control', 'private, max-age=86400').send(audio);
    if (hit) {
      cache.delete(key);
      cache.set(key, hit); // most recently used
      return send(hit);
    }
    const t = now();
    if (!perSession.allow(session, t)) return reply.code(429).send({ error: 'rate_limited' });
    const d = new Date(t).toISOString().slice(0, 10);
    if (d !== day) ((day = d), (used = 0));
    if (used + text.length > dailyChars) return reply.code(503).send({ error: 'daily_cap' });
    used += text.length;
    synth ??= googleSynthesizer();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const audio = await synth(text, lang, ctrl.signal);
      cache.set(key, audio);
      if (cache.size > maxEntries) cache.delete(cache.keys().next().value!);
      return send(audio);
    } catch (err) {
      // Never log the text (it can describe the scene, PRI-06) — only what failed.
      req.log.warn({ code: ctrl.signal.aborted ? 'tts_timeout' : 'tts_error', name: (err as Error)?.name }, 'tts failed');
      return reply.code(502).send({ error: 'tts_unavailable' });
    } finally {
      clearTimeout(timer);
    }
  });
}
