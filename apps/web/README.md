# apps/web — PWA client

Vite + TypeScript. `npm run dev:web` (from repo root) → http://localhost:5173, proxies `/api` to the local API.

- `src/frameSource.ts` — camera or recorded clip (ADR-016)
- `src/main.ts` — start/stop, fail-loud announcements (temporary until the alert manager, R1.3)

Next: R1.2 detector + tracker (ADR-024), R1.3 alert manager (ADR-022/023/026), R1.6–R1.8 safety layers.
