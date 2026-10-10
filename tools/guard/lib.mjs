// Shared guardrail logic: used by Claude Code hooks, git hooks, CI, and npm scripts.
// Zero dependencies (Node >= 20).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';

export function git(args, cwd = process.cwd()) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024,
  });
}

export const ROOT = (() => {
  try { return git(['rev-parse', '--show-toplevel']).trim(); } catch { return process.cwd(); }
})();

export const STATUS_FILE = 'docs/STATUS.md';
export const DEADLINE = new Date('2026-10-18T23:59:00+08:00'); // hard deadline; time/timezone unconfirmed
export const TEAM_TARGET = new Date('2026-10-17T23:59:00+08:00');

// Branch naming: r<roadmap-id>-<slug>, or docs-/chore-/hotfix- prefixes. main is PR-only.
export const BRANCH_RE = /^(r\d+\.\d+-[a-z0-9][a-z0-9.-]*|(docs|chore|hotfix)-[a-z0-9][a-z0-9-]*)$/;
export const PROTECTED_BRANCH = 'main';

export function currentBranch() {
  try { return git(['symbolic-ref', '--short', 'HEAD'], ROOT).trim(); } catch { return ''; }
}

// Paths whose changes require a docs/STATUS.md update.
export const CODE_PATHS = /^(apps|services|packages|infra)\//;

// Files that must never be committed.
export const FORBIDDEN_PATHS = [
  { re: /(^|\/)\.env(\.(?!example$)[^/]+)?$/, why: 'environment file (secrets)' },
  { re: /\.(pem|key|p12|pfx|jks|keystore)$/i, why: 'private key / keystore' },
  { re: /(^|\/)(credentials|client_secret[^/]*|[^/]*service[-_]?account[^/]*|[^/]*-sa-key[^/]*)\.json$/i, why: 'cloud credentials' },
  { re: /(^|\/)\.private\//, why: 'private team notes' },
  { re: /(^|\/)\.ai-local\//, why: 'personal AI context dumps' },
  { re: /^temp\//, why: 'temporary inbox (may contain secrets)' },
  { re: /^data\/(?!README\.md$)/, why: 'local data (recordings may contain faces / location)' },
  { re: /\.(mp4|mov|avi|mkv|webm|heic)$/i, why: 'raw media (upload demo video to YouTube instead)' },
];

const SECRET_PATTERNS = [
  ['Google API key', /AIza[0-9A-Za-z_\-]{35}/],
  ['Google OAuth client secret', /GOCSPX-[A-Za-z0-9_\-]{20,}/],
  ['Service-account private key', /"private_key"\s*:\s*"-----BEGIN/],
  ['Private key block', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_\-]{20,}/],
  ['OpenAI-style API key', /\bsk-(?:proj-)?[A-Za-z0-9_\-]{32,}/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|github_pat_[A-Za-z0-9_]{50,}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /xox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Hard-coded credential', /(?:api[_-]?key|secret|token|passw(?:or)?d)\s*[:=]\s*["'][A-Za-z0-9_\-\/+=.]{24,}["']/i],
];
const ALLOW_MARKER = 'secret-scan:allow';
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMAIL_ALLOW = /(example\.(com|org|net)|noreply|users\.noreply\.github\.com|@anthropic\.com|hack2skill\.com)/i;

export function toRepoPath(p) {
  const rel = isAbsolute(p) ? relative(ROOT, p) : p;
  return rel.split('\\').join('/');
}

export function forbiddenReason(path) {
  const p = toRepoPath(path);
  const hit = FORBIDDEN_PATHS.find(f => f.re.test(p));
  return hit ? hit.why : null;
}

/** Returns [{line, name}] for secret-looking content. */
export function scanSecrets(text) {
  if (!text || text.includes('\u0000')) return [];
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    for (const [name, re] of SECRET_PATTERNS) if (re.test(line)) out.push({ line: i + 1, name });
  });
  return out;
}

/** Returns personal-looking emails (warning only). */
export function scanEmails(text) {
  if (!text || text.includes('\u0000')) return [];
  return [...new Set((text.match(EMAIL) || []).filter(e => !EMAIL_ALLOW.test(e)))];
}

export function isGitIgnored(path) {
  try { git(['check-ignore', '-q', toRepoPath(path)], ROOT); return true; } catch { return false; }
}

export function stagedFiles() {
  return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], ROOT).split('\n').filter(Boolean);
}

export function stagedContent(path) {
  try { return git(['show', `:${path}`], ROOT); } catch { return ''; }
}

export function trackedFiles() {
  return git(['ls-files'], ROOT).split('\n').filter(Boolean);
}

export function worktreeChanges() {
  return git(['status', '--porcelain=v1', '-uall'], ROOT).split('\n').filter(Boolean)
    .map(l => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());
}

export function diffAgainst(base) {
  return git(['diff', '--name-only', `${base}...HEAD`], ROOT).split('\n').filter(Boolean);
}

/** Docs-sync rule: code changes must come with a STATUS.md change. */
export function docsCheck(files) {
  const code = files.filter(f => CODE_PATHS.test(f));
  const statusTouched = files.includes(STATUS_FILE);
  return { ok: code.length === 0 || statusTouched, code };
}

export function readRepo(rel) {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

export function myHandle() {
  try { return git(['config', '--get', 'aicup.handle'], ROOT).trim(); } catch { return ''; }
}

/** Compact status brief (kept small on purpose — it is injected into every Claude session). */
export function brief() {
  const status = readRepo(STATUS_FILE);
  const phase = (status.match(/^Current phase:\s*(.+)$/m) || [])[1] || 'unknown';
  const open = status.split(/\r?\n/).filter(l => /^\s*- \[( |~|!)\]/.test(l));
  const active = open.filter(l => /\[(~|!)\]/.test(l));
  const todo = open.filter(l => /\[ \]/.test(l)).slice(0, Math.max(0, 6 - active.length));
  const day = 86400000;
  const now = Date.now();
  const toTarget = Math.ceil((TEAM_TARGET - now) / day);
  const toDeadline = Math.ceil((DEADLINE - now) / day);

  const lines = [
    `[Footprint · AI Builder Cup] ${toTarget} day(s) to team target (10-17), ${toDeadline} to hard deadline (10-18).`,
    `Phase: ${phase}`,
    'Open items:',
    ...[...active, ...todo].map(l => '  ' + l.trim()),
  ];
  const handle = myHandle();
  if (handle) {
    const h = readRepo(`docs/handoffs/${handle}.md`);
    const next = (h.split(/^## Next\s*$/m)[1] || '').split(/^## /m)[0].trim().split(/\r?\n/).slice(0, 6);
    if (next.length && next[0]) lines.push(`Your handoff (@${handle}) — Next:`, ...next.map(l => '  ' + l));
  } else {
    lines.push('No handle set: run `npm run setup -- --handle <github-handle>`.');
  }
  lines.push('Protocol: map the request to an R-id (docs/ROADMAP.md); none → flag DEVIATION. Update docs/STATUS.md with code changes. Advise to win, not to please.');
  return lines.join('\n');
}
