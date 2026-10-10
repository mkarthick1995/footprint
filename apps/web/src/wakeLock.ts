// Keeps the screen on while walking (SAF-05, ADR-015): in a browser the camera stops when the screen locks.
import { MESSAGES } from './messages';

type Announce = (text: string) => void;

export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;

  constructor(private readonly announce: Announce) {}

  get supported(): boolean {
    return 'wakeLock' in navigator;
  }

  /** Request the lock; announces once if the browser can't keep the screen on. */
  async acquire(): Promise<void> {
    this.wanted = true;
    if (!this.supported) {
      this.announce(MESSAGES.wakeLockUnsupported);
      return;
    }
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
        // Released by the system while we still need it (e.g. low battery saver) → warn.
        if (this.wanted && document.visibilityState === 'visible') this.announce(MESSAGES.wakeLockLost);
      });
    } catch {
      this.announce(MESSAGES.wakeLockLost);
    }
  }

  /** Browsers drop the lock when the page is hidden; call this when it becomes visible again. */
  async reacquireIfNeeded(): Promise<void> {
    if (this.wanted && !this.sentinel && this.supported) await this.acquire();
  }

  async release(): Promise<void> {
    this.wanted = false;
    const s = this.sentinel;
    this.sentinel = null;
    if (s) await s.release().catch(() => undefined);
  }
}

