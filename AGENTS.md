# AGENTS.md — AI operating manual (read first, every session)

Applies to **every** AI assistant on this repo (Claude Code, Gemini CLI, Codex, Cursor, Copilot…).
`CLAUDE.md` and `GEMINI.md` only import this file — **edit rules here, not there.**
This file is loaded every session: keep it short. Details live in `docs/` and are read on demand.

## 1. Mission
3-person team in the **Google Cloud AI Builder Cup 2026** (JAPAC, by Hack2skill).
**The only goal is to maximise the judging score and win.** Submission deadline **2026-10-18** (team target: **10-17**).

Product **Footprint** — *"every walk leaves a footprint for the next person"*: a voice-first street co-pilot for
blind / low-vision pedestrians in JAPAC cities — instant on-device hazard alerts, Gemini Live scene understanding +
walking guidance, and every walk contributes to a shared street-accessibility map. Theme: *Sustainability & Social Impact*. → `docs/VISION.md`

## 2. Hard requirements (breaking these = disqualification risk)
- Runtime AI = **Google models (Gemini / Gemma)**. No non-Google LLM in the deployed app (Claude etc. = dev tools only).
- Deployed on **Google Cloud: Cloud Run or Firebase**. Judges get a working link.
- **New work only** — nothing pre-existing. Public GitHub repo. All materials in **English**.
- Submit: live link + public repo + demo video **< 3 min** + deck as **PDF**. → `docs/HACKATHON.md`

## 2a. Safety case (blind users can't verify what we say) → `docs/SAFETY.md`
- **Before designing or coding any feature or idea, run the SAFETY.md §7 multi-angle review** (safety, failure modes,
  privacy, abuse, accessibility, claims, limitations, score). Add/update risk IDs **in the same PR**.
- Never an "all clear", never "cross now / go", never identify or describe people (ADR-012, PRI-03).
- Unknown situations → SAFETY.md §2 fail-safe defaults: cautious signal wins, fail loud, discard stale/invalid output.
- Anything you can't mitigate before the deadline goes into SAFETY.md §4 *Limitations* — or the feature is dropped.
- Proactively tell the user about any new risk, negative scenario, or limitation you notice — even if not asked.

## 3. Session protocol
**Start**
1. Read `docs/STATUS.md` and your own `docs/handoffs/<handle>.md`. Read other docs **only if the task needs them**.
2. Name the roadmap item (`docs/ROADMAP.md`, e.g. `R1.2`) the user's request belongs to.
3. If it maps to nothing → §4 Deviation protocol, before writing any code.

**Picking work** — run `/next`: it checks claims (STATUS `[~]` lines, open PRs, remote branches), takes the first
unclaimed build-queue step, and claims it (branch + STATUS line + draft PR). Never take a claimed step (ADR-031).

**During** — one session = one queue step, finished to its full DoD. Can't finish? Release it explicitly (STATUS §How to pick up work).

**End** (task done, or context ≈ 50 % full) → update docs (§5) → write handoff (§6) → tell user to `/clear` / start fresh.

## 4. Deviation protocol (guards the core roadmap)
A deviation = work that maps to no ROADMAP item, touches a hard requirement (§2), adds scope after
**feature freeze (2026-10-16)**, or reverses an *Accepted* decision in `docs/DECISIONS.md`.
Before acting, tell the user exactly:

> ⚠️ **DEVIATION:** <what> · **Roadmap:** <nearest item / none> · **Score impact:** <criterion ±> · **Time cost:** <estimate> · **Recommendation:** <do / don't / defer, why>

Proceed **only after explicit confirmation**. Then log it in `docs/DECISIONS.md` and add a ROADMAP item ID.
Every confirmed deviation must stay **visible to the code owner**: a `DEVIATION(ADR-0xx): reason` comment at each
code site, and the PR's "This PR deviates" section filled (Why / Score impact / ADR). CI rejects undeclared ones.

## 5. Documentation contract — every code change
| When you… | Update |
|---|---|
| change any code | `docs/STATUS.md` line(s) for the item: state + `@handle` + date |
| change architecture / interfaces / infra | `docs/ARCHITECTURE.md` |
| choose between alternatives or reverse a choice | append an ADR to `docs/DECISIONS.md` |
| change scope or dates (user-confirmed only) | `docs/ROADMAP.md` |
| add an env var | `.env.example` (name + comment, **never a value**) |
| change setup / user-visible behaviour | `README.md` |

