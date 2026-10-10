---
description: (Code owner) Verify a PR before merging — DoD, tests, safety, docs — then advise merge or changes
argument-hint: <PR number>
---
Verify PR $ARGUMENTS for the code owner before merge (ADR-031). Be strict: a step is fully done or not done.

1. **Fetch and run.** `git fetch origin`, check out the PR branch in a temporary worktree
   (`git worktree add ../verify-$ARGUMENTS origin/<branch>`), then `npm ci && npm run typecheck && npm test && npm run build`.
   Report pass/fail with the failing output. Remove the worktree at the end.
2. **DoD audit.** Find the step(s) the PR claims in `docs/STATUS.md`. For **each DoD item**: met / not met / not
   verifiable, with evidence (file:line, test name, measured number). Any "not met" → REQUEST CHANGES.
3. **Safety.** Run the `/review-pr` safety section: SAFETY.md §1/§2, ADR-012 outputs, privacy (faces, location, audio,
   logs), risk IDs and ST results updated honestly. Missed Critical/High scenario → REQUEST CHANGES.
4. **Docs + checklist.** STATUS line set to `[x]` with numbers where required; ARCHITECTURE / DECISIONS / SAFETY /
   `.env.example` / README match the code; no undeclared deviation.
5. **Live check (after merge).** Remind me to run `npm run deploy`, then smoke-test the step on the live URL
   (and on a phone if the step touches camera, audio, or sensors).
6. **Verdict:** `MERGE` / `REQUEST CHANGES` / `BLOCK` + numbered must-fix list. Don't approve or merge on GitHub yourself;
   if I ask, post the report as a PR comment (`gh pr review $ARGUMENTS --comment`).
