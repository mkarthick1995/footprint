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
**Proposed** · 2026-10-10 — confirm in R0.4
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
**Proposed** · 2026-10-10 — decide in R0.7
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
**Proposed** · 2026-10-10 — confirm in R0.3 · related ADR-014
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
**Proposed** · 2026-10-10 — verify costs/latency and Live text output in R0.5 · refines ADR-004
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
**Proposed** · 2026-10-10 — implement in R2.3 / R2.6
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
**Proposed** · 2026-10-10 — simple version in R2.5
- Per segment: footpath coverage %, surface issues, confirmed hazards, crossing types, data freshness, number of
  walks. Route summary spoken at start: "Footpath on about 70 % of this route, 2 reported potholes, one busy crossing
  without a signal. Data from 5 walks, newest yesterday."
- Simple, explainable rule-based score (no ML) shown on the map; **never called "safe"** (ADR-012).
- **Cold start:** no data → "No community information for this street yet" — absence of reports is never presented
  as good (SAF-20).
- Personal weighting (cane user / guide dog / low vision) is a stretch, not now.
Score: this is the Innovation 25 differentiator (personal help → community infrastructure); keep it simple but
visible. R2.5 stays the first cut, but only its "safer route suggestion" part — the spoken summary is cheap.

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
