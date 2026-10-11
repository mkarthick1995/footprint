// Fail-loud monitor (Q9, R1.6): twice a second it checks the camera (frozen / covered / dark / blurred), the phone's
// angle, the detector heartbeat and the scene scan, and feeds the degradation ladder (packages/shared/src/health.ts).
// Level changes and one-off warnings (battery, slow/hot phone, lost location) are spoken through the caller's announce().
// Paused while the page is hidden (the visibility handler already says "paused").
import {
  BATTERY_WARN,
  batteryMessage,
  cameraProblem,
  evaluateLadder,
  frameStats,
  HOT_MESSAGE,
  LadderTracker,
  orientationProblem,
  SLOW_FPS,
  SLOW_MESSAGE,
  type LadderLevel,
} from '@footprint/shared';
import { frameSignature } from './frameSource';

const QW = 64;
const QH = 36;
const TICK_MS = 500;
/** No new video frame for this long → frozen / lost camera. */
const FROZEN_MS = 2000;
/** No detector result for this long (after it started) → pipeline stalled (L3). */
const DETECTOR_STALL_MS = 3000;
/** Orientation readings older than this are ignored (sensor stopped / not available). */
const ORIENTATION_MAX_AGE_MS = 3000;
const SLOW_FOR_MS = 10_000;
const GPS_LOST_MS = 30_000;

export const GPS_LOST_MESSAGE = 'Location lost. Community reports paused. Obstacle alerts still on.';

export interface HealthSources {
  video: HTMLVideoElement;
  /** performance.now() of the last detector result, or 0 before the first one. */
  detectorBeat: () => number;
  detectorFps: () => number;
  /** False when the scene scan is down; null when not in use yet. */
  sceneOk: () => boolean | null;
  /** ms since the last good GPS fix, or null when location isn't in use. */
  gpsAge: () => number | null;
  announce: (text: string) => void;
  now?: () => number;
}

export class HealthMonitor {
  private timer: number | undefined;
  private readonly tracker = new LadderTracker();
  private readonly canvas = document.createElement('canvas');
  private lastVideoTime = -1;
  private lastVideoChange = 0;
  private beta: number | null = null;
  private betaAt = 0;
  private slowSince = 0;
  private slowWarned = false;
  private hotWarned = false;
  private gpsWarned = false;
  private batteryWarned = new Set<number>();
  private battery: { level: number; charging: boolean; addEventListener: (e: string, f: () => void) => void } | null = null;
  private pressure: { observe: (s: string) => Promise<void>; disconnect: () => void } | null = null;
  private readonly onOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta !== null) {
      this.beta = e.beta;
      this.betaAt = this.now();
    }
  };

  constructor(private readonly src: HealthSources) {}

  private now(): number {
    return (this.src.now ?? (() => performance.now()))();
  }

  get level(): LadderLevel {
    return this.tracker.state.level;
  }

  /** Start monitoring a walk. Call from the Start tap so iOS can ask for motion permission. */
  start(): void {
    this.stop();
    this.tracker.reset();
    this.lastVideoChange = this.now();
    this.lastVideoTime = -1;
    Object.assign(this, { slowSince: 0, slowWarned: false, hotWarned: false, gpsWarned: false });
    this.batteryWarned.clear();
    window.addEventListener('deviceorientation', this.onOrientation);
    void this.watchBattery();
    this.watchPressure();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    window.clearInterval(this.timer);
    window.removeEventListener('deviceorientation', this.onOrientation);
    this.pressure?.disconnect();
    this.pressure = null;
  }

  /** After the page was hidden: forget timing so the pause isn't mistaken for a frozen camera or stalled detector. */
  resume(): void {
    this.lastVideoChange = this.now();
    this.tracker.reset();
  }

  /** iOS needs a user gesture to grant motion sensors; Android/desktop grant silently. Call inside the Start tap. */
  static requestMotionPermission(): void {
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof D?.requestPermission === 'function') void D.requestPermission().catch(() => undefined);
  }

  private tick(): void {
    if (document.hidden) return;
    const now = this.now();
    const v = this.src.video;
    if (v.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = v.currentTime;
      this.lastVideoChange = now;
    }
    const gray = frameSignature(v, this.canvas, QW, QH);
    const beat = this.src.detectorBeat();
    const state = evaluateLadder({
      detectorAlive: beat === 0 || now - beat < DETECTOR_STALL_MS,
      cameraLive: now - this.lastVideoChange < FROZEN_MS,
      camera: gray ? cameraProblem(frameStats(gray, QW, QH)) : null,
      orientation: now - this.betaAt < ORIENTATION_MAX_AGE_MS ? orientationProblem(this.beta) : null,
      sceneOk: this.src.sceneOk(),
    });
    const msg = this.tracker.update(state, now);
    if (msg) this.src.announce(msg);
    this.checkSlow(now, beat);
    this.checkGps();
  }

  private checkSlow(now: number, beat: number): void {
    if (beat === 0) return;
    const fps = this.src.detectorFps();
    if (fps > 0 && fps < SLOW_FPS) {
      this.slowSince ||= now;
      if (!this.slowWarned && now - this.slowSince >= SLOW_FOR_MS) {
        this.slowWarned = true;
        this.src.announce(SLOW_MESSAGE);
      }
    } else if (fps > SLOW_FPS + 3) {
      this.slowSince = 0;
      this.slowWarned = false;
    }
  }

  private checkGps(): void {
    const age = this.src.gpsAge();
    if (age === null) return;
    if (age > GPS_LOST_MS && !this.gpsWarned) {
      this.gpsWarned = true;
      this.src.announce(GPS_LOST_MESSAGE);
    } else if (age < 5000) this.gpsWarned = false;
  }

  private async watchBattery(): Promise<void> {
    const nav = navigator as unknown as { getBattery?: () => Promise<HealthMonitor['battery']> };
    if (!nav.getBattery) return;
    try {
      this.battery = await nav.getBattery();
    } catch {
      return;
    }
    const check = () => {
      const b = this.battery;
      if (!b || b.charging) return;
      for (const t of BATTERY_WARN) {
        if (b.level <= t && !this.batteryWarned.has(t)) {
          BATTERY_WARN.filter((x) => x >= t).forEach((x) => this.batteryWarned.add(x));
          this.src.announce(batteryMessage(b.level));
          break;
        }
      }
    };
    this.battery?.addEventListener('levelchange', check);
    check();
  }

  /** Compute Pressure API (Chromium): "critical" CPU pressure ≈ thermal throttling. Optional. */
  private watchPressure(): void {
    const P = (window as unknown as { PressureObserver?: new (cb: (r: { state: string }[]) => void) => HealthMonitor['pressure'] }).PressureObserver;
    if (!P) return;
    try {
      this.pressure = new P((records) => {
        if (!this.hotWarned && records.some((r) => r.state === 'critical')) {
          this.hotWarned = true;
          this.src.announce(HOT_MESSAGE);
        }
      });
      void this.pressure?.observe('cpu').catch(() => undefined);
    } catch {
      this.pressure = null;
    }
  }
}
