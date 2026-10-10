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
| Cloud Run front end returns **411** for a POST with no body/Content-Length (not an app error) | 10-10 | Tested | own smoke test |
| Native-audio Live models **reject TEXT-only** output (1007 close); workaround: AUDIO + `output_audio_transcription`, discard audio; non-native Live models accept TEXT | 10-10 | Developer reports + Google docs example | [GitHub issue](https://github.com/kizuna-ai-lab/sokuji/issues/93), [Vertex Live API](https://cloud.google.com/vertex-ai/generative-ai/docs/live-api) |
| **To verify (R3.3):** RDD2022 road-damage dataset (images incl. Japan & India) — licence and suitability for a web pothole model | — | Unverified recollection | — |
| Firestore has no native geo queries; geohash range queries (e.g. `geofire-common`) are the standard workaround | 10-10 | High | Firebase docs ("Geo queries") |
