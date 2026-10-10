// On-device object detection (ADR-019 layer 1, Q2). MediaPipe EfficientDet-Lite0 (COCO), GPU with CPU fallback.
import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision';
import type { Detection } from '@footprint/shared';

/** Self-hosted runtime (copied by scripts/copy-mediapipe.mjs). */
const WASM_BASE = '/mediapipe/wasm';
/** Google-hosted model file (cached by the browser after first load). */
export const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';

export interface OnDeviceDetector {
  delegate: 'GPU' | 'CPU';
  detect(video: HTMLVideoElement, tsMs: number): Detection[];
  close(): void;
}

export async function createDetector(): Promise<OnDeviceDetector> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const make = (delegate: 'GPU' | 'CPU') =>
    ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      scoreThreshold: 0.35,
      maxResults: 10,
    });
  let delegate: 'GPU' | 'CPU' = 'GPU';
  let od: ObjectDetector;
  try {
    od = await make('GPU');
  } catch {
    delegate = 'CPU';
    od = await make('CPU');
  }
  return {
    delegate,
    detect(video, tsMs) {
      const res = od.detectForVideo(video, tsMs);
      return res.detections.flatMap((d) => {
        const b = d.boundingBox;
        const c = d.categories[0];
        if (!b || !c) return [];
        return [{ box: { x: b.originX, y: b.originY, w: b.width, h: b.height }, label: c.categoryName, score: c.score }];
      });
    },
    close: () => od.close(),
  };
}
