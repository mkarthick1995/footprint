# Decisions (ADR log) — append-only

Format: `## ADR-NNN Title` · Status (Proposed / Accepted / Superseded by ADR-x) · Date · Context · Decision · Score impact.
Reversing an *Accepted* ADR is a deviation (AGENTS.md §4): add a new ADR that supersedes it.

## ADR-001 Product idea: accessible-street co-pilot
Accepted · 2026-10-10
Context: Ideas evaluated — dev-context framework (saturated: claude-mem, Kiro specs, Memorix), hierarchical agent tree
(interesting, weak demo), self-retraining finance model (not novel, weak GenAI score), drone navigation (high setup
risk, hard to deploy for judges). Decision: blind / low-vision street co-pilot with a shared accessibility map.
Score: strong Impact + UX; Innovation via the community map; Tech via the layered live architecture.

## ADR-002 Phone-first PWA; Meta glasses are a stretch goal
Accepted · 2026-10-10
Context: Meta Wearables toolkit needs a native app and is country-gated; 8 days left. Decision: PWA on phone camera
(chest-mount for demo); glasses = R3.1 only if Phase 2 is done. Score: protects the deployed-link requirement.

## ADR-003 Stack: TypeScript end to end
Accepted · 2026-10-10 (confirmed by owner)
Proposal: `apps/web` = Vite + TypeScript PWA; `services/api` = Node 22 + TypeScript (Fastify or Express) on Cloud Run;
`@google/genai` SDK; Firestore; Google Maps JS + Routes API; MediaPipe Tasks Vision (web).
Why: one language for 3 people, shared types, guard scripts already Node. Alternative: Python FastAPI backend
(better if someone is much stronger in Python or wants ADK).

## ADR-004 Layered latency: on-device for danger, Gemini for understanding
Accepted · 2026-10-10
Context: Live API video ≈1 fps + network delay; unsafe as the only hazard detector. Decision: see ARCHITECTURE.md.
Score: Tech (sound engineering) + Impact (safety credibility with judges).

## ADR-005 No vector DB for AI context
Accepted · 2026-10-10
Context: Asked whether a local vector DB would help token usage. Repo docs are ~10 files; grep + a STATUS/handoff
protocol is cheaper, tool-agnostic, and reviewable in PRs. A vector DB adds setup per member, drifts from the
truth, and Gemini/Claude users would need the same integration. Revisit only if docs exceed ~50 files.

## ADR-006 AGENTS.md is the single source of AI instructions
Accepted · 2026-10-10
CLAUDE.md / GEMINI.md import it. Enforcement is tool-agnostic (git hooks + CI) plus Claude hooks.

## ADR-008 Protected main, feature branches, mandatory code-owner approval
Accepted · 2026-10-10
Decision: `main` changes only via squash-merged PRs from `r<id>-*` branches. The lead is the sole code owner and
mandatory approver. Deviations must be declared in the PR (Why / Score impact / ADR) and marked in code with
`DEVIATION(ADR-0xx)` comments; CI `pr-guard` rejects undeclared ones. AI may review but never approve or merge.
Score: protects demo stability and keeps the build on the scoring roadmap. Cost: owner is a review bottleneck —
review PRs at least twice a day, keep PRs small.

## ADR-009 Product name: Footprint
Accepted · 2026-10-10
Tagline: "Every walk leaves a footprint for the next person." Chosen because it carries both halves of the product
(personal guidance + community map) and is short and clear over text-to-speech. Rejected: StreetSense (likely
existing firm), Jalan (opaque outside Malay/Indonesian), WalkWise (generic), "Sight/Eye" names (crowded),
anything using Google marks. A 2026-10-10 search found no accessibility/navigation app named Footprint; "Footprint"
is a common word used by unrelated companies, so it's fine for the hackathon but needs a trademark check before
any commercial launch.

## ADR-011 Safety-first development: risk register + multi-angle review
Accepted · 2026-10-10
Decision: `docs/SAFETY.md` is the product's safety case. Every idea/feature/PR runs the §7 review; risks get IDs
before code; a risk is "Mitigated" only with a passing ST test, else Planned (R-id) or Accepted+Disclosed. Unknown
situations follow the §2 fail-safe defaults and degradation ladder. Safety items R1.6–R1.8, R2.6, R2.7, R4.7 added
to the roadmap and are never cut. Cost: ~1.5 dev-days of the 7 remaining; paid for by cutting R2.5/R3.x first.
Score: Impact (credible for real users), Tech (sound engineering), deck differentiation.

