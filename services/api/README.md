# services/api — Cloud Run backend

Fastify + TypeScript. `npm run dev:api` (from repo root) → http://localhost:8080, reads `../../.env`.

| Endpoint | Status |
|---|---|
| `GET /api/healthz` | done |
| `POST /api/session-token` | 501 until R1.4 (ephemeral Gemini Live token, ADR-029) |
| `POST /api/observations` | 501 until R2.3 (ADR-020/025) |

Serves `apps/web/dist` on the same URL. Never logs request bodies (PRI-06). Deploy: see `docs/SETUP_GCP.md`.
