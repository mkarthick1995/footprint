# services/api — Cloud Run backend

Not scaffolded yet (waits for ADR-003, roadmap R1.4).
Planned endpoints: `POST /session-token` (ephemeral Gemini Live token) · `POST /hazards` · `GET /hazards?bbox=` ·
`GET /segments?bbox=`. Secrets via Secret Manager. Region `asia-southeast1`.