## ADR-012 Never an "all clear"; never a crossing instruction
Accepted · 2026-10-10
The app reports detections with uncertainty and never says a path/crossing is safe or tells the user to go/cross;
traffic-signal state is "appears … — verify" or omitted. Enforced by system instruction + output filter + ST-07/08.
Rationale: missed hazards are unavoidable (SAF-01); false reassurance is what turns a miss into an injury.

## ADR-013 On-device face blur before frames leave the phone
Accepted · 2026-10-10 (performance to be confirmed in R1.8)
MediaPipe face detection in the browser → blur → downscale → send to Gemini. Bystanders never consented; this
keeps identifiable faces off the network entirely. Fallback if fps drops below the R1.2 target: heavy downscaling,
no storage, and disclosure — decided in an ADR update, never silently.

## ADR-014 Gemini tier must not train on our frames
Accepted · 2026-10-10 (confirmed by owner; concrete tier — paid Gemini API vs Vertex AI — picked after R0.5 checks ephemeral-token support)
Unpaid tiers of some Google AI services may use submitted content to improve products; paid Gemini API and
Vertex AI terms state they don't. Verify current terms, then pick the tier (and check ephemeral-token support for it).
Until decided, no real street footage with bystanders is sent from development builds.

## ADR-015 Browser app (PWA) for the hackathon; native Android is the long-term client
Accepted · 2026-10-10 · extends ADR-002
Why PWA now: judges need a tappable deployed link (an APK needs sideloading); the web client itself is hosted on
Cloud Run, which strengthens "deployed on Google Cloud"; one TypeScript codebase for 3 people in 7 days; no store
review; same code on PC (dev/demo) and phones; reaches iPhone users too (VoiceOver is popular with blind users).
Known PWA limits (disclosed, SAFETY.md §4 / SAF-05): camera stops when the screen locks or the app is backgrounded,
so the screen must stay on; slower on-device ML than native; weak/no haptics (none on iOS Safari); limited audio
routing; no Meta-glasses access (toolkit is native-only).
Long term: native Android (Kotlin + native MediaPipe/LiteRT), then iOS — or Capacitor as a bridge reusing web code.
Backend, Gemini integration, hazard map, and the safety/wording rules stay unchanged; keep the safety pipeline a
separate, portable module. Pitch line: "web prototype anyone can try today; production path is native + glasses."

## ADR-016 Development & test strategy: PC with recorded clips, real phone from day 2
Accepted · 2026-10-10
- One codebase. Daily development on PC in the browser using a **frame-source abstraction**: live camera *or* a
  recorded street clip played as the camera. Clips make tests repeatable (ST-07/12/13) and avoid sending live
  bystander footage while on a free tier.
- **Real Android phone testing from day 2** via the Cloud Run HTTPS URL (R1.5) — camera permissions, on-device fps,
  Wake Lock, TTS, battery/thermal only show up there. iPhone tested but not blocking.
- No native app in the hackathon (only for the R3.1 glasses stretch).

