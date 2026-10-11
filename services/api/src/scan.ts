// POST /api/scan (R2.2): blurred JPEG → Vertex Gemini (JSON schema) → validated scan. The frame is held in memory for
// the one call and never logged or stored (PRI-10). Rate-limited per session and per client, with a per-instance daily
// cap, because every request costs a paid model call (SEC-02, REL-06).
import { GoogleGenAI, MediaResolution, type ThinkingConfig } from '@google/genai';
import type { FastifyInstance } from 'fastify';
import {
  parseScanResult,
  SCAN_RESPONSE_SCHEMA,
  SCAN_SYSTEM_INSTRUCTION,
  SCAN_USER_PROMPT,
  type ScanResult,
} from '@footprint/shared';
import { MinuteLimiter } from './limits.js';

export interface ScanUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Calls the model with one JPEG and returns its raw (untrusted) JSON text plus token usage. */
export type ScanAnalyzer = (jpeg: Buffer, signal: AbortSignal) => Promise<{ text: string; usage: ScanUsage }>;

export interface ScanOptions {
  analyzer?: ScanAnalyzer;
  /** Max scans per session per minute (client scans every 2–3 s → ~24). */
  perSessionPerMinute?: number;
  /** Max scans per client address per minute (several sessions from one phone / abuse). */
  perClientPerMinute?: number;
  /** Max scans per instance per UTC day — hard cost cap (FOLLOWUPS #6). */
  dailyCap?: number;
  timeoutMs?: number;
  now?: () => number;
}

export const SCAN_MAX_BYTES = 300 * 1024;
const SESSION_RE = /^[A-Za-z0-9-]{8,64}$/;

/** Vertex Gemini analyzer (ADR-030): runtime service account auth, no key in the app. */
export function vertexAnalyzer(env: NodeJS.ProcessEnv = process.env): ScanAnalyzer {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GEMINI_SCAN_LOCATION || 'global',
  });
  // ADR-034 (benchmarked 2026-10-12, FACTS.md): gemini-3.6-flash with thinking off — 1.3–1.9 s, correct on 10/10 test
  // frames; gemini-3.8-flash was 2.4–18 s; gemini-2.5-flash retires ~2026-10-16/20. The answer is a short enum list, so
  // thinking adds latency, not accuracy. Medium image resolution is enough for ground hazards in a 640 px frame.
  const model = env.GEMINI_SCAN_MODEL || 'gemini-3.6-flash';
  const thinking = env.GEMINI_SCAN_THINKING || 'off';
  const thinkingConfig: ThinkingConfig =
    thinking === 'off' ? { thinkingBudget: 0 } : { thinkingLevel: thinking.toUpperCase() as ThinkingConfig['thinkingLevel'] };
  const mediaResolution = `MEDIA_RESOLUTION_${(env.GEMINI_SCAN_MEDIA_RES || 'MEDIUM').toUpperCase()}` as MediaResolution;
  return async (jpeg, signal) => {
    const res = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } }, { text: SCAN_USER_PROMPT }],
        },
      ],
      config: {
        systemInstruction: SCAN_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: SCAN_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
        temperature: 0,
        maxOutputTokens: 400,
        thinkingConfig,
        mediaResolution,
        abortSignal: signal,
      },
    });
    return {
      text: res.text ?? '',
      usage: {
        inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
      },
    };
  };
}

export async function registerScan(app: FastifyInstance, opts: ScanOptions = {}): Promise<void> {
  const now = opts.now ?? Date.now;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const dailyCap = opts.dailyCap ?? Number(process.env.SCAN_DAILY_CAP || 5000);
  const perSession = new MinuteLimiter(opts.perSessionPerMinute ?? 30);
  const perClient = new MinuteLimiter(opts.perClientPerMinute ?? 60);
  let analyzer = opts.analyzer;
  let day = '';
  let today = 0;

  app.addContentTypeParser('image/jpeg', { parseAs: 'buffer', bodyLimit: SCAN_MAX_BYTES }, (_req, body, done) =>
    done(null, body),
  );

  app.post('/api/scan', { bodyLimit: SCAN_MAX_BYTES }, async (req, reply) => {
    if (req.headers['content-type'] !== 'image/jpeg') return reply.code(415).send({ error: 'jpeg_only' });
    const session = req.headers['x-session-id'];
    if (typeof session !== 'string' || !SESSION_RE.test(session)) return reply.code(400).send({ error: 'session_id' });
    const jpeg = req.body;
    if (!Buffer.isBuffer(jpeg) || jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
      return reply.code(400).send({ error: 'not_jpeg' });
    }
    const t = now();
    const d = new Date(t).toISOString().slice(0, 10);
    if (d !== day) {
      day = d;
      today = 0;
    }
    if (today >= dailyCap) return reply.code(503).send({ error: 'daily_cap' });
    if (!perSession.allow(session, t) || !perClient.allow(req.ip, t)) return reply.code(429).send({ error: 'rate_limited' });
    today++;

    analyzer ??= vertexAnalyzer();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const t0 = now();
    try {
      const { text, usage } = await analyzer(jpeg, ctrl.signal);
      const scan: ScanResult | null = parseScanResult(text);
      if (!scan) {
        req.log.warn({ code: 'scan_invalid' }, 'model returned an unusable scan'); // never the content
        return reply.code(502).send({ error: 'invalid_model_output' });
      }
      return { scan, usage, ms: now() - t0 };
    } catch (err) {
      const aborted = ctrl.signal.aborted;
      req.log.warn({ code: aborted ? 'scan_timeout' : 'scan_error', name: (err as Error)?.name }, 'scan failed');
      return reply.code(aborted ? 504 : 502).send({ error: aborted ? 'timeout' : 'model_error' });
    } finally {
      clearTimeout(timer);
    }
  });
}
