import { describe, expect, it } from 'vitest';
import { cameraErrorMessage, scaledSize } from './messages';

describe('cameraErrorMessage (fail loud)', () => {
  it('explains permission denial', () => {
    expect(cameraErrorMessage({ name: 'NotAllowedError' })).toMatch(/permission was denied/);
  });
  it('explains a missing camera', () => {
    expect(cameraErrorMessage({ name: 'NotFoundError' })).toMatch(/No usable camera/);
  });
  it('explains a busy camera', () => {
    expect(cameraErrorMessage({ name: 'NotReadableError' })).toMatch(/busy/);
  });
  it('requires https', () => {
    expect(cameraErrorMessage(null, false)).toMatch(/https/);
  });
  it('still speaks for unknown errors and null input', () => {
    expect(cameraErrorMessage(new Error('weird'))).toMatch(/not running/);
    expect(cameraErrorMessage(null)).toMatch(/not running/);
  });
});

describe('scaledSize', () => {
  it('downscales keeping aspect ratio', () => {
    expect(scaledSize(1280, 720, 640)).toEqual({ width: 640, height: 360 });
  });
  it('never upscales', () => {
    expect(scaledSize(320, 240, 640)).toEqual({ width: 320, height: 240 });
  });
  it('handles a video that has no size yet', () => {
    expect(scaledSize(0, 0, 640)).toEqual({ width: 0, height: 0 });
  });
});