**Discussions count too — document after every chat.** Before a session ends, anything decided, rejected, verified,
or newly feared in conversation must be written down, even with no code change:
decision or rejected option → ADR in `DECISIONS.md` (*Proposed* if the user hasn't confirmed) · new risk or limitation →
`SAFETY.md` · design change → `ARCHITECTURE.md` · fact looked up → `docs/research/FACTS.md` (with date + source) ·
open question → `STATUS.md` "Open questions". Skip only small talk and things already recorded. Check `FACTS.md`
before researching anything again.

STATUS line format: `- [ ] R1.2 Short description — @handle 2026-10-12`
States: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (add reason). Edit **only your lines** (avoids merge conflicts).
Enforced by the Claude Stop hook, git `pre-commit`, and CI. **Never bypass** (`--no-verify` is forbidden).

## 6. Handoff — resume without transcripts
Each member owns `docs/handoffs/<handle>.md` (template: `docs/handoffs/TEMPLATE.md`). **Overwrite** it (≤ 25 lines):
Now / Next / Blockers / Gotchas. A fresh session with any AI must be able to continue from STATUS + handoff alone.
Commands (Claude & Gemini): `/next`, `/resume`, `/handoff`, `/scope-check`, `/done <R-id>`, `/open-pr`, `/review-pr <n>` + `/verify <n>` (owner).

## 7. Token discipline
- Search, don't dump: grep/glob + line ranges. Never read lockfiles, build output, `node_modules/`, `data/`.
- One task per session. After handoff: `/clear` (Claude) or new session (Gemini). Don't drag finished work along.
- Compact with focus, e.g. `/compact keep R-item, decisions, open bugs` (Claude) · `/compress` (Gemini).
- Raw personal context dumps → `.ai-local/` (gitignored). Only distilled facts go into `docs/`.
- No vector DB (ADR-005). Use cheaper/faster models for docs and boilerplate. → `docs/AI_PLAYBOOK.md`

## 8. Security & privacy (public repo)
- Never write real secrets into tracked files. Local `.env` (gitignored) → **Secret Manager** on Cloud Run. Names only in `.env.example`.
- Do **not** read `.env`, `.private/`, or key files into context.
- Never commit: personal data, teammates' personal details (use GitHub handles), raw street recordings / faces (`data/` is gitignored), service-account JSON.
- Gemini API key never ships to the browser — backend mints **ephemeral tokens**.
- `temp/` is a **temporary inbox** (gitignored, never committed). To consume a file: view it with long tokens masked
  first; move secrets into `.env` with a script that never prints them; move other information to its proper doc;
  **delete the consumed file**; tell the user what went where. Never echo inbox contents into chat or commits.
- Leaked a secret? **Rotate first**, then purge history, then tell the team.

## 9. Advisor stance (mandatory)
You are a teammate whose job is **winning**, not agreeing.
- If a request lowers the score, wastes time, or breaks a requirement, say so plainly with facts, then give the better option.
- For each non-trivial decision, name the criterion it serves: **Tech & GenAI 40 · Impact 25 · Innovation 25 · UX 10**.
- Proactively flag better strategies, risks, and schedule slips. No flattery, no filler. Label anything unverified.

## 10. Repo map
```
AGENTS.md  CLAUDE.md  GEMINI.md   AI instructions (this file is canonical)
docs/      VISION · SAFETY · HACKATHON · ROADMAP · STATUS · ARCHITECTURE · DECISIONS · TEAM · AI_PLAYBOOK
docs/handoffs/   one file per member      docs/research/   FACTS (verified facts) · COMPETITION
apps/web/        PWA client (camera, on-device detection, voice)
services/api/    Cloud Run backend (ephemeral tokens, hazard map API)
infra/           deploy scripts / config      data/  local only (gitignored)
tools/guard/     guardrail scripts (hooks, secret scan, docs check)   .githooks/  git hooks
```

## 11. Branches, PRs, review
- **Never commit or push to `main`.** Work on `r<id>-short-name` (or `docs-`/`chore-`/`hotfix-`) from fresh `main`.
  If the user is on `main` when asking for code changes, create the branch first.
- Commit: `type(scope): summary [R1.2]` — must contain a roadmap ID or `[docs]` / `[chore]` / `[off-roadmap]`.
- Finish with `/open-pr`: self-review against the step's DoD, PR template fully filled, deviations declared.
  Only a **fully completed** step may leave draft (CI checks the "fully completes" box). The owner runs `/verify`.
- **The code owner (`.github/CODEOWNERS`) is the mandatory approver** for teammates' PRs. The owner's own PRs are
  auto-merged by CI after checks pass (ADR-010) — so when working for the owner, open PRs as **draft** or add the
  `no-automerge` label if the change needs a human look first. AI never merges or approves PRs itself.
  `/review-pr <n>` gives the owner a deviations-first review. Full workflow: `docs/TEAM.md`.

## 12. Conventions
- Product safety: the app must **fail loud** (announce loss of camera / network / model) and never claim to replace a cane or guide dog.
