#!/usr/bin/env node
// One-time per clone:  npm run setup -- --handle <github-handle>
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, ROOT } from './guard/lib.mjs';

const argv = process.argv.slice(2);
const i = argv.indexOf('--handle');
let handle = i >= 0 ? (argv[i + 1] || '').replace(/^@/, '') : '';
const say = (m) => console.log(`• ${m}`);

// 1. Git hooks
git(['config', 'core.hooksPath', '.githooks'], ROOT);
for (const f of readdirSync(join(ROOT, '.githooks'))) {
  try { chmodSync(join(ROOT, '.githooks', f), 0o755); } catch { /* Windows: not needed */ }
}
say('git hooks enabled (core.hooksPath=.githooks)');

// 2. Local-only folders + .env
for (const d of ['.ai-local', '.private', 'data']) mkdirSync(join(ROOT, d), { recursive: true });
if (!existsSync(join(ROOT, '.env'))) {
  copyFileSync(join(ROOT, '.env.example'), join(ROOT, '.env'));
  say('.env created from .env.example — fill in your keys (never commit it)');
} else say('.env already exists (left untouched)');

// 3. Handle + handoff file
if (!handle) {
  try { handle = git(['config', '--get', 'aicup.handle'], ROOT).trim(); } catch { /* none */ }
}
if (handle) {
  git(['config', 'aicup.handle', handle], ROOT);
  const file = join(ROOT, 'docs', 'handoffs', `${handle}.md`);
  if (!existsSync(file)) {
    const tpl = readFileSync(join(ROOT, 'docs', 'handoffs', 'TEMPLATE.md'), 'utf8').replace('@handle', `@${handle}`);
    writeFileSync(file, tpl);
    say(`created docs/handoffs/${handle}.md`);
  }
  say(`handle = @${handle}`);
} else {
  say('No handle given. Re-run: npm run setup -- --handle <your-github-handle>');
}

console.log('\nNext: open Claude Code or Gemini CLI in the repo root and run /resume.');
