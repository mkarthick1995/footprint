// Spoken messages for frame-source problems (SAFETY.md §1 fail loud, §5 approved wording).
// Pure functions so they can be unit-tested without a browser.

/** Maps a getUserMedia / play() error to a short spoken message. Unknown errors still produce a message. */
export function cameraErrorMessage(err: unknown, secureContext = true): string {
  if (!secureContext) return 'Camera needs a secure https page. Footprint is not running.';
  const name = (err as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was denied. Allow camera access in browser settings. Footprint is not running.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No usable camera was found. Footprint is not running.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is busy in another app. Close it and try again. Footprint is not running.';
    default:
      return 'Camera could not start. Footprint is not running.';
  }
}

export const MESSAGES = {
  started: 'Footprint started. It warns about people, bikes and vehicles, and can miss things. Keep using your cane.',
  stopped: 'Footprint stopped. Alerts are off.',
  paused: 'Footprint paused. Alerts are off.',
  resumed: 'Footprint resumed.',
  cameraLost: "Camera stopped. Alerts are off until it's back.",
  wakeLockUnsupported: 'This browser cannot keep the screen on. If the screen locks, alerts turn off.',
  wakeLockLost: 'The screen may lock. If it does, alerts turn off.',
  chooseClip: 'Choose a recorded clip first.',
  detectorFailed: 'Obstacle detection could not start. Alerts are off.',
  detectorStopped: 'Obstacle detection stopped. Alerts are off.',
  commandUnclear: "Sorry, I didn't catch that. Please ask again.",
  routeNeedsDestination: 'Say or type a destination first.',
  routeNeedsLocation: 'Route needs your location. Start walking with the camera and allow location.',
  routeTooFar: 'That is more than 5 kilometres on foot. Footprint summarises walking routes up to 5 kilometres.',
  routeNotFound: "I couldn't find a walking route there.",
  routeUnavailable: 'Route information is unavailable right now. Obstacle alerts still work.',
  earbudHelp: 'Earbud button: press once to ask, twice to describe, three times to repeat.',
  nothingToRepeat: 'Nothing to repeat yet.',
  noLocationYet: 'No location yet. Community reports and routes wait for it. Obstacle alerts still work.',
  locationOff: 'Location is off. Community reports are off. Obstacle alerts still work.',
  scanDown: 'Scene descriptions are unavailable. Obstacle alerts still work.',
  scanUp: 'Scene descriptions are back.',
  scanCapped: 'Scene descriptions are paused for today. Obstacle alerts still work.',
  blurUnavailable: 'Privacy protection could not start. Scene descriptions are off. Obstacle alerts still work.',
} as const;

/** Scales (width, height) down so width ≤ maxWidth, keeping aspect ratio. Never upscales; never returns 0. */
export function scaledSize(width: number, height: number, maxWidth: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  if (width <= maxWidth) return { width, height };
  const ratio = maxWidth / width;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
