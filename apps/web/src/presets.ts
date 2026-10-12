// Alert levels the user chooses (Q14, ADR-026): stored only on this phone. P0 imminent alerts and system messages can
// never be turned off (enforced in the alert manager).
import type { AlertPreset } from '@footprint/shared';

export const PRESETS: readonly AlertPreset[] = ['essential', 'standard', 'detailed'];

export const PRESET_LABEL: Record<AlertPreset, string> = {
  essential: 'Essential',
  standard: 'Standard',
  detailed: 'Detailed',
};

/** Spoken when the level changes or a walk starts. */
export const PRESET_SPOKEN: Record<AlertPreset, string> = {
  essential: 'Alerts: Essential. Only urgent and close warnings.',
  standard: 'Alerts: Standard. Close and ahead warnings.',
  detailed: 'Alerts: Detailed. Everything, including surface and map notes.',
};

const KEY = 'footprint.preset';

export function loadPreset(): AlertPreset {
  try {
    const v = localStorage.getItem(KEY);
    return v && (PRESETS as readonly string[]).includes(v) ? (v as AlertPreset) : 'standard';
  } catch {
    return 'standard'; // storage blocked (private mode): default level
  }
}

export function savePreset(p: AlertPreset): void {
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* not persisted; still applied for this walk */
  }
}

/** One step quieter / more detailed (voice commands). */
export function stepPreset(p: AlertPreset, dir: 'fewer' | 'more'): AlertPreset {
  const i = PRESETS.indexOf(p) + (dir === 'fewer' ? -1 : 1);
  return PRESETS[Math.max(0, Math.min(PRESETS.length - 1, i))]!;
}
