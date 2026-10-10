# Verified facts — check here before researching again (saves tokens)

Each fact: date checked · confidence · source. **Re-verify anything marked "third-party" against official docs
before it goes in the deck or drives a decision.** Add new facts here whenever you look something up.

## Hackathon
| Fact | Checked | Confidence | Source |
|---|---|---|---|
| Submission deadline 2026-10-18; team formation closed 10-11; finale Singapore 12-04; 2 travellers per team | 10-07 | Official | aibuildercup.com (see HACKATHON.md) |
| Must use Gemini/Gemma or Google agentic platforms; deploy on Cloud Run or Firebase | 10-07 | Official | aibuildercup.com/themes.html |
| Submission = deployed link + public repo + video < 3 min + PDF deck | 10-07 | Official | aibuildercup.com/Faqs.html |
| **No cloud credits** mentioned for participants (prizes + travel only) | 10-10 | Medium (absence of evidence) | Official pages + listings; ask on Discord |

## Gemini / Google Cloud
| Fact | Checked | Confidence | Source |
|---|---|---|---|
| Live API video input ≈ **1 fps**; stateful WebSocket; no published latency numbers | 10-10 | Official docs | [Vertex AI Live API streams](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/send-audio-video-streams) |
| Free-tier Gemini API content **may be used to improve Google products**, human review possible; paid tiers not used for training | 10-10 | Third-party, consistent | [geotoolbox](https://geotoolbox.ai/blog/gemini-api-pricing.md), [costbench](https://www.costbench.com/software/llm-api-providers/google-gemini-api/free-plan/) |
| Free-tier rate limits are low; reportedly cut in April 2026; Pro models paid-only; limits per project | 10-10 | Third-party, conflicting numbers | [agentdeals](https://agentdeals.dev/gemini-api-pricing-changes), [tinkerllm](https://tinkerllm.com/blog/gemini-api-free-tier-limits-rate-quotas/) |
| New Google Cloud customers: **$300 trial credit**, ≈ 90 days, reportedly usable for Vertex AI / Gemini | 10-10 | Official ($300) / third-party (90 days, Gemini) | [cloud.google.com/free](https://cloud.google.com/free/), [Spendbase](https://www.spendbase.co/blog/saas-management/how-to-get-free-google-cloud-credits/) |
| Gemini Live "Guided Vision" for blind/low-vision launched ~2026-10-01; disclaims navigation & obstacle detection | 10-10 | Single third-party source | [Unite.ai](https://www.unite.ai/?p=477889) |
| Ephemeral tokens: Gemini Developer API only (v1alpha), not Vertex AI; default 1 min to start a session, 30 min to send; can lock config | 10-10 | Official (tokens) / third-party (Vertex absence) | [ai.google.dev ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [tessl SDK docs](https://tessl.io/registry/tessl/npm-google--genai/files/docs/auth-tokens.md) |
| Live session limits: audio-only 15 min, audio+video **2 min** without compression; connection ~10 min; context window compression removes the cap; resumption handle valid ~2 h (Vertex says 24 h); GoAway warning | 10-10 | Official | [Live session management](https://ai.google.dev/gemini-api/docs/live-session), [Vertex sessions](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/start-manage-session) |
| Live models seen: `gemini-3.1-flash-live-preview` (Mar 2026; inputs text/image/audio/video, outputs text+audio; page calls it legacy, points to "Gemini 3.8 Live"); Vertex `gemini-live-2.5-flash-native-audio` (GA, discontinue 2026-12-13) | 10-10 | Official pages | [3.1 Flash Live](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview), [changelog](https://ai.google.dev/gemini-api/docs/changelog), [Vertex 2.5 Live](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-live-api) |

## Devices & platform
| Fact | Checked | Confidence | Source |
|---|---|---|---|
| Meta Wearables Device Access Toolkit: phone app receives glasses camera (≤ 720p/30 fps over Bluetooth); apps don't run on glasses; native iOS/Android only; some features country-gated | 10-10 | Official docs + press | [Meta FAQ](https://developers.meta.com/wearables/faq), [overview](https://wearables.developer.meta.com/docs/develop/dat/build-overview/) |
| Browser camera access stops when the screen locks / page is backgrounded; iOS Safari has no `navigator.vibrate` | 10-10 | Well-known platform behaviour | MDN / WebKit (verify per device in R1.1) |
| COCO-class on-device detectors (e.g. MediaPipe EfficientDet) detect people/vehicles/bikes, **not potholes, kerbs, drains** | 10-10 | High | MediaPipe model cards |
| **Gemini Developer API needs AI Studio prepaid credit**: calls return 402 "prepayment credits are depleted"; the $300 GCP trial doesn't cover it | 10-10 | Tested (our project) | own test |
| **Vertex AI works on the GCP trial credit**: gemini-3.8-flash (global) and gemini-2.5-flash (global, asia-southeast1) answered | 10-10 | Tested | own test |
| Vertex Live: `gemini-live-2.5-flash-native-audio` works in **us-central1** with AUDIO + output transcription; TEXT rejected (1007); not in asia-southeast1; `gemini-3.8-live` not on Vertex | 10-10 | Tested | own test |
| Models visible to our Developer-API key (10-10): Live `gemini-3.8-live`, `gemini-3.1-flash-live-preview`, `gemini-2.5-flash-native-audio-*`; Flash `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.5-flash(-lite)`; `gemini-2.5-flash-lite` closed to new users | 10-10 | Tested | own test |
| New projects: Cloud Run **source deploy fails** until the default compute SA gets `roles/run.builder` (403 storage.objects.get on the run-sources bucket) | 10-10 | Tested | own deploy |
| `@mediapipe/tasks-vision` 1.1.0: wasm folder ~38 MB (3 variants); package doesn't export package.json (resolve main entry); EfficientDet-Lite0 float16 model 7.25 MB | 10-10 | Tested | own build |
| Desktop Chrome (GPU delegate): ~62 fps (rAF-capped), ~16 ms inference at 640 px; real street photo → 6–9 tracked people/vehicles | 10-10 | Tested | own browser test |
| Cloud Run revision tags must be **≥ 3 characters**; `--no-traffic --tag=x` gives a preview URL `https://<tag>---<service>-<hash>-as.a.run.app` | 10-10 | Tested | own deploy |
| A `--no-traffic` preview deploy **pins live traffic** to the old revision; later normal deploys stay at 0 % until `gcloud run services update-traffic --to-latest` | 10-10 | Tested (Q1 production deploy) | own deploy |
| Cloud Run front end returns **411** for a POST with no body/Content-Length (not an app error) | 10-10 | Tested | own smoke test |
| Native-audio Live models **reject TEXT-only** output (1007 close); workaround: AUDIO + `output_audio_transcription`, discard audio; non-native Live models accept TEXT | 10-10 | Developer reports + Google docs example | [GitHub issue](https://github.com/kizuna-ai-lab/sokuji/issues/93), [Vertex Live API](https://cloud.google.com/vertex-ai/generative-ai/docs/live-api) |
| **To verify (R3.3):** RDD2022 road-damage dataset (images incl. Japan & India) — licence and suitability for a web pothole model | — | Unverified recollection | — |
| Firestore has no native geo queries; geohash range queries (e.g. `geofire-common`) are the standard workaround | 10-10 | High | Firebase docs ("Geo queries") |
| Meta Ray-Ban glasses: 12 MP camera, ~100° (diagonal, ultra-wide) FOV per Meta's compare page (another model lists 122°; page doesn't make clear which); our owner's clip = 1584×2112 portrait, 30 fps, H.264, 3 min ≈ 460 MB. Portrait 3:4 at 100° diagonal → ≈ 71° horizontal (computed, ignores lens distortion) vs our 65° default → distances ≈ 10 % high | 10-10 | Medium (FOV), tested (file) | [Meta compare](https://www.meta.com/ai-glasses/compare/), own ffprobe |
| Real clip 1 (cycling, 3 min, 10 fps seek-sampled, desktop GPU): 21.8 ms mean inference at 720 px wide; labels seen: bench 136, car 86, person 18, train 12, potted plant 14, bus 9, stop sign 6 (frames) — "train/boat/airplane" are misreads of the canopy | 10-10 | Tested | own clip eval |
| **CC-BY walking-tour videos exist on Wikimedia Commons** (searchable via the Commons API, 480p VP9 transcodes downloadable): e.g. "Walking China – Nanjing Road" (CC BY 3.0, Walking China), "SINGAPORE – Chinatown at Night" (CC BY 3.0, POPtravel). Usable for testing and, with attribution, in the demo. Many are landscape 16:9 gimbal footage at chest height (narrow vertical FOV → nearby people's feet cut off) | 10-11 | Tested | [Commons](https://commons.wikimedia.org/wiki/File:SINGAPORE_-_Chinatown_at_Night_-_4K_60fps_(UHD).webm) |
| Clip eval after ADR-024 refinement 2 (10 fps, desktop GPU ~15 ms): Shanghai crowd 5 min — P0 1.3 % of frames (was 3.6 %), P1 19 %; Singapore night lane 5 min — P0 3.9 % (was 16.6 %), P1 35 %; Ray-Ban cycling — 0 P0 | 10-11 | Tested | own clip eval |
| Web dev/build used `@footprint/shared`'s compiled `dist/` → shared-source edits were invisible until rebuilt; fixed with a Vite alias to `packages/shared/src` (tsc typecheck still reads dist types, so root `npm run build` builds shared first) | 10-11 | Tested | own run |
| Owner's Android phone (Chrome, rear camera, preview q03): detector loop **14–30 fps** — Q2 target ≥ 10 met (delegate GPU/CPU not reported) | 10-11 | Tested (owner) | own phone test |
