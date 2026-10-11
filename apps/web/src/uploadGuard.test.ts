// Guard (R1.8, PRI-01): raw frame access and image encoding stay inside frameSource.ts and faceBlur.ts, so nothing that
// uploads can bypass the face blur. If this fails, route the new code through FaceBlurrer.getUploadFrame/getUploadJpeg.
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const ALLOWED = ['./frameSource.ts', './faceBlur.ts'];
/** Anything that can turn pixels into bytes or hand out a raw frame. */
const FORBIDDEN = /\b(grabFrame|frameToJpeg|toBlob|toDataURL|convertToBlob|createImageBitmap)\s*\(/;

describe('upload guard', () => {
  it('finds the source files (guards against an empty glob passing silently)', () => {
    expect(Object.keys(sources)).toContain('./faceBlur.ts');
    expect(Object.keys(sources)).toContain('./main.ts');
  });

  it('keeps raw-frame and image-encoding calls inside frameSource.ts and faceBlur.ts', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !ALLOWED.includes(path) && !path.endsWith('.test.ts'))
      .filter(([, text]) => FORBIDDEN.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
