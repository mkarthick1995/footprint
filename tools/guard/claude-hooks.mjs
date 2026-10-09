#!/usr/bin/env node
// Claude Code hook adapter. Wired in .claude/settings.json.
//   session-start · prompt · pre-tool · stop
import { brief, docsCheck, forbiddenReason, isGitIgnored, scanSecrets, worktreeChanges, STATUS_FILE } from './lib.mjs';

async function readInput() {
  if (process.stdin.isTTY) return {};
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

const block = (msg) => { process.stderr.write(msg + '\n'); process.exit(2); };

const event = process.argv[2];
const input = await readInput();

switch (event) {
  case 'session-start':
    process.stdout.write(brief() + '\n');
    break;

  case 'prompt':
    process.stdout.write('[guard] Map this request to a docs/ROADMAP.md item ID; if none, flag ⚠️ DEVIATION (AGENTS.md §4) before acting. Keep docs/STATUS.md current. Challenge choices that cost score.\n');
    break;

  case 'pre-tool': {
    const tool = input.tool_name || '';
    const ti = input.tool_input || {};

    if (tool === 'Bash' || tool === 'PowerShell') {
      const cmd = String(ti.command || '');
      const seg = '[^|;&\\n]*';
      if (new RegExp(`\\bgit\\b${seg}\\bcommit\\b${seg}(--no-verify|\\s-n\\b)`).test(cmd)) {
        block('Blocked: committing with --no-verify bypasses the team guardrails. Fix the hook failure instead.');
      }
      if (new RegExp(`\\bgit\\b${seg}\\badd\\b${seg}(\\s-f\\b|--force)`).test(cmd)) {
        block('Blocked: `git add --force` would commit gitignored (possibly secret/private) files.');
      }
      if (new RegExp(`\\bgit\\b${seg}\\bpush\\b${seg}(--force\\b|\\s-f\\b|--force-with-lease)`).test(cmd)) {
        block('Blocked: force-push rewrites shared history. Ask the user to do it manually if truly needed.');
      }
      if (new RegExp(`\\bgit\\b${seg}\\bpush\\b${seg}(\\s|:)main\\b`).test(cmd)) {
        block('Blocked: main only changes through reviewed PRs. Push the feature branch and use /open-pr.');
      }
      if (/\bALLOW_(MAIN_COMMIT|MAIN_PUSH|NO_STATUS)\b/.test(cmd)) {
        block('Blocked: ALLOW_* overrides are for the repo owner to run manually, never by an AI assistant.');
      }
      if (/\bgh\s+pr\s+(merge|review\s+[^|;&\n]*--approve)/.test(cmd)) {
        block('Blocked: merging and approving PRs is the code owner\'s decision. Report your review; the owner acts on GitHub.');
      }
      if (new RegExp(`\\b(cat|type|less|more|head|tail|grep|rg|sed|awk|bat|source|Get-Content|gc)\\b${seg}\\.env(?!\\.example)\\b`).test(cmd)) {
        block('Blocked: do not read .env into the conversation (secrets). Use .env.example for variable names.');
      }
      break;
    }

    if (['Write', 'Edit', 'MultiEdit'].includes(tool)) {
      const file = ti.file_path || '';
      if (file && isGitIgnored(file)) break; // local-only files (e.g. .env) may hold secrets
      const why = file && forbiddenReason(file);
      if (why) block(`Blocked: ${file} is a ${why} path but is not gitignored. Fix .gitignore first.`);
      const texts = [ti.content, ti.new_string, ...((ti.edits || []).map(e => e.new_string))].filter(Boolean);
      const hits = texts.flatMap(t => scanSecrets(t));
      if (hits.length) {
        block(`Blocked: content for ${file} looks like it contains a secret (${[...new Set(hits.map(h => h.name))].join(', ')}).
Put the value in .env (gitignored) and read it via process.env; add only the variable NAME to .env.example.`);
      }
    }
    break;
  }

  case 'stop': {
    if (input.stop_hook_active) break; // avoid loops: we already asked once
    let files = [];
    try { files = worktreeChanges(); } catch { break; }
    const r = docsCheck(files);
    if (!r.ok) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: `Code changed (${r.code.slice(0, 5).join(', ')}) but ${STATUS_FILE} was not updated. Update the checklist line(s) for the roadmap item (and ARCHITECTURE.md / DECISIONS.md if affected), then refresh your handoff — or tell the user explicitly why no doc change is needed.`,
      }));
    }
    break;
  }

  default:
    break;
}
