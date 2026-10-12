# Follow-ups — improvements to Q1–Q3 (found in code review, 2026-10-11)

Review of the shipped steps Q1 (frame source), Q2 (detector + tracker + TTC) and Q3 (alert manager).
None of these block Q4. Q1–Q3 are marked done; these are polish and hardening items to schedule, not reopened steps.
Anything that changes behaviour must re-run the Q2 clip evaluation (`/clip-eval.html`) and note the numbers in STATUS.

| # | Finding | Where | Why it matters | Fix | Fold into | Effort |
|---|---|---|---|---|---|---|
| 1 | Perception loop is driven by `requestAnimationFrame`, not by camera frames | `apps/web/src/perception.ts` | On a 60 Hz display with a 30 fps camera the same frame can be detected twice. That inflates `hits`, so "≥ 5 frames before trusting motion" (ADR-024) may really be 2–3 distinct frames, and the reported fps overstates the camera rate | Drive the loop with `requestVideoFrameCallback` (fallback to rAF); skip a tick when `mediaTime` is unchanged. **Re-measure fps and re-run the clip evaluation** | Q2 follow-up (R1.2) | small |
| 2 | Object-detector model is fetched at runtime from `storage.googleapis.com` | `apps/web/src/detector.ts` (`MODEL_URL`) | Conflicts with "works offline after first load" and with a simple CSP (Q13); first load fails without network | Self-host the `.tflite` next to the WASM (extend `scripts/copy-mediapipe.mjs` or a build step) and cache it in the PWA | Q2 follow-up, before Q13 | small |
| 3 | API `bodyLimit` is 64 KB | `services/api/src/server.ts` | A 640 px JPEG at quality 0.7 is typically 40–90 KB, so scan uploads may be rejected | Raise to about 256 KB for the scan route only; keep the global limit small | **Q6** | trivial |
| 4 | `main.ts` grabs a frame every second only to print its size | `apps/web/src/main.ts` | Wasted work; dev readout only | Remove once Q4 provides the real upload path | **Q4** | trivial |
| 5 | `grabFrame()` returns **unblurred** frames; nothing stops later steps using it for uploads | `apps/web/src/frameSource.ts` | Q6/Q10 could send a face by mistake (PRI-01, PRI-10) | Export one sanctioned upload helper (`getUploadFrame`) that always blurs and fails closed; keep raw `grabFrame` internal; add a test or lint check | **Q4** | small |

## Infrastructure items to raise with the owner (read-only review of the live project, 2026-10-11)
| # | Topic | Finding | Suggested action | Fold into | When |
|---|---|---|---|---|---|
| 6 | Cost and abuse protection | The Cloud Run service is public (`allUsers` holds `roles/run.invoker`) and, once `/api/scan` exists, every request can trigger a paid Vertex AI call. Today the only guard is `maxScale=2` | Per-session rate limit and session length cap, plus a hard daily budget cap (not only alert emails), **before Q6 ships** | Q13 (R2.7) — consider pulling the rate limit forward into Q6 | Before Q6 merges |
| 7 | Region plan for voice questions | Cloud Run and Firestore are in `asia-southeast1`, the scan model uses the `global` endpoint, but Live voice Q&A must use `us-central1` (ADR-030: not offered in Singapore). Audio crosses the Pacific against the "< 3 s question → answer" target, and audio/frames leave Asia | Either accept the latency and state it (deck, SAFETY.md §4), or test whether a closer Live endpoint exists. Measure round-trip before promising 3 s | Q10 (R1.4) | Before Q10 starts |

## Face-blur follow-ups (from the Q4 phone test, 2026-10-11)
| # | Finding | Suggested action | Fold into | When |
|---|---|---|---|---|
| 8 | ~~The raw camera preview on screen is unblurred, so a screen recording shows bystanders' faces~~ **Done 2026-10-12:** the on-screen view is the blurred upload frame by default; the raw video is invisible. Watch the detector fps on a phone (one blur every 200 ms) | If fps drops, raise `PREVIEW_INTERVAL_MS` in `apps/web/src/main.ts` | R4.2 (demo video) | Check on phone |
| 9 | ~~`?debug=blur` works in production builds~~ **Obsolete 2026-10-12:** the parameter is gone; the blurred view is the default | None | Q4 | Closed |
| 10 | Faces that are small or far are not blurred well: detection runs on the 640 px downscaled frame | Detect on the full-resolution frame, then blur the 640 px copy; measure the extra milliseconds on a phone first | Q4 follow-up | After the phone measurement |

## Detector findings from the Q4 phone test (2026-10-11, Android, Brave, battery 23–24 %, indoors)
| # | Finding | Suggested action | Fold into | When |
|---|---|---|---|---|
| 11 | Object detector ran at **9.6–10.6 fps (94–102 ms per frame)** on this phone — borderline against the Q2 target of ≥ 10 fps; the owner measured 14–30 fps on his phone. Possible causes (unverified): Brave's privacy protections, Android battery saver at ~23 %, thermal throttling, a slower phone | Repeat in **Chrome**, with battery saver off and a charged phone, indoors and outdoors; record the device model. If still ~10 fps, lower the detector input rate or resolution | Q2 follow-up (R1.2), before the field test R4.1 | Before 10-15 |
| 12 | Indoors the app spoke **"Stop! Obstacle"** (imminent tier) with 0 objects tracked afterwards, while the phone was moving and the image was motion-blurred | Log which track triggered it; check the large-unknown and frame-fill rules; consider requiring the condition for ≥ 2 frames before a P0 on unknown types | Q2/Q3 follow-up (R1.2, R1.3), SAF-02 | After outdoor test |
| 13 | Mirrors and glass produce phantom "person" detections (a reflected person was tracked and blurred) | Add to SAFETY §4 (done); no code change planned. Consider a Gemini "this is a reflection" cue in Q6 | Q6 (R2.2) | Optional |

Other observations from the same review, lower priority: preview revisions and tags `q01`–`q03` are still present;
Firestore delete protection is off; many unused APIs are enabled; Cloud Build uses the default compute service
account; minimum instances is 0 (cold starts, planned change in R4.5). Budget alerts, Maps key restrictions,
Firestore rules and monitoring alerts were **not** checked.

## Ordering
- Items 3, 4 and 5 are absorbed by the step that already owns them (Q6 and Q4) — no separate work item.
- Items 1 and 2 are independent Q2 follow-ups. Do item 1 before the field test (R4.1) so the fps numbers in the deck
  are camera-frame rates, not display rates.

## Not verified
These came from reading the code, not from running it. The test suites were not executed during the review, and item 1's
effect (how many frames are duplicated) has not been measured on a device.
