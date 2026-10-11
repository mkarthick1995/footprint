// Guard (R1.7, SAF-04/SEC-04/SAF-21): model-derived text may only reach the speaker through
// AlertOutput.sayModelText(), which always applies the safety filter. If this fails, route the new code through it.
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Only these files may touch the speech engine or the alert manager directly. `dev/` pages are test harnesses. */
const OWNERS = ['./alertOutput.ts', './speech.ts'];
const isDev = (p: string) => p.startsWith('./dev/');
const isTest = (p: string) => p.endsWith('.test.ts');

const outsiders = () => Object.entries(sources).filter(([p]) => !OWNERS.includes(p) && !isDev(p) && !isTest(p));

describe('single filtered path for model text', () => {
  it('finds the source files (guards against an empty glob passing silently)', () => {
    expect(Object.keys(sources)).toContain('./alertOutput.ts');
    expect(Object.keys(sources)).toContain('./main.ts');
  });

  it('AlertOutput exposes sayModelText and keeps the manager private', () => {
    const src = sources['./alertOutput.ts']!;
    expect(src).toMatch(/sayModelText\(/);
    expect(src).toMatch(/private readonly manager: AlertManager/);
  });

  it('nothing outside alertOutput.ts / speech.ts speaks or queues text directly', () => {
    const forbidden = /\b(speak|speechSynthesis|SpeechSynthesisUtterance)\b|\.system\(|\.modelText\(|new AlertManager\(/;
    const offenders = outsiders()
      .filter(([, text]) => forbidden.test(text))
      .map(([p]) => p);
    expect(offenders).toEqual([]);
  });

  it('model text is never passed to the system-message path', () => {
    // Fixed wording only: output.say(...) callers must not pass anything derived from a model response.
    const offenders = outsiders()
      .filter(([, text]) => /\b(?:response|answer|transcript|scan|gemini)\w*\b[^;\n]*\.say\(|\.say\([^)]*\b(?:response|answer|transcript|gemini)\w*/i.test(text))
      .map(([p]) => p);
    expect(offenders).toEqual([]);
  });
});
