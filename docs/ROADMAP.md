# Roadmap — the core plan (changes need user confirmation + an ADR)

Today: 2026-10-10 · **Feature freeze: 10-16 EOD** · **Submit: 10-17** (hard deadline 10-18).
Every task, commit, and PR maps to one item ID below. Work outside these IDs is a **deviation** (AGENTS.md §4).
Owners A/B/C are proposed — confirm in `docs/TEAM.md`.

## Phase 0 — Setup (10-10 → 10-11)
| ID | Item | Owner | Exit criteria |
|---|---|---|---|
| R0.1 | Team formation confirmed on Hack2skill (3rd member accepted) | A | Before **10-11** closes |
| R0.2 | Repo scaffold, guardrails, docs; pushed to GitHub (public) | A | All 3 cloned + `npm run setup` done |
| R0.3 | GCP project, billing/credits, Gemini API key, Maps key, region `asia-southeast1` | A | Keys in each `.env`, Secret Manager ready |
| R0.4 | Confirm stack (ADR-003) and owners | All | ADR-003 → Accepted |
| R0.5 | Verify: Gemini Live ephemeral tokens, current Live model ID, Meta toolkit country availability | A | Findings in DECISIONS / ARCHITECTURE |
| R0.6 | Protected `main` + CODEOWNERS + required checks enabled on GitHub (ADR-008) | A | A test PR can't merge without owner approval |

## Phase 1 — Core loop (10-11 → 10-13)
| ID | Item | Owner | Exit criteria |
|---|---|---|---|
| R1.1 | PWA camera capture (rear camera, screen-wake lock) | B | Works on Android Chrome + iOS Safari |
| R1.2 | On-device obstacle detection (MediaPipe / TF.js), proximity heuristic | B | ≥ 10 fps on a mid-range phone |
| R1.3 | Voice alerts (TTS) + haptics + alert priority/cool-down | B | No alert spam; critical alerts interrupt |
| R1.4 | Cloud Run API: ephemeral token endpoint; client ↔ Gemini Live session (video ~1 fps + audio) | A | Ask a question, get spoken answer |
| R1.5 | **Deploy skeleton to Cloud Run** (early!) + HTTPS URL | A | Public URL works from a phone |

## Phase 2 — Differentiators (10-13 → 10-15)
| ID | Item | Owner | Exit criteria |
|---|---|---|---|
| R2.1 | Walking directions (Maps Routes API) narrated/adapted by Gemini | C | Turn-by-turn spoken on a real walk |
| R2.2 | Gemini structured hazard extraction (pothole, no footpath, open drain, speed breaker) → JSON | A | Schema-valid output on test clips |
| R2.3 | Hazard logging to Firestore (type, GPS, time, confidence — no imagery) | C | Writes from a walk appear in DB |
| R2.4 | Public hazard map dashboard (judges can open without a phone) | C | Map renders from Firestore |
| R2.5 | Street-segment accessibility score (Gemini-assisted) + "safer route" suggestion | C | Score visible on map |

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

## Cut order if late (cut from the top)
R3.x → R2.5 → R3-quality polish → R2.1 narration (keep plain directions). **Never cut:** R1.x, R1.5, R2.3, R2.4, R4.x.
