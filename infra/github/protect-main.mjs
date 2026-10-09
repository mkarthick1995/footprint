#!/usr/bin/env node
// One-time (owner only): protect main on GitHub. Requires the GitHub CLI (`gh auth login`) and admin rights.
//   node infra/github/protect-main.mjs <owner>/<repo>
// Manual alternative: see docs/TEAM.md → "Branch protection".
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repo = process.argv[2];
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) {
  console.error('usage: node infra/github/protect-main.mjs <owner>/<repo>');
  process.exit(1);
}
const gh = (args) => execFileSync('gh', args, { stdio: 'inherit' });

// Repo settings: squash-only merges, auto-delete merged branches.
gh(['api', '-X', 'PATCH', `repos/${repo}`,
  '-F', 'allow_squash_merge=true', '-F', 'allow_merge_commit=false', '-F', 'allow_rebase_merge=false',
  '-F', 'delete_branch_on_merge=true']);

const protection = {
  required_status_checks: { strict: true, contexts: ['secrets', 'docs-sync', 'pr-guard'] },
  enforce_admins: false, // the owner can still bypass in an emergency (and for their own PRs)
  required_pull_request_reviews: {
    required_approving_review_count: 1,
    require_code_owner_reviews: true, // CODEOWNERS → owner approval is mandatory
    dismiss_stale_reviews: true, // new pushes invalidate an old approval
    require_last_push_approval: true,
  },
  restrictions: null,
  required_linear_history: true,
  required_conversation_resolution: true,
  allow_force_pushes: false,
  allow_deletions: false,
};
const file = join(mkdtempSync(join(tmpdir(), 'protect-')), 'protection.json');
writeFileSync(file, JSON.stringify(protection));
gh(['api', '-X', 'PUT', `repos/${repo}/branches/main/protection`, '--input', file]);
console.log(`✔ main protected on ${repo}: PR-only, code-owner approval, checks secrets/docs-sync/pr-guard.`);
