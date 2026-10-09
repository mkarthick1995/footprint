#!/usr/bin/env node
// Guard CLI — used by git hooks, CI, and npm scripts.
//   node tools/guard/cli.mjs pre-commit
//   node tools/guard/cli.mjs commit-msg <file>
//   node tools/guard/cli.mjs pre-push            (reads git's stdin)
//   node tools/guard/cli.mjs scan --all | --staged
//   node tools/guard/cli.mjs docs --staged | --worktree | --base <ref>
//   node tools/guard/cli.mjs pr-guard <base-ref>  (CI; env PR_TITLE, PR_BODY, PR_HEAD_REF)
//   node tools/guard/cli.mjs brief
import { appendFileSync, readFileSync } from 'node:fs';
import {
  BRANCH_RE, CODE_PATHS, PROTECTED_BRANCH, brief, currentBranch, diffAgainst, docsCheck, forbiddenReason, git,
  readRepo, scanEmails, scanSecrets, stagedContent, stagedFiles, trackedFiles, worktreeChanges, ROOT, STATUS_FILE,
} from './lib.mjs';

const [cmd, ...args] = process.argv.slice(2);
const fail = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

function scan(files, getText) {
  const errors = [];
  const warnings = [];
  for (const f of files) {
    const why = forbiddenReason(f);
    if (why) { errors.push(`${f}: forbidden file (${why})`); continue; }
    const text = getText(f);
    for (const hit of scanSecrets(text)) errors.push(`${f}:${hit.line}: looks like a ${hit.name}`);
    for (const e of scanEmails(text)) warnings.push(`${f}: personal-looking email "${e}" — public repo, is that intended?`);
  }
  warnings.forEach(w => console.warn(`⚠ ${w}`));
  return errors;
}

