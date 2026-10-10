// Frame source abstraction (ADR-016): the rest of the pipeline doesn't know whether frames come from the
// phone camera or a recorded clip, so PC development and tests run on clips and phones run on the camera.

export type FrameSourceKind = 'camera' | 'clip';

export interface FrameSource {
  kind: FrameSourceKind;
  video: HTMLVideoElement;
  stop(): void;
}

export async function openCamera(video: HTMLVideoElement): Promise<FrameSource> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return {
    kind: 'camera',
    video,
    stop: () => stream.getTracks().forEach((t) => t.stop()),
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
      URL.revokeObjectURL(url);
    },
  };
}
