---
description: Pick the first unclaimed build-queue step, claim it (branch + STATUS + draft PR), and start its DoD
---
Pick up the next piece of work (ADR-031, `docs/STATUS.md` → "How to pick up work").

1. `git fetch origin --prune`, `git switch main && git pull`. Read the **Build queue** in `docs/STATUS.md`.
2. Find claims: STATUS lines marked `[~]`, remote branches (`git branch -r`), and open PRs (`gh pr list` if available,
   otherwise the GitHub MCP / API). A step with any of these is taken — skip it.
3. Choose the **first unclaimed `[ ]` step**. If it is blocked by an unfinished earlier step, say so and pick the next
   unblocked one. Tell me which step and its DoD in ≤ 5 lines; then wait for my "go".
4. On "go": create `r<roadmap-id>-<slug>` from fresh main; set the step line to
   `[~] … — @<handle> claimed <today>` (handle: `git config aicup.handle`); commit `chore: claim Qn [R?.?]`; push;
   open a **draft PR** titled `Qn R?.? <title>` using the PR template. This is the lock others will see.
5. Run the SAFETY.md §7 review for the step, then build it until **every DoD item** is met, with tests.
   Keep STATUS, ARCHITECTURE, SAFETY (risk IDs / ST results), DECISIONS and `.env.example` current in the same branch.
6. When done: set the line to `[x] … — @<handle> <today>` with measured numbers (fps, latency, cost) where the DoD asks,
   then `/open-pr` (tick "fully completes", mark ready). If you must stop early, release the step (STATUS rule 5).
