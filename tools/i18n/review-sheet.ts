// Writes docs/i18n-review.md: every translation beside its English source, most safety-critical first (R3.2).
import { writeFileSync } from 'node:fs';
import { commonAlertSpecs, LANGUAGES, phraseText, UI_EN, type LangCode } from '../../packages/shared/src/index';
import { I18N_DATA } from '../../packages/shared/src/i18nData';

const CRITICAL = /Stop!|cane|cross|safe|signal|Camera can't|dark|ground|points up|stopped|Alerts are off|not running|Location|Battery/i;
const rows: string[] = [
  '# Translation review (R3.2)',
  '',
  'Machine-translated by Gemini. A native speaker checks each language before it counts as **checked** in',
  '`docs/STATUS.md`. For each row: is it correct, natural *spoken* language, and short? Write a correction in the last',
  'column (or "ok"). Section 1 matters most — a wrong "Stop!" or safety line is a safety problem.',
  '',
  'How the alerts are built: a word for the thing (e.g. "bike"), a side (left / right / ahead / nearby) and a pattern.',
  'Section 1 shows real alerts built from those parts.',
  '',
];
const pipe = (s: string) => s.replace(/\|/g, '\|');
for (const { code, name } of LANGUAGES) {
  if (code === 'en-IN') continue;
  const d = I18N_DATA[code as LangCode]!;
  rows.push(`## ${name} (${code})`, '', '### 1. Alerts and safety lines', '', '| English | ' + name + ' | Correction |', '| --- | --- | --- |');
  const seen = new Set<string>();
  for (const s of commonAlertSpecs()) {
    const en = phraseText(s);
    if (seen.has(en) || (s.tier !== 'P0' && s.type !== 'person' && s.type !== 'cyclist')) continue;
    seen.add(en);
    rows.push(`| ${pipe(en)} | ${pipe(phraseText(s, code as LangCode))} | |`);
  }
  const msgs = Object.entries(d.messages);
  for (const [en, t] of msgs.filter(([en]) => CRITICAL.test(en))) rows.push(`| ${pipe(en)} | ${pipe(t)} | |`);
  rows.push('', '### 2. Other messages', '', '| English | ' + name + ' | Correction |', '| --- | --- | --- |');
  for (const [en, t] of msgs.filter(([en]) => !CRITICAL.test(en))) rows.push(`| ${pipe(en)} | ${pipe(t)} | |`);
  rows.push('', '### 3. Route summary and page text', '', '| English | ' + name + ' | Correction |', '| --- | --- | --- |');
  for (const [k, en] of Object.entries(UI_EN)) rows.push(`| ${pipe(en)} | ${pipe(d.ui[k as keyof typeof UI_EN] ?? '')} | |`);
  for (const [k, t] of Object.entries(d.route)) rows.push(`| route.${k} | ${pipe(t)} | |`);
  rows.push('');
}
writeFileSync(new URL('../../docs/i18n-review.md', import.meta.url), rows.join('\n'));
console.log('rows', rows.length);
