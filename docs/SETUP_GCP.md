# Google Cloud setup (R0.3) — current state and how to reproduce it

Decisions: ADR-014, ADR-017, ADR-030 (Gemini on Vertex AI). Never paste keys into chat, issues, PRs, or committed
files — only into your local `.env` (gitignored).

## Current state (2026-10-10)
| Item | Value / status |
|---|---|
| Project | `project-d8d384af-4155-46fa-a3c` (display name `footprint-aicup`), owner @mkarthick1995 |
| Billing | $300 free trial linked; budget $100 with alerts at 25 / 50 / 100 % |
| APIs | Generative Language, Vertex AI, Cloud Run, Cloud Build, Artifact Registry, Firestore, Secret Manager, Routes, Maps JavaScript, API Keys |
| Firestore | `(default)`, Native mode, **asia-southeast1** |
| Gemini | **Vertex AI** (trial-billed). Scan `gemini-3.8-flash` @ global; Live `gemini-live-2.5-flash-native-audio` @ us-central1 |
| Runtime identity | service account `footprint-api@project-d8d384af-4155-46fa-a3c.iam.gserviceaccount.com` — roles `aiplatform.user`, `datastore.user`; **no key file** |
| Maps key | `footprint-maps-browser`, restricted to Maps JavaScript + Routes APIs + HTTP referrers `https://footprint-804307041024.asia-southeast1.run.app/*` and `http://localhost:5173/*` |
| AI Studio key | none — Gemini Developer API needs prepaid AI Studio credit, not used (ADR-030) |
| Owner ADC | `gcloud auth application-default login` done; verified against Vertex AI and Firestore (2026-10-10) |
| Teammates | both granted Editor and added as GitHub collaborators (2026-10-10); each runs the local setup below |
| Cloud Run | service `footprint` → https://footprint-804307041024.asia-southeast1.run.app (asia-southeast1, SA `footprint-api`, max 2 instances, timeout 3600 s) |
| Build account | `804307041024-compute@developer` has `roles/run.builder` (needed for source deploys in new projects) |

## Everyone: local setup
1. **gcloud CLI** — `winget install Google.CloudSDK` (Windows) / `brew install --cask google-cloud-sdk` (macOS).
   On Windows the binary is at `%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd` until a new terminal
   picks up PATH. Calling it from Git Bash with arguments that contain spaces breaks — use PowerShell for those.
2. `gcloud auth login` → `gcloud config set project project-d8d384af-4155-46fa-a3c` → `gcloud config set run/region asia-southeast1`.
3. `gcloud auth application-default login` — lets the local API call Vertex AI and Firestore as you, with no key file.
4. `.env` — copy values from `.env.example`; the owner shares the Maps key privately.

## Owner: grant a teammate access
`gcloud projects add-iam-policy-binding project-d8d384af-4155-46fa-a3c --member=user:<email> --role=roles/editor`
(emails stay out of the repo).

## Deploy (R1.5)
`npm run deploy` → `infra/deploy.mjs` (gcloud on PATH; Windows: open a new terminal after installing gcloud).
Builds the root `Dockerfile` with Cloud Build, deploys service `footprint` with the runtime SA and non-secret env vars.
No secrets are passed — Gemini/Firestore auth comes from the service account (ADR-030).
**Preview an unmerged branch** (phone DoD checks, ADR-031): `PREVIEW_TAG=q01 npm run deploy` → `https://q01---footprint-bubu3vkhwa-as.a.run.app`,
0 % of live traffic. Tags need ≥ 3 characters. Production deploys happen only after the owner verifies and merges, and always end with
`update-traffic --to-latest` (a preview would otherwise leave live traffic pinned to an old revision).

## Before judging (R4.5)
- Min instances = 1 during 10-19 → 11-06 (REL-03); re-check model IDs (REL-02, REL-07); review max instances.
