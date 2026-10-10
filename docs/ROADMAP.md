# Roadmap — the core plan (changes need user confirmation + an ADR)

Today: 2026-10-10 · **Feature freeze: 10-16 EOD** · **Submit: 10-17** (hard deadline 10-18).
Every task, commit, and PR maps to one item ID below. Work outside these IDs is a **deviation** (AGENTS.md §4).
Owners A/B/C are proposed — confirm in `docs/TEAM.md`.

## Phase 0 — Setup (10-10 → 10-11)
| ID | Item | Owner | Exit criteria |
|---|---|---|---|
| R0.1 | Team formation confirmed on Hack2skill (3rd member accepted) | A | Before **10-11** closes |
| R0.2 | Repo scaffold, guardrails, docs; pushed to GitHub (public) | A | All 3 cloned + `npm run setup` done |
| R0.3 | GCP project on owner's account ($300 trial → paid Gemini tier, ADR-017), budget alerts $25/$50/$100, Gemini + Maps keys, IAM for teammates, region `asia-southeast1` | A | Billing + alerts on; keys in each `.env`; Secret Manager ready |
| R0.4 | Confirm stack (ADR-003) and owners | All | ADR-003 → Accepted |
| R0.5 | Verify: Gemini Live ephemeral tokens, current Live model ID, Meta toolkit country availability | A | Findings in DECISIONS / ARCHITECTURE |
| R0.6 | Protected `main` + CODEOWNERS + required checks enabled on GitHub (ADR-008) | A | A test PR can't merge without owner approval |
| R0.7 | Safety case: `docs/SAFETY.md` risk register + review protocol (ADR-011); verify Gemini data-use terms and pick a no-training tier (ADR-014) | A | Register merged; tier decided and recorded |

## Phase 1 — Core loop (10-11 → 10-13)
| ID | Item | Owner | Exit criteria |
|---|---|---|---|
| R1.1 | PWA camera capture (rear camera, screen-wake lock) + **frame-source abstraction: camera or recorded clip** (ADR-016) | B | Works on Android Chrome + iOS Safari; clips replay on PC |
| R1.2 | On-device obstacle detection (MediaPipe / TF.js), proximity heuristic | B | ≥ 10 fps on a mid-range phone |
| R1.3 | Voice alerts (TTS) + haptics + alert priority/cool-down | B | No alert spam; critical alerts interrupt |
| R1.4 | Cloud Run API: ephemeral token endpoint; client ↔ Gemini Live session, push-to-talk, **TEXT responses spoken by our TTS** (ADR-019) | A | Ask a question, get a filtered spoken answer |
| R1.5 | **Deploy skeleton to Cloud Run** (early!) + HTTPS URL | A | Public URL works from a phone |
| R1.6 | **Fail-loud layer**: watchdog + alive tick, degradation ladder L0–L3, camera quality (dark/blur/frozen/covered), orientation check, battery/thermal warnings (SAF-05/08/09/17) | B | ST-01, ST-04, ST-05, ST-06 pass |
| R1.7 | **Gemini safety layer**: system instruction, response schema, output filter (no all-clear / crossing / identity), stale-result drop > 2 s, prompt-injection handling (SAF-03/04, SEC-04, PRI-03) | A | ST-07, ST-08, ST-09, ST-12, ST-13 pass |
| R1.8 | **On-device face blur** before frames leave the phone + frame downscaling (PRI-01, ADR-013) | B | ST-10 passes; fps impact measured |

## Phase 2 — Differentiators (10-13 → 10-15)
| ID | Item | Owner | Exit criteria |
|---|---|---|---|
| R2.1 | **Route corridor** (ADR-027): destination → Routes API walking polyline → prefetch community hazards + route summary. No turn-by-turn (users keep Google Maps for turns) | C | Hazards along a real route announced; summary spoken |
| R2.2 | Gemini **scene scan** every ~2–3 s: JSON schema for static hazards, footpath, surface, crossing (ADR-019) | A | Schema-valid output on test clips; cost per walk-hour measured |
| R2.3 | Community hazards: observations → clusters → confirm at ≥ 2 walks → decay; route prefetch + "reported…" alerts (ADR-020) | C | ST-18 passes; walk 2 hears walk 1's confirmed hazard |
| R2.4 | Public hazard map dashboard (judges can open without a phone) | C | Map renders from Firestore |
| R2.5 | Route accessibility info: spoken route summary + simple segment score on map, cold-start wording (ADR-021); "safer route" suggestion is the cuttable part | C | ST-19 passes; summary spoken at route start |
| R2.6 | **Hazard data privacy & integrity**: rotating session IDs, trip-end trimming (200 m), coarse geohash, TTL decay, ≥ 2 reports before routing impact (PRI-04, SAF-13, SEC-03) | C | ST-17 passes |
| R2.7 | **Abuse & cost protection**: rate limits on token + hazard endpoints, session length cap, budget alerts (SEC-02, REL-04) | A | ST-15 passes |

## Phase 3 — Stretch (only if Phase 2 is done by 10-15)
| ID | Item | Owner |
|---|---|---|
| R3.1 | Meta Ray-Ban glasses via Wearables Device Access Toolkit | B |
| R3.2 | Multilingual voice (e.g. Hindi / Tamil / Bahasa) | A |
| R3.3 | Custom pothole detector on-device (public dataset) | B |

## Phase 4 — Submission (10-16 → 10-17)
| ID | Item | Owner | Exit criteria |
|---|---|---|---|
| R4.1 | Field test on real streets; capture metrics (alert latency, hazards logged, accuracy notes) | All | Numbers for the deck |
| R4.2 | Demo video < 3:00 (first-person footage + map) | C | Uploaded public/unlisted link |
| R4.3 | Deck → PDF (problem, solution, impact, feasibility, scalability, theme, safety) | C | PDF in submission |
| R4.4 | README for judges (pitch, live link, architecture, how to try) | A | Reviewed by all |
| R4.5 | Final deploy, keys rotated/locked, link tested logged-out, cost alerts set | A | Link live through 11-06 |
| R4.6 | **Submit on Hack2skill** | A | Confirmation received by 10-17 |
| R4.7 | **Safety & limitations disclosure**: onboarding acknowledgement, in-app limitations, README + deck slide + video line; approved wording only; run full ST matrix and record results (ETH-01/04, SAF-14) | All | SAFETY.md §6 filled in; disclaimer in app, README, deck |

## Cut order if late (cut from the top)
R3.x → R2.5 safer-route suggestion → polish. **Never cut:** R1.x (incl. safety R1.6–R1.8),
R2.3, R2.4, R2.6, R2.7, R4.x. Safety items are not "extra": an unsafe demo loses Impact and Tech credibility.
If R1.8 face blur costs too much fps, fall back to heavy downscaling + no storage and disclose it (ADR-013) — don't drop silently.

## Build order (ADR-028)
1. **10-11 → 10-12 thin slice, deployed:** clip/camera → detector → alert manager (P0/P1) → TTS; scene scan →
   `/observations` → Firestore → map page; Cloud Run URL tested on a phone. `packages/shared` types first.
2. **Deepen by safety + score:** R1.7 → R1.6 → R1.8 → ADR-022/023 tiers → R2.3 evidence model → R1.4 Live Q&A →
   R2.1 corridor + R2.5 summary → R2.6/R2.7.
3. **10-16** feature freeze, field tests, full ST matrix · **10-17** video, deck, submit.

## Rule for every item
Before starting any item, run the SAFETY.md §7 review; update affected risk IDs in the same PR.
