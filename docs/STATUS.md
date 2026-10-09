# Status — single source of truth (AI: read this first)

Current phase: Phase 0 — Setup (10-10 → 10-11)
Deadline: submit by 2026-10-17 (hard 10-18) · Feature freeze 2026-10-16

States: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (reason). Edit only your own lines.
Format: `- [ ] R1.2 Description — @handle YYYY-MM-DD`

## Phase 0 — Setup
- [ ] R0.1 3rd member accepts team invite on Hack2skill (closes 10-11) — @mkarthick1995
- [~] R0.2 Repo scaffold + guardrails + docs created locally; push to GitHub pending — @mkarthick1995 2026-10-10
- [ ] R0.3 GCP project, billing/credits, Gemini + Maps keys, region asia-southeast1
- [ ] R0.4 Confirm stack (ADR-003) and owners (TEAM.md)
- [ ] R0.5 Verify Live API ephemeral tokens, current Live model ID, Meta toolkit country availability
- [~] R0.6 Branch strategy, CODEOWNERS, pr-guard CI, /open-pr + /review-pr done locally; enable protection after first push — @mkarthick1995 2026-10-10

## Phase 1 — Core loop
- [ ] R1.1 PWA camera capture
- [ ] R1.2 On-device obstacle detection
- [ ] R1.3 Voice alerts + haptics + priority
- [ ] R1.4 Ephemeral-token API + Gemini Live session
- [ ] R1.5 Deploy skeleton to Cloud Run

## Phase 2 — Differentiators
- [ ] R2.1 Walking directions narrated by Gemini
- [ ] R2.2 Gemini structured hazard extraction
- [ ] R2.3 Hazard logging to Firestore
- [ ] R2.4 Public hazard map dashboard
- [ ] R2.5 Accessibility score + safer route

## Phase 3 — Stretch
- [ ] R3.1 Meta glasses integration
- [ ] R3.2 Multilingual voice
- [ ] R3.3 Custom pothole detector

## Phase 4 — Submission
- [ ] R4.1 Field test + metrics
- [ ] R4.2 Demo video < 3:00
- [ ] R4.3 Deck PDF
- [ ] R4.4 README for judges
- [ ] R4.5 Final deploy + link check + cost alerts
- [ ] R4.6 Submit on Hack2skill

## Open questions
- Repo license for the public repo (MIT suggested) — not yet chosen.
- Submission time-of-day / timezone on 10-18 — ask on Discord.
- Can we get feedback from a visually impaired user or org (e.g. NAB India, SAVH Singapore) before 10-16?

## Blockers
- (none)
