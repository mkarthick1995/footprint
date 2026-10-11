# Footprint

**Every walk leaves a footprint for the next person.**
A voice-first street co-pilot for blind and low-vision pedestrians in JAPAC cities.
Instant on-device hazard alerts · Gemini Live street understanding and walking guidance ·
every walk improves a shared street-accessibility map.

> Built for the **Google Cloud AI Builder Cup 2026** — theme: *Sustainability & Social Impact*.
> ⚠️ Assistive technology prototype. It does **not** replace a white cane, guide dog, or orientation & mobility training.

| | |
|---|---|
| **Live app** | https://footprint-804307041024.asia-southeast1.run.app (on-device alerts + Gemini scene scan; features land daily) |
| **Hazard map** | https://footprint-804307041024.asia-southeast1.run.app/map |
| **Demo video** | _coming soon_ |
| **Status** | [`docs/STATUS.md`](docs/STATUS.md) |

## How it works
1. **Phone camera → on-device detection** (MediaPipe, 14–30 fps) for moving dangers — people, bikes, vehicles —
   with time-to-contact; spoken + haptic alerts with no network round trip.
2. **Gemini scene scan** (Vertex AI, `gemini-3.6-flash`): every ~2.5 s one face-blurred photo → structured JSON of
   ground hazards the phone model can't see — potholes, open drains, kerbs and steps, missing footpath, crossings.
   Answers older than 2 s are dropped; nothing is stored.
3. **Gemini Live on demand**: ask a question by voice ("is there a footpath on my left?"); the answer is filtered for
   safety and spoken by the app. *(in progress)*
4. **Hazards are logged with GPS (no images)** to Firestore → a shared accessibility map, so every walk warns the
   next person: "Pothole reported ahead, 3 walkers". A hazard needs two separate walks to be confirmed; nothing is
   shared within 200 m of where a walk starts or ends.

One alert manager decides what is said and when (most urgent first, merged, rate-limited); a safety filter blocks any
"all clear", crossing instruction or description of people.

Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Vision: [`docs/VISION.md`](docs/VISION.md)

## Safety, privacy & limitations
Footprint gives extra information about the street; it never tells you a path is safe or when to cross.
Faces of passers-by are blurred on the phone before any frame is sent; no images, video, or audio are stored;
hazard reports are anonymous and coarse. It can miss obstacles, can't see behind or beside you, works poorly in the
dark, and needs internet for scene descriptions. When something fails — camera covered or too dark, phone pointed at the
ground, internet lost, detector stalled — it says so out loud and tells you what still works. Full safety case, limitations, and test results:
[`docs/SAFETY.md`](docs/SAFETY.md).

## Tech
Gemini on Vertex AI (scene scan: gemini-3.6-flash · Live API) · Cloud Run (asia-southeast1) · Firestore · Maps JavaScript API · Secret Manager · Google Maps Platform · MediaPipe (web) · PWA

## Development
```bash
npm run setup -- --handle <your-github-handle>   # git hooks, .env, your handoff file
npm run status                                    # project brief
npm run check                                     # secret scan + docs sync
npm install                                       # dependencies (Node 22)
npm run dev:api & npm run dev:web                 # API on :8080, web on :5173 (proxies /api)
npm test && npm run build                         # unit tests, production build
```
Layout: `packages/shared` (types + pure safety logic) · `apps/web` (PWA) · `services/api` (Cloud Run, serves the web build).
Contributors and AI assistants: start with [`AGENTS.md`](AGENTS.md).

## Team
See [`docs/TEAM.md`](docs/TEAM.md).
