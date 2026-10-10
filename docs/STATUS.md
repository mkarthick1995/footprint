# Status — single source of truth (AI: read this first)

Current phase: Phase 0 — Setup (10-10 → 10-11)
Deadline: submit by 2026-10-17 (hard 10-18) · Feature freeze 2026-10-16

States: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (reason). Edit only your own lines.
Format: `- [ ] R1.2 Description — @handle YYYY-MM-DD`

## Phase 0 — Setup
- [x] R0.1 3rd member added to Hack2skill team — @mkarthick1995 2026-10-10
- [x] R0.2 Repo scaffold + guardrails + docs pushed to github.com/mkarthick1995/footprint (public) — @mkarthick1995 2026-10-10
- [ ] R0.3 GCP project, billing/credits, Gemini + Maps keys, region asia-southeast1
- [~] R0.4 Stack confirmed (ADR-003 accepted, all ADRs to 026 accepted); pending: teammates' handles + owner split in TEAM.md — @mkarthick1995 2026-10-10
- [x] R0.5 Verified (ADR-029): ephemeral tokens = Gemini Developer API only; Live 2-min video cap → compression + resumption + on-demand frames; text via output transcription; model IDs in config. Meta toolkit country check deferred to R3.1 — @mkarthick1995 2026-10-10
- [x] R0.6 Branch strategy, CODEOWNERS, pr-guard CI, /open-pr + /review-pr; `main` protection verified via API: code-owner approval, required checks secrets/docs-sync/pr-guard (strict), linear history, conversation resolution, squash-only, auto-delete branches — @mkarthick1995 2026-10-10
- [x] R0.6 Owner-PR auto-merge workflow + `automerge` environment + AUTO_MERGE_TOKEN (ADR-010); verified by this line's PR auto-merging — @mkarthick1995 2026-10-10
- [~] R0.7 Safety case (SAFETY.md, ADR-011..013) + ADR-015..021 (pipeline, community data, route info) + FACTS.md done; pending: confirm ADR-014/017/019/020/021 — @mkarthick1995 2026-10-10

## Phase 1 — Core loop
- [ ] R1.1 PWA camera capture
- [ ] R1.2 On-device obstacle detection (design: ADR-024 tracking + time-to-contact)
- [ ] R1.3 Voice alerts + haptics + priority (design: ADR-022 tiers, ADR-023 adaptive verbosity, ADR-026 user presets + safety floor)
- [ ] R1.4 Ephemeral-token API + Gemini Live session
- [~] R1.5 Monorepo scaffold done (shared types + tier logic with tests, web PWA shell + frame source, Fastify API + Dockerfile, CI build-test); deploy pending R0.3 — @mkarthick1995 2026-10-10
- [ ] R1.6 Fail-loud layer (watchdog, degradation ladder, camera/orientation/battery checks)
- [ ] R1.7 Gemini safety layer (instruction, schema, output filter, stale drop, injection)
- [ ] R1.8 On-device face blur before upload

## Phase 2 — Differentiators
- [ ] R2.1 Walking directions narrated by Gemini
- [ ] R2.2 Gemini structured hazard extraction
- [ ] R2.3 Community hazards (design: ADR-020 + ADR-025 evidence model)
- [ ] R2.4 Public hazard map dashboard
- [ ] R2.5 Accessibility score + safer route
- [ ] R2.6 Hazard data privacy & integrity (session IDs, trip trimming, TTL, 2-report rule)
- [ ] R2.7 Abuse & cost protection (rate limits, session caps, budget alerts)

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
- [ ] R4.7 Safety & limitations disclosure + full ST matrix run

## Open questions
- Repo license for the public repo (MIT suggested) — not yet chosen.
- Submission time-of-day / timezone on 10-18 — ask on Discord.
- Do participants get Google Cloud / Gemini credits? — ask on Discord (none found online; ADR-017).
- Start blind-user / org outreach now (ETH-02) — lead time is days.
- Can we get feedback from a visually impaired user or org (e.g. NAB India, SAVH Singapore) before 10-16?

## Blockers
- (none)
