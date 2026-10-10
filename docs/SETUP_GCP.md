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
| Maps key | `footprint-maps-browser`, restricted to Maps JavaScript + Routes APIs (add HTTP-referrer restriction once the Cloud Run URL exists) |
| AI Studio key | none — Gemini Developer API needs prepaid AI Studio credit, not used (ADR-030) |
| Teammates | pending: IAM Editor grants |

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

## Later (R1.5 / R4.5)
- Deploy: `gcloud run deploy footprint --source . --region asia-southeast1 --allow-unauthenticated
  --service-account footprint-api@project-d8d384af-4155-46fa-a3c.iam.gserviceaccount.com
  --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=...,GEMINI_SCAN_MODEL=...` (script lands in `infra/`).
- Cloud Run request timeout up to 60 min for the Live WebSocket proxy; session caps per R2.7.
- During judging (10-19 → 11-06): min instances = 1 (REL-03); re-check model IDs (REL-02, REL-07).
