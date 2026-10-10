# Google Cloud setup (R0.3)

Owner does steps 1–8 once; teammates do step 9–10. Decisions behind this: ADR-014, ADR-017, ADR-029.
Never paste keys into chat, issues, PRs, or committed files — only into your local `.env` (gitignored) or Secret Manager.

## Owner (once)
1. **Project** — console.cloud.google.com → New project `footprint-aicup` (note the generated project ID; it isn't secret).
2. **Billing** — Billing → start the **$300 free trial** and link it to the project. Billing is what moves Gemini to the
   **paid tier, which isn't used for training** (ADR-014). Never run the judged build on the free tier (ADR-017).
3. **Budget alerts** — Billing → Budgets & alerts → budget $100, email alerts at 25 % / 50 % / 100 %.
4. **Enable APIs** — APIs & Services → Library: Generative Language API · Vertex AI API (fallback) · Cloud Run Admin API ·
   Cloud Build API · Artifact Registry API · Cloud Firestore API · Secret Manager API · Routes API · Maps JavaScript API.
5. **Firestore** — Create database → **Native mode** → location **asia-southeast1 (Singapore)**, single region.
6. **Gemini key** — aistudio.google.com/apikey → *Create API key in existing project* → `footprint-aicup`.
   Check AI Studio shows the project on a **paid** tier. Note available Live / Flash model IDs for `.env` (ADR-029).
7. **Maps key** — APIs & Services → Credentials → Create API key → restrict to Routes API + Maps JavaScript API
   (add HTTP-referrer restriction to the Cloud Run URL once it exists).
8. **Team access** — IAM → Grant access → teammates' Google emails → role **Editor** (fine for a 7-day hackathon;
   tighten later). Each person creates their own Gemini key in AI Studio under the same project — no shared personal keys.

## Everyone
9. **gcloud CLI** — `winget install Google.CloudSDK` (Windows) / `brew install --cask google-cloud-sdk` (macOS), then
   `gcloud auth login` · `gcloud config set project <project-id>` · `gcloud config set run/region asia-southeast1`.
10. **`.env`** — fill `GEMINI_API_KEY`, `GEMINI_LIVE_MODEL`, `GEMINI_SCAN_MODEL`, `GOOGLE_CLOUD_PROJECT`,
    `GOOGLE_MAPS_API_KEY` (names in `.env.example`).

## Later (R1.5 / R4.5)
- Secrets for Cloud Run: `gcloud secrets create gemini-api-key --data-file=-` (paste via stdin, never on the command line).
- Deploy: `gcloud run deploy footprint-api --source services/api --region asia-southeast1 --allow-unauthenticated
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest` (exact script lands in `infra/` with R1.5).
- During judging (10-19 → 11-06): min instances = 1 (REL-03); re-check model IDs (REL-02).
