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
| **To verify (R0.5/R0.7):** ephemeral-token support per tier (Gemini API vs Vertex AI), current Live model ID, Live session limits | — | Open | — |

## Devices & platform
| Fact | Checked | Confidence | Source |
|---|---|---|---|
| Meta Wearables Device Access Toolkit: phone app receives glasses camera (≤ 720p/30 fps over Bluetooth); apps don't run on glasses; native iOS/Android only; some features country-gated | 10-10 | Official docs + press | [Meta FAQ](https://developers.meta.com/wearables/faq), [overview](https://wearables.developer.meta.com/docs/develop/dat/build-overview/) |
| Browser camera access stops when the screen locks / page is backgrounded; iOS Safari has no `navigator.vibrate` | 10-10 | Well-known platform behaviour | MDN / WebKit (verify per device in R1.1) |
| COCO-class on-device detectors (e.g. MediaPipe EfficientDet) detect people/vehicles/bikes, **not potholes, kerbs, drains** | 10-10 | High | MediaPipe model cards |
