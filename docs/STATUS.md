# Status — single source of truth (AI: read this first)

Current phase: Phase 1 — Build queue (10-10 → 10-16)
Deadline: submit by 2026-10-17 (hard 10-18) · Feature freeze 2026-10-16 · Live: https://footprint-804307041024.asia-southeast1.run.app

States: `[ ]` todo · `[~]` claimed / in progress · `[x]` done (owner-verified on merge) · `[!]` blocked (reason).
Claiming a step: see "How to pick up work" below (ADR-031). Edit only the lines of steps you claimed.

## How to pick up work (pull model, ADR-031)
1. `git fetch` and check open PRs / remote branches — a step is **claimed** if its line says `[~] … @handle` on `main`
   *or* an open draft PR / branch `r<id>-…` exists for it. Never take a claimed step.
2. Take the **first unclaimed `[ ]` step** in the queue (earlier steps unblock later ones). Skip only if blocked — say why.
3. **Claim immediately:** branch `r<id>-<slug>`, set the line to `[~] … — @you claimed YYYY-MM-DD`, push, open a
   **draft PR** titled with the step (`Q3 R1.3 …`). The draft PR is the visible lock.
4. **Finish it fully** — every item of its DoD (Definition of Done) — then set `[x]`, run `/open-pr`, mark ready.
   A non-draft code PR must declare the step fully complete (CI `pr-guard` checks this).
5. Can't finish? Write exactly what remains in the PR + your handoff, set the line to `[ ] … — released by @you`,
   so the next person continues on the same branch. Partial work is never merged as done.
6. The owner verifies (`/verify <PR>`) and merges; then `npm run deploy` updates the live URL.

## Phase 0 — Setup
- [x] R0.1 3rd member added to Hack2skill team — @mkarthick1995 2026-10-10
- [x] R0.2 Repo scaffold + guardrails + docs pushed to github.com/mkarthick1995/footprint (public) — @mkarthick1995 2026-10-10
- [x] R0.3 Project `project-d8d384af-4155-46fa-a3c` ("footprint-aicup"): billing + trial, budget alerts, APIs, Firestore Native asia-southeast1, Maps key restricted, Vertex AI verified (ADR-030), SA `footprint-api`, owner ADC verified, both teammates granted Editor — @mkarthick1995 2026-10-10
- [~] R0.4 Stack confirmed (ADR-003); pending: teammates' GitHub handles in TEAM.md (both are collaborators; gcloud setup in progress) — @mkarthick1995 2026-10-10
- [x] R0.5 Verified (ADR-029/030): Gemini on Vertex AI, Live text via transcription, 2-min video cap handling, model IDs in config — @mkarthick1995 2026-10-10
- [x] R0.6 Protected main, CODEOWNERS, required checks (secrets, docs-sync, pr-guard, build-test), owner-PR auto-merge — @mkarthick1995 2026-10-10
- [x] R0.7 Safety case (SAFETY.md) + ADR-011..031 accepted — @mkarthick1995 2026-10-10
- [x] R1.5 Scaffold + Cloud Run deploy (`npm run deploy`), Maps key referrer-locked — @mkarthick1995 2026-10-10

