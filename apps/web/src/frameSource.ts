// Frame source abstraction (ADR-016): the rest of the pipeline doesn't know whether frames come from the
// phone camera or a recorded clip, so PC development and tests run on clips and phones run on the camera.
import { scaledSize } from './messages';

export type FrameSourceKind = 'camera' | 'clip';

export interface FrameSource {
  kind: FrameSourceKind;
  video: HTMLVideoElement;
  stop(): void;
}

export interface FrameSourceEvents {
  /** The camera track ended or was muted by the system (another app took it, permission revoked, page hidden). */
  onLost?: () => void;
  onRestored?: () => void;
}

export async function openCamera(video: HTMLVideoElement, events: FrameSourceEvents = {}): Promise<FrameSource> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  const [track] = stream.getVideoTracks();
  let stopping = false;
  if (track) {
    track.addEventListener('ended', () => { if (!stopping) events.onLost?.(); });
    track.addEventListener('mute', () => { if (!stopping) events.onLost?.(); });
    track.addEventListener('unmute', () => { if (!stopping) events.onRestored?.(); });
  }
  video.srcObject = stream;
  await video.play();
  return {
    kind: 'camera',
    video,
    stop: () => {
      stopping = true;
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}

export async function openClip(video: HTMLVideoElement, file: File): Promise<FrameSource> {
  const url = URL.createObjectURL(file);
  video.srcObject = null;
  video.src = url;
  video.loop = true;
  await video.play();
  return {
    kind: 'clip',
    video,
    stop: () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    },
  };
}

/**
 * Grab the current frame, downscaled to ≤ maxWidth (aspect preserved). Returns null if the video has no frame yet.
 * Later steps use this: Q2 detector input, Q4 face blur, Q6 scene scan upload.
 */
export function grabFrame(video: HTMLVideoElement, maxWidth: number, canvas?: HTMLCanvasElement): HTMLCanvasElement | null {
  const { width, height } = scaledSize(video.videoWidth, video.videoHeight, maxWidth);
  if (width === 0 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  const c = canvas ?? document.createElement('canvas');
  if (c.width !== width) c.width = width;
  if (c.height !== height) c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  return c;
}

/** Encode a grabbed frame as JPEG (for uploads after face blur, Q4/Q6). */
export function frameToJpeg(canvas: HTMLCanvasElement, quality = 0.7): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
}
