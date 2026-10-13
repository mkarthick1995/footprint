import { describe, expect, it } from 'vitest';
import { parseVoiceCommand } from './live.js';
import { parseModelCommand } from './live.js';

describe('voice commands for alert levels (Q14)', () => {
  it.each([
    ['Fewer alerts.', 'fewer'], ['less warnings please', 'fewer'], ['Be quieter', 'fewer'], ['essential only', 'fewer'],
    ['More alerts', 'more'], ['Tell me more', 'more'], ['more detail please', 'more'],
    ['What level is it?', 'level'], ['which alert level', 'level'],
  ])('%s → %s', (q, cmd) => expect(parseVoiceCommand(q)).toBe(cmd));

  it('real questions are not commands', () => {
    for (const q of ["What's in front of me?", 'Is there a footpath on my left?', 'Are there more shops ahead on this street near the station?', undefined, '']) {
      expect(parseVoiceCommand(q)).toBeNull();
    }
  });
});

describe('commands from Gemini replies (ADR-037)', () => {
  it.each([
    ['Command: fewer alerts.', { kind: 'fewer' }],
    ['command fewer alerts', { kind: 'fewer' }],
    ['Command: more alerts.', { kind: 'more' }],
    ['Command: alert level.', { kind: 'level' }],
    ['Command: route to Chinatown MRT station.', { kind: 'route', destination: 'Chinatown MRT station' }],
    ['Command: route to nearest bus stop.', { kind: 'route', destination: 'nearest bus stop' }],
    ['Command: something else.', { kind: 'unclear' }],
    ['Command: route to .', { kind: 'unclear' }],
  ])('%s', (text, expected) => expect(parseModelCommand(text)).toEqual(expected));
  it('ordinary answers are not commands', () => {
    for (const t of ['There is a kerb on your left.', 'The command post is ahead.', '', undefined]) expect(parseModelCommand(t)).toBeNull();
  });
});