## Build queue — take the first unclaimed step, finish its whole DoD
- [ ] Q1 · R1.1 Frame source complete · DoD: rear camera + clip work on desktop Chrome and Android Chrome (live URL); Wake Lock held while running, released on stop; permission-denied / no-camera / wake-lock-unsupported announced; `grabFrame(maxWidth)` helper used by later steps; ST-04 passes
- [ ] Q2 · R1.2 Detector + tracker + time-to-contact · DoD: MediaPipe EfficientDet-Lite in the browser on Q1 frames; IoU tracker with stable IDs (≥ 5 frames before trusting motion); looming TTC, pinhole distance, in-path, smoothing, edge-cut ignore as pure unit-tested functions (ADR-024); emits `AlertCandidate`s; ≥ 10 fps on a mid-range Android, measured and noted here
- [ ] Q3 · R1.3 Alert manager v1 · DoD: the only speaking path (TTS + earcon + vibrate where supported, aria-live mirror); ADR-022 queue: tiers, TTC order, re-check at dequeue, merge same-type, top 1–2, P0 preempts, cool-down + hysteresis; unit tests for ST-21/22/24/25 logic; wired to Q2 on clips
- [ ] Q4 · R1.8 Face blur + downscale · DoD: on-device face detection blurs faces before any frame leaves the phone; downscale ≤ 640 px; fps impact measured; debug view proves blurred upload frame (ST-10); ADR-013 fallback if too slow (ADR update, never silent)
- [ ] Q5 · R1.7 Output safety filter · DoD: pure filter in `packages/shared` blocking all-clear / crossing / identity phrasing with neutral fallback (ADR-012, SAFETY §5); unit tests incl. prompt-injection strings (ST-07/08/09 logic); every model-derived text passes it before the alert manager
- [ ] Q6 · R2.2 Scene scan · DoD: `POST /api/scan` (blurred JPEG ≤ 640 px) → Vertex `gemini-3.8-flash` with JSON response schema (hazard type enum, direction, distance bucket, confidence, footpath/surface/crossing); server schema validation; client discards results older than 2 s; scan every 2–3 s, skipped when stationary/unchanged; results → Q5 → Q3; no frame logging (PRI-10); per-session rate limit; cost per walk-hour measured (REL-06)
- [ ] Q7 · R2.3 Community hazards v1 · DoD: `POST /api/observations` validates (schema, accuracy ≤ 25 m) and stores (TTL 7 d); clusters same type ≤ 15 m; Beta evidence + confirm rule (ADR-025); `GET /api/hazards?bbox=`; unit tests for clustering/evidence (ST-18, ST-30); client posts scan observations and hears confirmed hazards as "reported…"
- [ ] Q8 · R2.4 Hazard map · DoD: `/map` page (Maps JS, referrer-locked key) shows confirmed hazards plus an accessible list view; works without a phone; no PII
- [ ] Q9 · R1.6 Fail-loud layer · DoD: watchdog heartbeats (camera, detector, scan, TTS, GPS); degradation ladder L0–L3 announced; camera quality gate (dark / blur / frozen / covered); orientation check; battery/thermal warnings; ST-01/02/03/05/06 pass
- [ ] Q10 · R1.4 Live Q&A proxy · DoD: `/api/live` WebSocket on Cloud Run ↔ Vertex Live (AUDIO + transcription, compression + resumption); forwards transcript text only; push-to-talk + current blurred frame per question; answers via Q5 → Q3 as P3, preemptible; ST-20, ST-23
- [ ] Q11 · R2.1 + R2.5 Route corridor + summary · DoD: destination (voice/text) → Routes API polyline → corridor hazard prefetch → spoken route summary with cold-start wording (ADR-021/027); ST-19
- [ ] Q12 · R2.6 Privacy & integrity · DoD: rotating session IDs, 200 m trip-end trimming, coarse geohash, TTL decay, "not seen" votes from passes; ST-17
- [ ] Q13 · R2.7 Abuse, cost & headers · DoD: rate limits on every endpoint, session caps, budget alert verified, security headers + CSP (SEC-07); ST-15
- [ ] Q14 · ADR-023/026 Verbosity + presets · DoD: street-demand level, presets UI + voice commands, local settings, P0/SYS floor; ST-26/27/29

## Phase 3 — Stretch (only if Q1–Q14 are done by 10-15)
- [ ] R3.1 Meta glasses integration
- [ ] R3.2 Multilingual voice
- [ ] R3.3 Custom pothole detector

## Phase 4 — Submission (10-16 → 10-17)
- [ ] R4.1 Field test + metrics
- [ ] R4.2 Demo video < 3:00
- [ ] R4.3 Deck PDF
- [ ] R4.4 README for judges
- [ ] R4.5 Final deploy + link check + cost alerts + min instances 1
- [ ] R4.6 Submit on Hack2skill
- [ ] R4.7 Safety & limitations disclosure + full ST matrix run

## Open questions
- Repo license for the public repo (MIT suggested) — not yet chosen.
- Submission time-of-day / timezone on 10-18 — ask on Discord.
- Do participants get Google Cloud / Gemini credits? — ask on Discord.
- Blind-user / org feedback before 10-16 (ETH-02) — outreach not started yet.

## Blockers
- (none)
