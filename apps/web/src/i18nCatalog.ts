// Every fixed English sentence the app can say or show (R3.2). The translator script (tools/i18n/translate.mjs)
// translates exactly this list, and a test checks every offered language covers all of it.
import {
  batteryMessage,
  DEMAND_HEADS_UP,
  FALLBACK_TEXT,
  HOT_MESSAGE,
  ladderMessage,
  messageKey,
  SLOW_MESSAGE,
} from '@footprint/shared';
import { VOICE_FAILED } from './alertOutput';
import { GPS_LOST_MESSAGE } from './health';
import { ASK_MESSAGES } from './liveAsk';
import { cameraErrorMessage, MESSAGES } from './messages';
import { PRESET_SPOKEN } from './presets';

export function englishMessages(): string[] {
  const ladder = (['covered', 'dark', 'ground', 'sky', 'blurred', 'frozen'] as const).map((r) => ladderMessage({ level: 'L2', reasons: [r] }, 'L0'));
  ladder.push(
    ladderMessage({ level: 'L3', reasons: ['detector'] }, 'L0'),
    ladderMessage({ level: 'L1', reasons: ['scene'] }, 'L0'),
    ladderMessage({ level: 'L0', reasons: [] }, 'L1'),
    ladderMessage({ level: 'L0', reasons: [] }, 'L2'),
    ladderMessage({ level: 'L0', reasons: [] }, 'L3'),
  );
  const camera = ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'Other'].map((name) => cameraErrorMessage({ name }));
  camera.push(cameraErrorMessage(null, false));
  const all = [
    ...Object.values(MESSAGES),
    ...Object.values(ASK_MESSAGES),
    ...Object.values(PRESET_SPOKEN),
    ...Object.values(FALLBACK_TEXT),
    ...camera,
    ...ladder,
    batteryMessage(0.15),
    batteryMessage(0.05),
    SLOW_MESSAGE,
    HOT_MESSAGE,
    GPS_LOST_MESSAGE,
    VOICE_FAILED,
    DEMAND_HEADS_UP,
  ];
  return [...new Map(all.map((t) => [messageKey(t), t])).values()];
}
