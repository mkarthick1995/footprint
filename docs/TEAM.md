# Team & collaboration

Use **GitHub handles only** in this repo (public). Personal details (phones, emails, employer) → `.private/` (gitignored).
Short-lived files you want an AI to pick up (notes, keys to move into `.env`) → `temp/` (gitignored; consumed files get deleted).

| Role | Handle | Workstream (proposed — confirm in R0.4) |
|---|---|---|
| A — Lead, **code owner & mandatory PR approver** | @mkarthick1995 | GCP/infra, Cloud Run API, Gemini Live, submission (R0.x, R1.4–R1.5, R2.2, R4.4–R4.6) |
| B | @member-b *(replace)* | PWA client: camera, on-device detection, alerts, glasses stretch (R1.1–R1.3, R3.1, R3.3) |
| C | @member-c *(pending invite)* | Maps & directions, Firestore, hazard map, video + deck (R2.1, R2.3–R2.5, R4.2–R4.3) |

## Onboarding (10 minutes)
1. Clone the repo, then `npm run setup -- --handle <your-github-handle>`
   (enables git hooks, creates `.env` from `.env.example`, creates your handoff file).
   Then keep your personal email out of the public history:
   `git config user.email "<id>+<handle>@users.noreply.github.com"` (exact address: github.com/settings/emails).
   Install dependencies: `npm install` (Node 22). Daily commands: `npm run dev:web`, `npm run dev:api`, `npm test`.
2. Fill `.env` with keys from the lead (shared privately — **never** over chat that gets committed anywhere).
3. Open your AI tool in the repo root. Claude Code reads `CLAUDE.md`; Gemini CLI reads `GEMINI.md`; both import `AGENTS.md`.
4. Run `/resume`.

## Daily rhythm
- **Async stand-up = your handoff file.** Update it at the end of every session; read teammates' before starting.
- One short sync call per day (15 min): blockers, scope changes, demo-readiness.
- Scope changes are decided together and recorded as an ADR.

## Who builds what (ADR-031)
Nobody is pre-assigned. When you're free, run `/next` in your AI tool: it takes the first unclaimed step of the build
queue in `docs/STATUS.md`, claims it (branch + STATUS line + draft PR) and works through its Definition of Done.
Finish the whole step, then `/open-pr` and mark the PR ready. Tell the team in chat which step you finished.
Can't finish? Release it as described in STATUS — never leave a half-done step claimed silently.

## Branch & PR workflow (mandatory)
**`main` is protected. Nobody commits or pushes to it directly. Every change arrives via a PR approved by the
code owner (@mkarthick1995 — see `.github/CODEOWNERS`).**

```
main ─────────●─────────────●──────────────●───►   (squash-merged PRs only, always deployable)
               \           / \            /
    r1.2-detect ●──●──●──●    r2.3-hazards ●──●
```
1. Start from fresh main: `git switch main && git pull` → `git switch -c r1.2-on-device-detection`.
   Names: `r<roadmap-id>-<slug>` · `docs-<slug>` · `chore-<slug>` · `hotfix-<slug>`. One roadmap item per branch.
2. Commit often with roadmap IDs: `feat(web): add proximity heuristic [R1.2]`.
3. Keep up to date: `git fetch origin && git rebase origin/main` (before opening the PR and when main moves).
4. Run **`/open-pr`** (Claude or Gemini): self-review against the roadmap, fill the PR template, open the PR.
5. CI must be green: `secrets`, `docs-sync`, `pr-guard` (roadmap ID + deviation disclosure), `build-test` (typecheck, tests, build).
6. **Teammates' PRs:** the code owner reviews (assisted by `/review-pr <n>`), approves, and squash-merges.
   **Owner's PRs:** auto squash-merged by `automerge-owner` once all checks pass (ADR-010) — unless the PR is a
   draft, has the `no-automerge` label, or declares a roadmap deviation. Branches auto-delete after merge.
7. Pushing new commits after approval dismisses it — re-review is required.

Enforcement: local `pre-commit` blocks commits on main; `pre-push` blocks pushing to main; Claude hooks block AI
pushes to main, merges, approvals, and `ALLOW_*` overrides; GitHub branch protection blocks everything else.

## Deviations — always disclosed
If a PR does anything outside its roadmap item's scope (extra feature, new dependency, new env var, interface or
schema change, ROADMAP or Accepted-ADR edit):
1. **PR body:** tick "This PR deviates", fill **Why**, **Score impact**, **ADR**, **Code locations**.
2. **ADR:** append to `docs/DECISIONS.md`.
3. **Code:** comment at each deviating site — `// DEVIATION(ADR-012): reason in one line`.
CI (`pr-guard`) fails if deviation signals exist (`[off-roadmap]` commits, `DEVIATION(` comments, ROADMAP edits)
but the PR doesn't declare them, or if a declared deviation has no Why / no ADR. The job summary shows the owner
the roadmap IDs and every deviation at a glance. `/review-pr` also hunts for *undeclared* scope creep.

## Branch protection (owner, once — after the first push)
Script (needs GitHub CLI + admin): `node infra/github/protect-main.mjs <owner>/<repo>`.
Or manually: GitHub → Settings → Branches → Add rule for `main`:
require a PR · 1 approval · **require review from Code Owners** · dismiss stale approvals · require approval of the
most recent push · require status checks `secrets`, `docs-sync`, `pr-guard`, `build-test` (branch up to date) · require conversation
resolution · require linear history · no force pushes / deletions. Settings → General: squash merge only,
auto-delete head branches.
Note: GitHub never lets authors approve their own PRs. Owner PRs are merged by the `automerge-owner` workflow using
the owner's admin rights (`enforce_admins` is off for this reason). Setup (owner, once):
1. Create a **fine-grained PAT** at github.com/settings/personal-access-tokens: repository access = only
   `footprint`; permissions **Contents: read & write**, **Pull requests: read & write**; expiry ≈ 30 days.
2. GitHub → Settings → Environments → **automerge** (already created; protected branches only) →
   Add environment secret **`AUTO_MERGE_TOKEN`** = the PAT. Never put it in `.env` or a repo-level secret.
3. If a merge fails with a protection error, the token lacks admin effect: add **Administration: read & write**
   to the PAT. Without the secret the workflow just skips (owner merges manually via bypass).

## Bootstrap (owner, once)
The very first commit has to land on main before protection exists:
`ALLOW_MAIN_COMMIT=1 git commit -m "chore: project scaffold [R0.2]"` → create the public GitHub repo →
`git remote add origin <url>` → `ALLOW_MAIN_PUSH=1 git push -u origin main` → enable branch protection.
`ALLOW_*` overrides are owner-only and never run by an AI.

## Conflict hygiene
Edit only your own lines in `docs/STATUS.md`; only your own handoff file. Rebase, don't merge main into branches.

## Ownership rules
- Owner of an item decides implementation details; cross-cutting changes (interfaces, schema, env vars) need a
  heads-up in the PR description and an ARCHITECTURE.md update.
