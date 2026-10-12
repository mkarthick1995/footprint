import { describe, expect, it } from 'vitest';
import { parseVoiceCommand } from './live.js';

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
