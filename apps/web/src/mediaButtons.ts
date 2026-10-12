// Earbud / headset button control (owner request 2026-10-13): works with the phone in a pocket and with TalkBack /
// VoiceOver on (screen multi-taps would be taken by the screen reader). The OS already turns presses into media actions:
// 1 press = play/pause → Ask · 2 presses = next track → What's around me · 3 presses = previous track → Repeat.
// The browser only routes these to a page that is playing media, so a silent looping audio clip keeps the media
// session active while walking. Support varies by phone/earbuds (unverified on iOS) — the on-screen buttons remain.

export interface MediaButtonHandlers {
  ask: () => void;
  describe: () => void;
  repeat: () => void;
}

/** A 1-second silent 8 kHz mono WAV as a data URL (no network, nothing audible). */
function silentWav(): string {
  const n = 8000;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true);
  v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128); // 8-bit PCM silence
  let bin = '';
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

export class MediaButtons {
  private audio: HTMLAudioElement | null = null;

  /** True when this browser exposes media-session actions. */
  static get supported(): boolean {
    return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
  }

  /** Call inside the Start tap (audio may only start from a user gesture). */
  arm(h: MediaButtonHandlers): void {
    if (!MediaButtons.supported) return;
    this.audio ??= Object.assign(new Audio(silentWav()), { loop: true, volume: 0.01 });
    const keepAlive = () => void this.audio?.play().catch(() => undefined);
    keepAlive();
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({ title: 'Footprint', artist: 'Earbud button: 1 ask · 2 describe · 3 repeat' });
    const on = (action: MediaSessionAction, fn: () => void) => {
      try {
        ms.setActionHandler(action, () => {
          fn();
          keepAlive(); // a "pause" press would otherwise stop the session
        });
      } catch {
        /* action not supported on this browser */
      }
    };
    on('play', h.ask);
    on('pause', h.ask);
    on('nexttrack', h.describe);
    on('previoustrack', h.repeat);
    ms.playbackState = 'playing';
  }

  disarm(): void {
    if (!MediaButtons.supported) return;
    for (const a of ['play', 'pause', 'nexttrack', 'previoustrack'] as MediaSessionAction[]) {
      try {
        navigator.mediaSession.setActionHandler(a, null);
      } catch {
        /* ignore */
      }
    }
    this.audio?.pause();
    navigator.mediaSession.playbackState = 'none';
  }
}