## ADR-017 Gemini access & billing
Accepted · 2026-10-10 (confirmed by owner) · related ADR-014
Facts found (2026-10-10, third-party sources — verify on Google's pages): Gemini API free tier exists but free-tier
content may be used to improve Google products and may be read by human reviewers; paid tiers aren't used for
training; free-tier rate limits are low and were reportedly cut in April 2026; Live API free limits unclear. The
hackathon offers prizes/travel but **no cloud credits** were found. New Google Cloud customers get a **$300 trial
credit** (≈ 90 days, reportedly usable for Vertex AI / Gemini).
Proposal: free tier only for early dev with **people-free clips**; real build on the owner's GCP project with the
$300 trial → paid Gemini tier (no training on our data), Cloud Run, Firestore. Budget alerts at $25 / $50 / $100,
Live session length caps (R2.7). Teammates get IAM access — no sharing personal keys. Ask organizers on Discord about
credits. Risk: free-tier quota hit during judging = broken demo → never judge on the free tier.

## ADR-018 Gemini in the app from day one; Claude/other LLMs only as coding tools
Accepted · 2026-10-07 (recorded 2026-10-10)
Context: the team codes with Claude Code / Gemini CLI. Swapping a Claude-tuned runtime to Gemini at the end breaks
prompts, tool-calling, and structured output, and the judged build must be Gemini-centric (40 % Tech & GenAI,
"Best use of Google Cloud AI tools" prize). Decision: the app calls only Gemini (or Gemma) from the first line of
runtime code; prompts and schemas are tuned on Gemini. No non-Google LLM in any runtime path — disqualification risk.

## ADR-019 Perception pipeline: on-device detector + two Gemini roles, Gemini never speaks directly
Accepted · 2026-10-10 (confirmed by owner; Live TEXT output + costs still verified in R0.5) · refines ADR-004
Layers:
1. **On-device detector (primary safety layer, 10–30 fps):** pre-trained COCO model in the browser (MediaPipe
   EfficientDet-Lite) — people, cars, motorbikes, bicycles, dogs, benches, hydrants. Proximity = box size + growth
   rate (time-to-contact) + position (centre vs edge). No training by us. COCO has **no potholes, kerbs, drains,
   poles** → those come from layer 2 (or R3.3 fine-tune on a public road-damage dataset, licence to verify).
2. **Gemini "scene scan" (structured, every ~2–3 s):** low-res blurred frame(s) → Gemini Flash-class model with a
   JSON response schema: static hazards (pothole, no footpath, open drain, speed breaker, obstruction), footpath
   presence/surface, crossing type, direction, rough distance, confidence. Feeds alerts *and* hazard logging.
   Not a running commentary: it only produces events.
3. **Gemini Live (conversation, user-initiated):** push-to-talk questions ("is there a footpath on my left?").
   **Response modality = TEXT, not audio**, so every answer passes the client-side safety filter before our TTS
   speaks it (ADR-012, SAF-21). Slightly slower; required for safety.
4. **Alert manager (fusion):** the only component that speaks; cautious signal wins; priority, dedupe, cool-down.
Why not "Gemini only at 1 fps": too slow for moving dangers (SAF-03), audio output can't be filtered, constant
narration masks traffic sounds (SAF-06), and cost scales with talk. Alternative (rejected for now): Live API for
everything — simpler, but unfilterable and harder to test.

## ADR-020 Community hazard data: Firestore + geohash, cluster → confirm → decay
Accepted · 2026-10-10 (confirmed by owner) — implement in R2.3 / R2.6
- Store: **Firestore (native) in asia-southeast1**, written only by Cloud Run (clients never write directly).
- `observations` (raw, anonymous, **TTL 7 days**): type, lat/lng (rounded ~5 m), GPS accuracy, confidence, source
  (scan | on_device | user_report), sessionId (random per walk), ts. Dropped if GPS accuracy > 25 m, inside the
  200 m trip-end trim zone, or implausible.
- `hazards` (clusters): same type within ~15 m merges; fields: geohash (precision 8 ≈ 38 m cells) + lat/lng,
  `reports` (distinct sessions), `notSeen` votes, `firstSeen`, `lastSeen`, `status` (unconfirmed | confirmed | expired).
  **Confirmed at ≥ 2 distinct sessions.** Decay: expires after N days without a fresh report (pothole 30, obstruction
  3, construction 14 — tune); a later walker whose scan sees nothing there adds a `notSeen` vote → faster expiry.
- `segments/{geohash7}` (≈ 150 m cells, hackathon stand-in for road segments): accessibility aggregates (ADR-021).
- Read path: at route start the client fetches confirmed hazards along the route corridor (geohash range queries)
  and caches them; refreshes every ~200 m. Alerts are phrased as **reported**: "Pothole reported about 20 m ahead,
  3 reports, last 2 days ago" — never "there is".
- User 1 walks → observations → clusters. User 2 walks the same street → hears confirmed reports and their own scan
  confirms (+1 report) or refutes (notSeen). No accounts, no user linkage.
- Later: Roads API snap-to-road for true segments; BigQuery GIS for city analytics.

## ADR-021 Route accessibility information (not a "safety" rating)
Accepted · 2026-10-10 (confirmed by owner) — simple version in R2.5
- Per segment: footpath coverage %, surface issues, confirmed hazards, crossing types, data freshness, number of
  walks. Route summary spoken at start: "Footpath on about 70 % of this route, 2 reported potholes, one busy crossing
  without a signal. Data from 5 walks, newest yesterday."
- Simple, explainable rule-based score (no ML) shown on the map; **never called "safe"** (ADR-012).
- **Cold start:** no data → "No community information for this street yet" — absence of reports is never presented
  as good (SAF-20).
- Personal weighting (cane user / guide dog / low vision) is a stretch, not now.
Score: this is the Innovation 25 differentiator (personal help → community infrastructure); keep it simple but
visible. R2.5 stays the first cut, but only its "safer route suggestion" part — the spoken summary is cheap.

## ADR-022 Alert prioritisation by time-to-contact, severity, path, and confidence
Accepted · 2026-10-10 (owner's proposal, refined) · implements R1.3, mitigates SAF-02
**Rank by time-to-contact (TTC), not distance.** TTC = distance ÷ closing speed. Static hazard: closing speed =
user's walking speed (≈ 1.4 m/s; from step cadence/GPS). Moving object: from the detector's box growth rate.
Example: pothole 1 m ahead → TTC ≈ 0.7 s; person 10 m ahead walking towards you → ≈ 3.5 s; cyclist 10 m at
5 m/s → ≈ 1.6 s. So the pothole wins, and the cyclist beats a pothole 3 m ahead.

**Tiers** (urgency = f(TTC) × severity × in-path factor; confidence adjusts wording, not suppression when close):
| Tier | Rule | Delivery |
|---|---|---|
| P0 Imminent | TTC < 1.5 s, or < 2 m and in path | Earcon + 1–2 words ("Stop — hole"); **interrupts** any speech; strong haptic |
| P1 Near | TTC 1.5–4 s in path | Short phrase with direction ("Pothole, 2 steps, slightly left"); interrupts P2/P3 |
| P2 Ahead | TTC 4–10 s, or near but off-path | Spoken when nothing higher is pending |
| P3 Context | Community reports beyond ~10 s, route summary, Gemini answers, scene info | Only when the queue is otherwise empty |
| SYS | Degradation-ladder changes (camera lost, offline, stopped) | Treated as P0, spoken right after any active P0 hazard |

Severity order (tie-break within a tier): drop-off / open drain > vehicle > pothole > cyclist > obstruction > person >
street furniture. In-path = centre of frame / along heading; edge-of-frame objects are downgraded one tier.

**Queue rules**
1. Same tier → order by TTC (first to be encountered first).
2. **Re-check at dequeue time:** recompute TTC with the latest frame / dead-reckoned distance; drop if passed, out of
   path, or older than its validity window. Never speak a stale alert (SAF-22).
3. **Merge** same-type nearby items: "Two potholes ahead, nearest 1 metre" instead of two messages.
4. Speak at most the top 1–2 items; the rest wait or expire — users can't parse lists while walking.
5. Per-object cool-down + hysteresis so the same object doesn't re-trigger or flap between tiers.
6. Low confidence + close → still alert, worded "possible obstacle"; low confidence + far → dropped (cautious wins).
7. Distances are spoken in buckets ("very close", "2 steps", "ahead"), not false-precision metres (SAF-23).
8. A user question to Gemini is P3: answered when no P0/P1 is pending; a P0 interrupts the answer mid-sentence.

## ADR-023 Adaptive verbosity: message style follows how demanding the street is
Accepted · 2026-10-10 (owner's proposal, refined) · extends ADR-022, mitigates SAF-06/07
**Always short.** Hard length caps by tier: P0 ≤ 2 words · P1 ≤ ~5 words · P2 ≤ 1 short sentence · P3 ≤ 2 sentences.

**Street demand level** (computed live, with hysteresis so it doesn't flap): number of active hazards/objects in
the last ~10 s + scene-scan footpath/surface/crossing findings + confirmed community hazards ahead. When signals
disagree, take the more demanding level (cautious wins).

| Level | Style | Rationale |
|---|---|---|
| **Demanding** (broken/no footpath, traffic, many hazards) | Frequent, very terse **signals** — but mostly earcons + haptics for recurring items; words only for P0/P1; P2/P3 muted; max ~1 spoken message per 3 s; one-time heads-up on entering: "Rough stretch — only close warnings" | Owner's point (many short) — refined: in exactly these streets the user must hear traffic, so more signals, fewer words (SAF-06) |
| **Moderate** | ADR-022 defaults | — |
| **Calm** (good footpath, few hazards) | Fewer, slightly longer context messages (route info, landmarks, surface changes) — max 2 sentences, sent in chunks so a P0 can cut in cleanly | Owner's point (few, larger) — kept short enough to never delay a P0 |

Also: **stationary users** may get longer descriptions; **user verbosity setting** (terse / normal / detailed) shifts
the defaults, because blind users vary widely. Level changes are signalled by a soft earcon, not speech.

## ADR-024 Motion & time-to-contact estimation from a single camera
Accepted · 2026-10-10 (confirmed by owner) — implement in R1.2, tune on clips · feeds ADR-022
1. **Track** each detection across frames (simple IoU/centroid tracker → stable object IDs). Need ≥ ~5 frames
   (~0.3 s) before trusting motion.
2. **Time-to-contact from looming** (no distance needed): TTC ≈ h ÷ (dh/dt), where h = bounding-box height in
   pixels. An object whose box grows 10 %/s is ~10 s away; 50 %/s ≈ 2 s. Works for anything, moving or static.
3. **Approximate distance** (for wording + context): pinhole model, distance ≈ focal_px × typical real height ÷ box
   height (person ≈ 1.7 m, car ≈ 1.5 m, bike ≈ 1.1 m); focal length from the camera's field of view, calibrated once.
4. **Object speed** = change in distance per second − user's own walking speed (step cadence from the accelerometer,
   GPS speed as a cross-check). Tells "coming towards me" vs "I'm walking up to it".
5. **Direction / in-path:** horizontal drift of the box centre → crossing vs approaching; predicted path inside the
   central corridor = in path.
6. **Noise control:** smooth with an exponential/Kalman filter; compensate phone sway with the gyroscope; ignore
   boxes cut off by the frame edge; low confidence → cautious tier + "possible".
Gemini is not used for speed (≈ 1 fps is too slow). Expected error is large (tens of %), hence bucketed wording
(SAF-23). Stretch: an on-device depth model if fps allows.

## ADR-025 Community map as an evidence model (how user 2 improves user 1's data)
Accepted · 2026-10-10 (confirmed by owner) — refines ADR-020, implement in R2.3
- **What improves is the shared street map, not an AI model.** Each walk is evidence about each place.
- **Hazard confidence** = Beta(α, β): every "seen" observation adds weight to α, every "passed by and not seen"
  adds to β; weight = detection confidence × recency decay (older evidence counts less). p = α ÷ (α + β).
- **Confirmed** when p ≥ 0.7 *and* ≥ 2 distinct walks; **expired** when p < 0.3 or no evidence for the type's TTL.
  Asymmetric on purpose: one walker's scan can't delete a confirmed hazard — removal needs ≥ 2 "not seen" walks or decay.
- **Street attributes** (footpath present, surface, kerb ramps, crossing type, obstructions) are running estimates per
  segment with counts + freshness, updated the same way; feeds ADR-021 route info.
- Storage unchanged: Firestore asia-southeast1; raw `observations` TTL 7 days; aggregates persist. Later: BigQuery
  export for city analytics; per-country regions if data-residency rules require (PRI-09).
- **We do not retrain detection models from community data**: we store no images (ADR-007/013), so there's nothing
  to train on. Better models would need a separate, opt-in, consented, blurred data programme — future work, disclosed.

## ADR-026 User-controlled alert levels with a safety floor
Accepted · 2026-10-10 (owner's proposal, refined; confirmed) · extends ADR-022/023
- **Floor (cannot be turned off):** P0 imminent hazards and SYS (camera lost, offline, stopped). Safety rate caps also stay.
- **Presets instead of a 1–10 number:** *Essential* (P0 + P1 + SYS) · *Standard* (+ P2) · *Detailed* (+ P3 context,
  route info, landmarks). A 1–10 scale is hard to map to behaviour and hard to operate by voice/screen reader.
- **Category toggles:** community reports, route summary, landmarks, scene descriptions, Gemini answers read aloud.
- **Channel choice** per tier (speech / earcon / haptic) and speech rate. Voice commands: "fewer alerts", "more alerts".
- Stored **locally on the device** (no account); fully screen-reader operable; current preset announced at walk start.

## ADR-027 Don't rebuild turn-by-turn navigation; use the route only for hazards and the summary
Accepted · 2026-10-10 (confirmed by owner) — R2.1 rewritten
Context: Google Maps already offers accessible walking navigation with TalkBack/VoiceOver. Rebuilding spoken
turn-by-turn in 7 days duplicates it, adds risk SAF-11 (GPS error at turns), and competes with our alerts for the
user's ears. Proposal: R2.1 becomes "route corridor": user names a destination → Routes API gives the walking
polyline → used to prefetch community hazards along it and speak the ADR-021 route summary. Users keep Google Maps
(or any nav app) for turns; Footprint adds the street-level layer Maps doesn't have. Saves ≈ 1 dev-day for R1.6–R1.8.
Score: no loss on Innovation/Impact (our differentiator is hazards + community map); fewer failure modes.

## ADR-028 Build order: thin end-to-end slice first, then deepen
Accepted · 2026-10-10 (confirmed by owner)
Day 1–2 (10-11 → 10-12): one ugly but complete path, deployed — clip/camera → detector → alert manager (P0/P1 only)
→ TTS; scene scan → `/observations` → Firestore → map page; Cloud Run URL tested on a phone. Then deepen in order of
safety and score: R1.7 safety filter → R1.6 fail-loud → R1.8 face blur → ADR-022/023 tiers → R2.3 evidence model →
R1.4 Gemini Live Q&A → R2.5 summary → R2.6/R2.7. Feature freeze 10-16; 10-16 field tests + ST matrix; 10-17 video,
deck, submit. Rationale: integration problems surface on day 2, not day 6, and a demoable build exists at all times.
Shared TypeScript types (`packages/shared`: Observation, Hazard, Alert, Tier) are created first so 3 people can work
in parallel. Safety-critical pure logic (alert manager, output filter, evidence model) gets unit tests (Vitest).

## ADR-029 Gemini integration details (R0.5 findings)
Accepted · 2026-10-10 · settles ADR-014 tier, refines ADR-019
- **Tier = paid Gemini Developer API** (AI Studio key in the owner's billing-enabled GCP project). Ephemeral tokens
  exist only on the Gemini Developer API (v1alpha), not Vertex AI, and paid usage isn't used for training (ADR-014).
  Vertex AI stays the fallback (would need a Cloud Run WebSocket proxy).
- **Ephemeral tokens:** minted by Cloud Run per walk; default 1 min to open a session, 30 min to send messages; can be
  locked to a fixed config so the system instruction stays server-side.
- **Session limits:** audio+video sessions are capped at 2 min without compression (audio-only 15 min); a
  connection lives ~10 min. → enable **context window compression** + **session resumption** (handle valid ~2 h),
  reconnect on GoAway.
- **Text-only output:** native-audio Live models reject TEXT-only modality. → request AUDIO **with output audio
  transcription**, **never play the audio**, filter the transcript, speak it with our TTS (SAF-21). Use TEXT modality
  directly where the chosen model supports it (Gemini 3.1 Flash Live lists text output).
- **Video to Live only on demand:** for push-to-talk questions, send the current blurred frame(s) with the question
  instead of streaming video continuously → avoids the 2-min cap and cuts cost. Continuous street understanding is
  the separate scene scan (standard generateContent with JSON schema, ADR-019).
- **Model IDs change often** (seen: `gemini-3.1-flash-live-preview`, newer "Gemini 3.8 Live" referenced, Vertex
  `gemini-live-2.5-flash-native-audio`): keep model IDs in config (`GEMINI_LIVE_MODEL`, `GEMINI_SCAN_MODEL`), confirm
  in AI Studio once the key exists, re-check before submission (REL-02).

## ADR-030 Gemini on Vertex AI (trial-billed), Cloud Run proxies Live — supersedes ADR-029's tier and token parts
Accepted · 2026-10-10 (owner's choice) · settles ADR-014 / ADR-017
Context (tested 2026-10-10): the Gemini Developer API returns **402 "prepayment credits are depleted"** — it needs
prepaid credit in AI Studio, which the $300 Google Cloud trial doesn't cover. **Vertex AI works on the trial credit**
(gemini-3.8-flash and gemini-2.5-flash answered, global and asia-southeast1). Vertex Live:
`gemini-live-2.5-flash-native-audio` in **us-central1** works with AUDIO + output transcription (transcript correct);
TEXT-only is rejected (1007 "Text output is not supported for native audio output model"); not offered in
asia-southeast1; `gemini-3.8-live` is Developer-API only.
Decision:
- **All Gemini calls go through Cloud Run on Vertex AI**, authenticated by the runtime service account
  `footprint-api` (roles: aiplatform.user, datastore.user; no key file). The browser never holds Google credentials —
  no ephemeral tokens needed (more secure than ADR-029's design).
- Scan: `gemini-3.8-flash` on the global endpoint. Live Q&A: Cloud Run WebSocket proxy to Vertex Live in us-central1,
  AUDIO + transcription, proxy forwards **transcript text only** (SAF-21). Session compression/resumption per ADR-029.
- Vertex terms: customer data isn't used for training (ADR-014 satisfied).
- The AI Studio key was deleted; `GEMINI_API_KEY` is unused.
Trade-offs: extra hop for scan and Q&A (non-critical paths; hazard alerts stay on-device); Live from us-central1 adds
latency for Asia (REL-08); `gemini-live-2.5-flash-native-audio` discontinues **2026-12-13**, after judging (REL-07);
proxy must be rate-limited (SEC-02). Revisit AI Studio prepaid credit only if the newer Live model proves clearly better.

## ADR-031 Pull-based build queue with a strict Definition of Done
Accepted · 2026-10-10 (owner's process) · refines ADR-028 (order) and ADR-008 (workflow)
- Work is not pre-assigned. Whoever is available takes the **first unclaimed step** of the numbered build queue in
  `docs/STATUS.md` (Q1…Q14), each with an explicit **DoD**. The queue order implements ADR-028's safety-first order
  (face blur and the output filter come before anything is sent to or spoken from Gemini).
- **Claim = branch + STATUS line `[~] @handle` + draft PR**, opened immediately so others see the lock.
- **A step is either fully done or not done.** Non-draft code PRs must tick "fully completes step(s)" (CI `pr-guard`).
  Unfinished work is released explicitly (remaining items in PR + handoff), never merged as done.
- **The owner verifies** each PR with `/verify` (DoD, tests, ST checks, safety review) before merging, then deploys.
- AIs use `/next` to pick and claim, `/open-pr` to finish, and update STATUS in the same PR as the code.
Roadmap "Owner" columns are historical; ownership comes from claims.

## ADR-010 Auto-merge the code owner's PRs; teammates' PRs keep mandatory owner approval
Accepted · 2026-10-10 · amends ADR-008
Context: GitHub can't self-approve, and branch protection has no per-author rules. Decision: workflow
`automerge-owner` (workflow_run after `guardrails` succeeds) squash-merges PRs authored by @mkarthick1995 using an
owner PAT stored in the `automerge` environment (protected branches only). Required checks still gate every merge.
Skipped when: draft, `no-automerge` label, declared deviation, or head moved since checks ran.
Security: runs from main's copy of the workflow (PR can't modify it); secret unreachable from PR-branch workflows.
Risk accepted: owner PRs — including AI-written ones opened from the owner's account — get no human review. Mitigation:
use draft / `no-automerge` for anything non-trivial; deviations never auto-merge.

## ADR-007 Privacy: no images or video stored
Accepted · 2026-10-10
Only hazard type + GPS + time + confidence are persisted. Raw recordings stay local in `data/` (gitignored).