function docs(files, label) {
  const r = docsCheck(files);
  if (r.ok) return;
  if (process.env.ALLOW_NO_STATUS === '1') {
    console.warn(`⚠ ALLOW_NO_STATUS=1: skipping docs check (${label}). Explain why in the commit/PR.`);
    return;
  }
  fail(`Code changed (${r.code.slice(0, 5).join(', ')}${r.code.length > 5 ? ', …' : ''}) but ${STATUS_FILE} was not updated (${label}).
  Update the checklist line(s) for your roadmap item — see AGENTS.md §5.`);
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

switch (cmd) {
  case 'pre-commit': {
    const branch = currentBranch();
    if (branch === PROTECTED_BRANCH && process.env.ALLOW_MAIN_COMMIT !== '1') {
      fail(`Direct commits to "${PROTECTED_BRANCH}" are not allowed — main changes only via reviewed PRs.
  Create a feature branch:  git switch -c r1.2-short-name   (see docs/TEAM.md)`);
    }
    if (branch && branch !== PROTECTED_BRANCH && !BRANCH_RE.test(branch)) {
      console.warn(`⚠ Branch "${branch}" doesn't follow r<id>-name / docs-* / chore-* / hotfix-*. CI will reject the PR.`);
    }
    const files = stagedFiles();
    const errors = scan(files, stagedContent);
    if (errors.length) {
      fail(`Commit blocked — possible secrets / private files:\n  ${errors.join('\n  ')}
  Move secrets to .env (gitignored). If it is a false positive, add "secret-scan:allow" on that line.`);
    }
    docs(files, 'staged');
    break;
  }
  case 'commit-msg': {
    const msg = readFileSync(args[0], 'utf8').split(/\r?\n/).filter(l => !l.startsWith('#')).join('\n').trim();
    const first = msg.split('\n')[0];
    if (/^(Merge|Revert|fixup!|squash!)/.test(first)) break;
    if (/\bR\d+\.\d+\b/.test(msg) || /\[(docs|chore|off-roadmap)\]/.test(msg)) {
      if (/\[off-roadmap\]/.test(msg)) {
        console.warn('⚠ [off-roadmap] commit: add an ADR in docs/DECISIONS.md and declare the deviation in the PR (AGENTS.md §4).');
      }
      break;
    }
    fail(`Commit message needs a roadmap ID (e.g. [R1.2]) or [docs] / [chore] / [off-roadmap].
  Example: feat(web): add proximity alerts [R1.2]
  Roadmap: docs/ROADMAP.md`);
    break;
  }
  case 'pre-push': {
    // stdin lines: <local ref> <local sha> <remote ref> <remote sha>
    const lines = (await readStdin()).split('\n').filter(Boolean);
    const toMain = lines.some(l => l.split(' ')[2] === `refs/heads/${PROTECTED_BRANCH}`);
    if (toMain && process.env.ALLOW_MAIN_PUSH !== '1') {
      fail(`Pushing to "${PROTECTED_BRANCH}" is not allowed. Push your feature branch and open a PR:
  git push -u origin <your-branch>   then /open-pr`);
    }
    break;
  }
  case 'scan': {
    const all = args.includes('--all');
    const files = all ? trackedFiles() : stagedFiles();
    const errors = scan(files, all ? readRepo : stagedContent);
    if (errors.length) fail(`Secret scan failed:\n  ${errors.join('\n  ')}`);
    console.log(`✔ secret scan clean (${files.length} files)`);
    break;
  }
  case 'docs': {
    if (args[0] === '--base') docs(diffAgainst(args[1]), `vs ${args[1]}`);
    else if (args[0] === '--staged') docs(stagedFiles(), 'staged');
    else docs(worktreeChanges(), 'working tree');
    console.log('✔ docs in sync');
    break;
  }
  case 'pr-guard': {
    // Roadmap alignment + deviation disclosure for a PR. Runs in CI on every PR open/update/edit.
    const base = args[0];
    const title = process.env.PR_TITLE || '';
    const body = process.env.PR_BODY || '';
    const head = process.env.PR_HEAD_REF || currentBranch();
    const problems = [];

    if (!BRANCH_RE.test(head)) problems.push(`Branch "${head}" must be r<id>-name (e.g. r1.2-camera), docs-*, chore-* or hotfix-*.`);

    const text = `${title}\n${body}`;
    const ids = [...new Set(text.match(/\bR\d+\.\d+\b/g) || [])];
    if (!ids.length && !/\[(docs|chore|off-roadmap)\]/.test(text)) {
      problems.push('PR title/body must reference a roadmap item (e.g. R1.2) or [docs] / [chore] / [off-roadmap].');
    }

    const files = diffAgainst(base);
    const commits = git(['log', '--format=%B', `${base}..HEAD`], ROOT);
    const added = git(['diff', '-U0', `${base}...HEAD`], ROOT).split('\n');
    const devComments = [];
    let file = '';
    // Only real code counts: docs/prompts that *describe* the DEVIATION(...) convention are not deviations.
    for (const l of added) {
      if (l.startsWith('+++ b/')) file = l.slice(6);
      else if (l.startsWith('+') && !l.startsWith('+++') && CODE_PATHS.test(file) && /DEVIATION\(/.test(l)) {
        devComments.push(`${file}: ${l.slice(1).trim()}`);
      }
    }

    const signals = [];
    if (/\[off-roadmap\]/.test(commits + title)) signals.push('[off-roadmap] in commits/title');
    if (devComments.length) signals.push(`${devComments.length} DEVIATION(...) code comment(s)`);
    if (files.includes('docs/ROADMAP.md')) signals.push('docs/ROADMAP.md changed');

    const declared = /-\s*\[x\]\s*This PR deviates/i.test(body);
    const why = ((body.match(/^\s*\**Why:?\**:?\s*(.*)$/mi) || [])[1] || '').replace(/<!--.*?-->/g, '').trim();
    if (signals.length && !declared) {
      problems.push(`Undeclared deviation (${signals.join('; ')}). Tick "This PR deviates" in the PR body and explain why.`);
    }
    if (declared) {
      if (!why) problems.push('Deviation declared but the "Why:" line is empty.');
      if (!files.includes('docs/DECISIONS.md')) problems.push('Deviation declared but no ADR was added to docs/DECISIONS.md.');
    }

    // Safety review (docs/SAFETY.md §7) is mandatory for code changes.
    const codeChanged = files.some(f => CODE_PATHS.test(f));
    const riskIds = ((body.match(/^\s*\**Risk IDs:?\**:?\s*(.*)$/mi) || [])[1] || '').replace(/<!--.*?-->/g, '').trim();
    if (codeChanged && !riskIds) {
      problems.push('Code changed but the "Risk IDs:" line in the Safety review section is empty. List affected risk IDs from docs/SAFETY.md or write "none: <reason>".');
    }

    const summary = [
      '## PR roadmap guard',
      `**Roadmap items:** ${ids.join(', ') || '—'}`,
      `**Deviation:** ${declared ? '⚠️ DECLARED — owner review required' : signals.length ? '⛔ UNDECLARED' : '✅ none detected'}`,
      declared && why ? `**Why:** ${why}` : '',
      `**Safety review — Risk IDs:** ${riskIds || (codeChanged ? '⛔ missing' : '— (no code changed)')}`,
      signals.length ? `**Signals:** ${signals.join('; ')}` : '',
      devComments.length ? '**DEVIATION comments:**\n' + devComments.slice(0, 15).map(d => `- \`${d}\``).join('\n') : '',
      `**Files changed:** ${files.length}`,
      problems.length ? '### ✖ Problems\n' + problems.map(p => `- ${p}`).join('\n') : '### ✔ Passed',
    ].filter(Boolean).join('\n\n');
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
    console.log(summary);
    if (problems.length) fail('PR guard failed — see problems above.');
    break;
  }
  case 'brief':
    console.log(brief());
    break;
  default:
    fail('usage: cli.mjs pre-commit | commit-msg <file> | pre-push | scan --all|--staged | docs --staged|--worktree|--base <ref> | pr-guard <base> | brief');
}
