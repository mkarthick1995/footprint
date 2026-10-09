---
description: Self-review my feature branch against the roadmap, then open a PR to main (never merge)
---
Prepare and open a PR for my current work. Follow `docs/TEAM.md` → "Branch & PR workflow".

1. **Branch check.** `git branch --show-current`. If on `main`, stop and create `r<id>-short-name` first.
   Name must match `r<id>-name` / `docs-*` / `chore-*` / `hotfix-*`. Rebase on latest `origin/main`.
2. **Checks.** Run `npm run check`. Fix failures; never bypass hooks.
3. **Self-review vs roadmap.** Diff `origin/main...HEAD`. Read the roadmap item(s) in `docs/ROADMAP.md`.
   List every change that is outside the item's scope: new features, new dependencies, new env vars, interface or
   schema changes, ROADMAP/ADR edits. For **each** deviation:
   - the code site must carry `DEVIATION(ADR-0xx): <reason>` in a comment,
   - an ADR must exist in `docs/DECISIONS.md`.
   If any deviation lacks a reason, **stop and ask me to justify it or remove it**. Don't invent justifications.
4. **Safety review.** Run `docs/SAFETY.md` §7 on the diff: for each changed behaviour ask what happens when it is wrong,
   late, silent, offline, gets bad input, or meets an unknown case. Check ADR-012 forbidden outputs and privacy
   (faces, location, audio, logs). Update risk IDs / §4 limitations / §6 tests in this PR. Tell me about any
   negative scenario that isn't handled — don't paper over it.
5. **Docs.** Confirm `docs/STATUS.md` (my lines) and my handoff are updated.
6. **PR body.** Fill `.github/pull_request_template.md` completely, including "Safety review" (risk IDs or
   "none: reason"). Tick "This PR deviates" if step 3 found anything. Title: `type(scope): summary [R1.2]`.
7. **Open it.** If `gh` is available: `git push -u origin <branch>` then `gh pr create --base main --title … --body-file …`.
   Otherwise push and give me the body to paste on GitHub. **Never merge or approve** — the code owner does that.
