// Scene scan loop (Q6, R2.2, ADR-019 layer 2): every ~2.5 s, one blurred frame → /api/scan → Gemini → validated
// static hazards for the alert manager. One request in flight; skipped while the view is unchanged or the page is
// hidden; results older than 2 s are discarded (SAF-03). Frames come only from FaceBlurrer (uploadGuard.test.ts).
import {
  parseScanResult,
  scanCostUsd,
  scanSurfaceNote,
  scanToCandidates,
  signatureDiff,
  UNCHANGED_DIFF,
  type AlertCandidate,
  type ScanResult,
} from '@footprint/shared';
import type { FaceBlurrer } from './faceBlur';
import { frameSignature } from './frameSource';

/** A scan result arriving later than this after its frame was captured is dropped (SAF-03). */
export const SCAN_MAX_AGE_MS = 2000;
export const SCAN_INTERVAL_MS = 2500;
const REQUEST_TIMEOUT_MS = 6000;
const FAILS_BEFORE_DOWN = 3;
const RATE_LIMIT_BACKOFF_MS = 30_000;

export type ScanStatus = 'down' | 'up' | 'capped';

export interface ScanStats {
  sent: number;
  ok: number;
  stale: number;
  failed: number;
  unchanged: number;
  lastRoundTripMs: number;
  /** Capture → JPEG ready (blur + encode), ms. */
  lastPrepMs: number;
  /** Model call as timed by the server, ms. */
  lastServerMs: number;
  costUsd: number;
  startedAt: number;
}

export interface SceneScannerOptions {
  video: HTMLVideoElement;
  blurrer: () => FaceBlurrer | null;
  /** Fixed-wording status changes (scan down / back / capped) — the caller announces them (fail loud). */
  onStatus: (status: ScanStatus) => void;
  /** Model-derived context text: must go to AlertOutput.sayModelText (the filtered path, R1.7). */
  onContext: (text: string) => void;
  /** Every fresh, validated scan (Q7: becomes community observations). */
  onScan?: (scan: ScanResult) => void;
  fetchImpl?: typeof fetch;
}

export class SceneScanner {
  private timer: number | undefined;
  private running = false;
  private session = '';
  private active: AlertCandidate[] = [];
  private lastSignature: Uint8Array | null = null;
  private lastNote = '';
  private fails = 0;
  private down = false;
  private capped = false;
  private readonly sigCanvas = document.createElement('canvas');
  readonly stats: ScanStats = { sent: 0, ok: 0, stale: 0, failed: 0, unchanged: 0, lastRoundTripMs: 0, lastPrepMs: 0, lastServerMs: 0, costUsd: 0, startedAt: 0 };

  constructor(private readonly opts: SceneScannerOptions) {}

  /** New walk: new random session ID (never linked to a person), fresh state. */
  start(): void {
    this.stop();
    this.running = true;
    this.session = crypto.randomUUID();
    Object.assign(this.stats, { sent: 0, ok: 0, stale: 0, failed: 0, unchanged: 0, lastRoundTripMs: 0, costUsd: 0, startedAt: performance.now() });
    this.schedule(500);
  }

  stop(): void {
    this.running = false;
    window.clearTimeout(this.timer);
    this.active = [];
    this.lastSignature = null;
    this.lastNote = '';
    this.fails = 0;
    this.down = false;
  }

  /** Scan candidates still valid at `now` (the alert manager also expires them by age). */
  candidates(): AlertCandidate[] {
    return this.active;
  }

  private schedule(ms: number): void {
    if (!this.running) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.tick(), ms);
  }

  private async tick(): Promise<void> {
    const started = performance.now();
    let next = SCAN_INTERVAL_MS;
    try {
      next = await this.scanOnce();
    } catch (err) {
      console.error('scan loop error', err);
    }
    this.schedule(Math.max(0, next - (performance.now() - started)));
  }

  /** One scan attempt. Returns the delay before the next attempt. */
  private async scanOnce(): Promise<number> {
    const blurrer = this.opts.blurrer();
    if (document.hidden || !blurrer || this.capped) return SCAN_INTERVAL_MS;
    const sig = frameSignature(this.opts.video, this.sigCanvas);
    if (sig && signatureDiff(sig, this.lastSignature) < UNCHANGED_DIFF) {
      this.stats.unchanged++;
      return SCAN_INTERVAL_MS;
    }
    const t0 = performance.now();
    const jpeg = await blurrer.getUploadJpeg(this.opts.video);
    if (!jpeg) return SCAN_INTERVAL_MS; // fail closed: no blurred frame → nothing is sent
    this.stats.lastPrepMs = Math.round(performance.now() - t0);
    this.stats.sent++;
    let res: Response;
    try {
      res = await (this.opts.fetchImpl ?? fetch)('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'image/jpeg', 'x-session-id': this.session },
        body: jpeg.blob,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      this.fail();
      return SCAN_INTERVAL_MS;
    }
    if (res.status === 429) {
      this.fail();
      return RATE_LIMIT_BACKOFF_MS;
    }
    if (res.status === 503) {
      this.capped = true;
      this.opts.onStatus('capped');
      return SCAN_INTERVAL_MS;
    }
    if (!res.ok) {
      this.fail();
      return SCAN_INTERVAL_MS;
    }
    const body = (await res.json().catch(() => null)) as { scan?: unknown; ms?: number; usage?: { inputTokens: number; outputTokens: number } } | null;
    if (typeof body?.ms === 'number') this.stats.lastServerMs = Math.round(body.ms);
    const scan = parseScanResult(body?.scan); // re-validate on the client too (defence in depth)
    const age = performance.now() - t0;
    this.stats.lastRoundTripMs = Math.round(age);
    if (body?.usage) this.stats.costUsd += scanCostUsd(body.usage);
    if (!scan) {
      this.fail();
      return SCAN_INTERVAL_MS;
    }
    this.succeed();
    this.lastSignature = sig;
    if (age > SCAN_MAX_AGE_MS) {
      this.stats.stale++; // describes where the user was 2+ s ago (SAF-03)
      return SCAN_INTERVAL_MS;
    }
    this.stats.ok++;
    this.active = scanToCandidates(scan, t0);
    this.opts.onScan?.(scan);
    const note = scanSurfaceNote(scan);
    if (note && note !== this.lastNote) this.opts.onContext(note);
    this.lastNote = note;
    return SCAN_INTERVAL_MS;
  }

  private fail(): void {
    this.stats.failed++;
    this.fails++;
    if (this.fails >= FAILS_BEFORE_DOWN && !this.down) {
      this.down = true;
      this.active = [];
      this.opts.onStatus('down');
    }
  }

  private succeed(): void {
    this.fails = 0;
    if (this.down) {
      this.down = false;
      this.opts.onStatus('up');
    }
  }
}
