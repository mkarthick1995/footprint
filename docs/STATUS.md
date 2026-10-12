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
- [x] R1.5 Scaffold + Cloud Run deploy (`npm run deploy`; production deploys always route traffic to latest), Maps key referrer-locked — @mkarthick1995 2026-10-10

## Build queue — take the first unclaimed step, finish its whole DoD
- [x] Q1 · R1.1 Frame source complete — @mkarthick1995 2026-10-10 · verified: clip path 640×360 (desktop browser), rear camera + wake lock + app-switch pause/resume on Android Chrome (owner phone test, ST-04 ✅); calm wording (ADR-032); best device voice (ADR-033) · DoD: rear camera + clip work on desktop Chrome and Android Chrome (live URL); Wake Lock held while running, released on stop; permission-denied / no-camera / wake-lock-unsupported announced; `grabFrame(maxWidth)` helper used by later steps; ST-04 passes
- [x] Q2 · R1.2 Detector + tracker + time-to-contact — @mkarthick1995 2026-10-11 · progress: detector + tracker + exact 1/h TTC + overlay done, 24 shared tests, desktop 62 fps; real clip 1 (Ray-Ban, cycling, 3 min, 10 fps sampled via dev `/clip-eval.html`): 0 P0; CC-BY walking clips (Shanghai crowd, Singapore night lane) exposed false P0s → ADR-024 refinement 2 (closing-speed bound, height-cut distance bound, frame-fill P0 for unknowns only): P0 frames 3.6→1.3 % and 16.6→3.9 %, spot-checked P0s real, 28 shared tests (ST-31 ✅); phone: **14–30 fps** on the owner's Android (Chrome, preview q03, 2026-10-11) ✅ · DoD: MediaPipe EfficientDet-Lite in the browser on Q1 frames; IoU tracker with stable IDs (≥ 5 frames before trusting motion); looming TTC, pinhole distance, in-path, smoothing, edge-cut ignore as pure unit-tested functions (ADR-024); emits `AlertCandidate`s; ≥ 10 fps on a mid-range Android, measured and noted here
- [x] Q3 · R1.3 Alert manager v1 — @mkarthick1995 2026-10-11 · progress: pure `AlertManager` in shared (tiers, TTC order, merge, cool-downs, rate gaps, interrupts, SYS, presets floor, wording caps) + 15 unit tests; web `AlertOutput` (earcon → speech, vibrate, aria-live, TTS watchdog) wired to Q2; clip speech simulation (dev `/clip-eval.html`): Singapore lane 24→13 spoken/min, Shanghai crowd 19→9, Ray-Ban ride 0.3 (repeats → earcon, people merged across sides, uncertain items join their type); 17 alert tests; owner phone test 10-11: works, but silent on first Start and mostly "obstacle" wording → fixed (speech primed in the tap + silent-voice warning; "Possible <type>"); re-test 10-11: voice on first tap ✅, indoor alerts ✅; outdoor street listen test = open check (owner, 10-12) · DoD: the only speaking path (TTS + earcon + vibrate where supported, aria-live mirror); ADR-022 queue: tiers, TTC order, re-check at dequeue, merge same-type, top 1–2, P0 preempts, cool-down + hysteresis; unit tests for ST-21/22/24/25 logic; wired to Q2 on clips
- [x] Q4 · R1.8 Face blur + downscale — @chill-guy-1234 2026-10-11 · verified on phone (owner of step confirmed); pure geometry (`privacy.ts`, 15 tests), `FaceBlurrer` (BlazeFace short-range, IMAGE mode, pixelate faces + person head areas, fail closed → null), only sanctioned upload path `getUploadFrame`/`getUploadJpeg` enforced by `uploadGuard.test.ts`, `?debug=blur` view; 77 tests green, build OK; phone test 2026-10-11 (preview `q04`, Android, Brave): face model loads on the live preview ✅; blur 30 ms/call on the phone (12 ms on a PC); head-area backstop covered a person the face model missed (0 faces, 1 head area) ✅; detector 10.6 fps with `?debug=blur` vs 9.6 fps without (94–102 ms/frame, GPU) → blur cost not measurable above noise (≈1 % theoretical at one blur per 2–3 s), ADR-013 fallback not needed. **Follow-ups, not blockers (docs/FOLLOWUPS.md):** formal ST-10 re-check with a clear face and an outdoor test (record in SAFETY §6), small/far faces weak (#10), detector alone borderline vs the Q2 ≥ 10 fps target on this phone (#11) · DoD: on-device face detection blurs faces before any frame leaves the phone; downscale ≤ 640 px; fps impact measured; debug view proves blurred upload frame (ST-10); ADR-013 fallback if too slow (ADR update, never silent) · **owner review 10-12:** person boxes held 1 s (detector gaps had left a mid-distance face unblurred on the Singapore clip), de-duplicated (≤ 10 snapshots/s, IoU merge): 6–16 regions, ~5 ms per blur on desktop; ST-10 ◐
- [x] Q5 · R1.7 Output safety filter — @chill-guy-1234 2026-10-12 · progress: all DoD items built and unit-tested, PR #25 — `safetyFilter.ts` (all-clear / crossing / signal / identity / injection, obfuscation-aware, refusal-first fallback, 69 tests), `AlertManager.modelText()` (P3 queue: 2-sentence cap, stale drop, preset-aware, P0/P1 preempt; 14 tests), `AlertOutput.sayModelText()` with manager now private + `speakGuard.test.ts`; 128 shared + 17 web tests green, build OK; SAFETY rows SAF-04/SAF-21/PRI-03/SEC-04 + ST-07/08/09 logic updated · DoD: pure filter in `packages/shared` blocking all-clear / crossing / identity phrasing with neutral fallback (ADR-012, SAFETY §5); unit tests incl. prompt-injection strings (ST-07/08/09 logic); every model-derived text passes it before the alert manager — enforced by a single entry point (e.g. `AlertOutput.sayModelText()`, filter always applied, unit-tested) that Q6/Q10 must use; no other path for model text. Parallel with Q4 (independent; both block Q6) · **owner review 10-12:** "There is a step ahead" was blocked as a crossing instruction (a real hazard replaced by "I can't tell you when to cross") → `step` removed from the go/cross verb rule, step commands still blocked at sentence start; +9 tests (137 shared). Known over-blocks (acceptable, tune in Q6): "Chinese restaurant", "children crossing" sign, "sunglasses on display", "Free parking"
- [x] Q6 · R2.2 Scene scan — @mkarthick1995 2026-10-12 · face-leak audit 4/24 → 1/24 (ST-10 ✅); `POST /api/scan` → Vertex `gemini-3.6-flash`, thinking off (ADR-034: 1.3–1.9 s, 10/10 on labelled frames; 3.8-flash 2.4–18 s; 2.5-flash retires before judging), enums-only JSON schema, server + client validation, per-session/per-client limits + daily cap; `SceneScanner` every 2.5 s, one in flight, unchanged/hidden skip, 2 s stale drop (ST-12 ✅), static hazards → alert manager, surface notes → Q5 filter; outages/cap announced; no frame logging (verified in Cloud Run logs); cost **$1.49/walk-hour** (REL-06); preview q06 from Cloud Run: 76 % of scans fresh, round trip 1.5–2.0 s; 203 tests
- [x] Q7 · R2.3 Community hazards v1 — @mkarthick1995 2026-10-12 · `POST /api/observations` (schema, accuracy ≤ 25 m, per-walk/per-client limits) → Firestore transaction (cluster same type ≤ 15 m, Beta evidence, confirm p ≥ 0.7 + ≥ 2 walks, expire ≥ 2 not-seen + p < 0.5, type TTLs) + raw observations with 7-day TTL policy; `GET /api/hazards?bbox=` (≤ 0.05°, confirmed only); client: GPS, scan findings → observations released only ≥ 200 m from both trip ends, confirmed reports spoken "Pothole reported ahead, 3 walkers", not-seen votes; ST-18 ✅ ST-30 ✅; live on preview q07 with real Firestore (test data deleted); 34 new tests. Walking test with GPS = owner outdoor test
- [x] Q8 · R2.4 Hazard map — @mkarthick1995 2026-10-12 · `/map`: Google Map (AdvancedMarker pins by type) + accessible ordered list ("Pothole reported by 2 walkers, last today, about 10 m from the map centre"), list works without Maps; key from Secret Manager via `/api/map-config`, referrer-locked (live, previews, localhost); view-bounded queries ≤ 0.05° with "zoom in" note; confirmed only, no PII; verified locally with real Maps + Firestore test data (deleted); 5 new tests
- [x] Q9 · R1.6 Fail-loud layer — @mkarthick1995 2026-10-12 · watchdogs: camera frames (frozen 2 s), detector heartbeat (stall 3 s → L3), scene scan (offline / 3 failures / 429 → L1), TTS (Q3 start/end watchdogs), GPS (lost 30 s); ladder L0–L3 with hysteresis, announced, camera-derived alerts withheld at L2/L3; quality gate covered / dark / blurred / frozen; orientation ground / sky; battery 20/10/5 %, slow-detector and Compute Pressure heat warnings; ST-01 ✅ (1.8 s), ST-02 ✅, ST-03 ◐ (scan; Live in Q10), ST-05 ◐ / ST-06 ◐ (clip + simulated sensor; confirm on phone); 12 + 1 new tests
- [~] Q10 · R1.4 Live Q&A proxy — @mkarthick1995 claimed 2026-10-13 · DoD: `/api/live` WebSocket on Cloud Run ↔ Vertex Live (AUDIO + transcription, compression + resumption); forwards transcript text only; push-to-talk + current blurred frame per question; answers via Q5 → Q3 as P3, preemptible; ST-20, ST-23
- [ ] Q11 · R2.1 + R2.5 Route corridor + summary · DoD: destination (voice/text) → Routes API polyline → corridor hazard prefetch → spoken route summary with cold-start wording (ADR-021/027); ST-19
- [ ] Q12 · R2.6 Privacy & integrity · DoD: rotating session IDs, 200 m trip-end trimming, coarse geohash, TTL decay, "not seen" votes from passes; ST-17
- [ ] Q13 · R2.7 Abuse, cost & headers · DoD: rate limits on every endpoint, session caps, budget alert verified, security headers + CSP (SEC-07); ST-15
- [ ] Q14 · ADR-023/026 Verbosity + presets · DoD: street-demand level, presets UI + voice commands, local settings, P0/SYS floor; ST-26/27/29

## Phase 3 — Stretch (only if Q1–Q14 are done by 10-15)
- [ ] R3.1 Meta glasses integration
- [ ] R3.2 Multilingual voice
- [ ] R3.3 Custom pothole detector
- [ ] R3.4 Natural Google voice before submission: pre-rendered alert phrases (Chirp 3 HD / Gemini-TTS) + Gemini-TTS for dynamic P3 text, device voice fallback (ADR-033) — do near the end to save credits

## Phase 4 — Submission (10-16 → 10-17)
- [ ] R4.1 Field test + metrics
- [ ] R4.2 Demo video < 3:00
- [ ] R4.3 Deck PDF
- [ ] R4.4 README for judges
- [ ] R4.5 Final deploy + link check + cost alerts + min instances 1
- [ ] R4.6 Submit on Hack2skill
- [ ] R4.7 Safety & limitations disclosure + full ST matrix run

## Open questions
- Outdoor street test of Q2+Q3 on the owner's phone (varied types: person / bike / vehicle; P0 rate; tones audible over traffic) — @mkarthick1995 2026-10-12
- Repo license for the public repo (MIT suggested) — not yet chosen.
- Submission time-of-day / timezone on 10-18 — ask on Discord.
- Do participants get Google Cloud / Gemini credits? — ask on Discord.
- Blind-user / org feedback before 10-16 (ETH-02) — outreach not started yet.

## Blockers
- (none)
