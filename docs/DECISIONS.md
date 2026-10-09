# Decisions (ADR log) — append-only

Format: `## ADR-NNN Title` · Status (Proposed / Accepted / Superseded by ADR-x) · Date · Context · Decision · Score impact.
Reversing an *Accepted* ADR is a deviation (AGENTS.md §4): add a new ADR that supersedes it.

## ADR-001 Product idea: accessible-street co-pilot
Accepted · 2026-10-10
Context: Ideas evaluated — dev-context framework (saturated: claude-mem, Kiro specs, Memorix), hierarchical agent tree
(interesting, weak demo), self-retraining finance model (not novel, weak GenAI score), drone navigation (high setup
risk, hard to deploy for judges). Decision: blind / low-vision street co-pilot with a shared accessibility map.
Score: strong Impact + UX; Innovation via the community map; Tech via the layered live architecture.

## ADR-002 Phone-first PWA; Meta glasses are a stretch goal
Accepted · 2026-10-10
Context: Meta Wearables toolkit needs a native app and is country-gated; 8 days left. Decision: PWA on phone camera
(chest-mount for demo); glasses = R3.1 only if Phase 2 is done. Score: protects the deployed-link requirement.

## ADR-003 Stack: TypeScript end to end
**Proposed** · 2026-10-10 — confirm in R0.4
Proposal: `apps/web` = Vite + TypeScript PWA; `services/api` = Node 22 + TypeScript (Fastify or Express) on Cloud Run;
`@google/genai` SDK; Firestore; Google Maps JS + Routes API; MediaPipe Tasks Vision (web).
Why: one language for 3 people, shared types, guard scripts already Node. Alternative: Python FastAPI backend
(better if someone is much stronger in Python or wants ADK).

## ADR-004 Layered latency: on-device for danger, Gemini for understanding
Accepted · 2026-10-10
Context: Live API video ≈1 fps + network delay; unsafe as the only hazard detector. Decision: see ARCHITECTURE.md.
Score: Tech (sound engineering) + Impact (safety credibility with judges).

## ADR-005 No vector DB for AI context
Accepted · 2026-10-10
Context: Asked whether a local vector DB would help token usage. Repo docs are ~10 files; grep + a STATUS/handoff
protocol is cheaper, tool-agnostic, and reviewable in PRs. A vector DB adds setup per member, drifts from the
truth, and Gemini/Claude users would need the same integration. Revisit only if docs exceed ~50 files.

## ADR-006 AGENTS.md is the single source of AI instructions
Accepted · 2026-10-10
CLAUDE.md / GEMINI.md import it. Enforcement is tool-agnostic (git hooks + CI) plus Claude hooks.

## ADR-008 Protected main, feature branches, mandatory code-owner approval
Accepted · 2026-10-10
Decision: `main` changes only via squash-merged PRs from `r<id>-*` branches. The lead is the sole code owner and
mandatory approver. Deviations must be declared in the PR (Why / Score impact / ADR) and marked in code with
`DEVIATION(ADR-0xx)` comments; CI `pr-guard` rejects undeclared ones. AI may review but never approve or merge.
Score: protects demo stability and keeps the build on the scoring roadmap. Cost: owner is a review bottleneck —
review PRs at least twice a day, keep PRs small.

## ADR-009 Product name: Footprint
Accepted · 2026-10-10
Tagline: "Every walk leaves a footprint for the next person." Chosen because it carries both halves of the product
(personal guidance + community map) and is short and clear over text-to-speech. Rejected: StreetSense (likely
existing firm), Jalan (opaque outside Malay/Indonesian), WalkWise (generic), "Sight/Eye" names (crowded),
anything using Google marks. A 2026-10-10 search found no accessibility/navigation app named Footprint; "Footprint"
is a common word used by unrelated companies, so it's fine for the hackathon but needs a trademark check before
any commercial launch.

## ADR-010 Auto-merge the code owner's PRs; teammates' PRs keep mandatory owner approval
Accepted · 2026-10-10 · amends ADR-008
Context: GitHub can't self-approve, and branch protection has no per-author rules. Decision: workflow
`automerge-owner` (workflow_run after `guardrails` succeeds) squash-merges PRs authored by @mkarthick1995 using an
owner PAT stored in the `automerge` environment (protected branches only). Required checks still gate every merge.
Skipped when: draft, `no-automerge` label, declared deviation, or head moved since checks ran.
Security: runs from main's copy of the workflow (PR can't modify it); secret unreachable from PR-branch workflows.
Risk accepted: owner PRs — including AI-written ones opened from the owner's account — get no human review. Mitigation:
use draft / `no-automerge` for anything non-trivial; deviations never auto-merge.

## ADR-007 Privacy: no images or video stored
Accepted · 2026-10-10
Only hazard type + GPS + time + confidence are persisted. Raw recordings stay local in `data/` (gitignored).
