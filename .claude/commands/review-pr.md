---
description: (Code owner) Thorough PR review — roadmap alignment and deviations first, then quality
argument-hint: <PR number or branch name>
---
Review PR $ARGUMENTS for the code owner. Be thorough and blunt; the owner decides.

**Get the change.** If `gh` exists: `gh pr view $ARGUMENTS --json title,body,headRefName,commits,files` and
`gh pr diff $ARGUMENTS`. Otherwise: `git fetch origin` and `git diff origin/main...origin/<branch>` plus
`git log origin/main..origin/<branch>`. Read only the roadmap items it claims (`docs/ROADMAP.md`) and the
ARCHITECTURE / DECISIONS sections it touches.

**Report in this order:**
1. **⚠️ Roadmap deviations (top of report).** Compare every changed area to the claimed item's scope and exit criteria.
   - *Declared* deviations: is the "Why" convincing? Does the ADR exist? Are `DEVIATION(ADR-0xx)` comments at each site?
   - *Undeclared* deviations: anything out of scope with no disclosure → list with `file:line`. These are must-fix.
   - For each: score impact (Tech 40 / Impact 25 / Innovation 25 / UX 10), time cost vs. deadline, recommendation
     (accept / move to another PR / drop).
2. **Hard requirements** (AGENTS.md §2): Gemini only at runtime, Cloud Run/Firebase, nothing pre-existing.
3. **Safety case (`docs/SAFETY.md`):** is the PR's "Safety review" honest and complete? Check against §1 principles,
   §2 fail-safe defaults (what happens when this code is wrong, late, silent, offline, or hits an unknown case?),
   ADR-012 forbidden outputs, and whether risk IDs / §4 limitations / §6 tests were updated. Name any negative
   scenario the author missed — these are must-fix for Critical/High.
4. **Security & privacy:** secrets, keys in browser, faces/frames leaving the device unblurred, PII, location
   precision, images/video/audio stored, logs, CORS, input validation, prompt injection.
5. **Correctness:** bugs, edge cases, alert latency, error handling.
6. **Docs sync:** STATUS / ARCHITECTURE / DECISIONS / SAFETY / README / `.env.example` match the code.
7. **Code quality:** readability, duplication, tests where cheap, consistency with the codebase.
8. **Verdict:** `APPROVE` / `REQUEST CHANGES` / `BLOCK`, with a numbered must-fix list and optional nits.

Do **not** approve, merge, or post comments on GitHub unless the owner explicitly asks. If asked to post,
use `gh pr review $ARGUMENTS --comment --body-file <file>` (comment only — approval is the owner's click).
