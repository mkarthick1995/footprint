# Footprint

**Every walk leaves a footprint for the next person.**
A voice-first street co-pilot for blind and low-vision pedestrians in JAPAC cities.
Instant on-device hazard alerts · Gemini Live street understanding and walking guidance ·
every walk improves a shared street-accessibility map.

> Built for the **Google Cloud AI Builder Cup 2026** — theme: *Sustainability & Social Impact*.
> ⚠️ Assistive technology prototype. It does **not** replace a white cane, guide dog, or orientation & mobility training.

| | |
|---|---|
| **Live app** | _coming soon (Cloud Run)_ |
| **Hazard map** | _coming soon_ |
| **Demo video** | _coming soon_ |
| **Status** | [`docs/STATUS.md`](docs/STATUS.md) |

## How it works
1. **Phone camera → on-device detection** for fast-moving dangers (people, vehicles, bikes) — spoken + haptic alerts in < 300 ms.
2. **Gemini Live** watches the street (~1 fps) and listens: describes footpaths, potholes, crossings; answers questions.
3. **Google Maps walking directions**, narrated and adapted by Gemini.
4. **Hazards are logged with GPS (no images)** to Firestore → a public accessibility map and safer routes for the next person.

Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Vision: [`docs/VISION.md`](docs/VISION.md)

## Safety, privacy & limitations
Footprint gives extra information about the street; it never tells you a path is safe or when to cross.
Faces of passers-by are blurred on the phone before any frame is sent; no images, video, or audio are stored;
hazard reports are anonymous and coarse. It can miss obstacles, can't see behind or beside you, works poorly in the
dark, and needs internet for scene descriptions. Full safety case, limitations, and test results:
[`docs/SAFETY.md`](docs/SAFETY.md).

## Tech
Gemini Live API · Cloud Run (asia-southeast1) · Firestore · Secret Manager · Google Maps Platform · MediaPipe (web) · PWA

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
