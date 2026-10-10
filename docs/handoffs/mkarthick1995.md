# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r0.3-vertex-gcp-setup

## Now
- R0.3 nearly done: project `project-d8d384af-4155-46fa-a3c` ("footprint-aicup") with billing, alerts, APIs,
  Firestore (asia-southeast1), restricted Maps key, SA `footprint-api`, `.env` filled. Gemini runs on **Vertex AI**
  (ADR-030) — Developer API needed AI Studio prepaid credit.
- Scaffold merged (PR #12); `build-test` is a required check.

## Next
1. Send teammates' Google emails → IAM Editor grants; teammates follow docs/SETUP_GCP.md + `npm install`.
2. Merge this PR manually (R1.4 wording change = declared deviation).
3. R1.5 deploy: first Cloud Run deployment with the `footprint-api` service account; restrict Maps key to that URL.
4. Record 3–5 street clips into data/clips/ (local only); blind-user outreach (ETH-02); Discord (deadline time, credits).

## Blockers
- (none)

## Gotchas / learned
- Gemini Developer API returns 402 without AI Studio prepaid credit; Vertex AI uses the GCP trial (ADR-030).
- Vertex Live: native-audio model needs AUDIO + output transcription (TEXT rejected); only us-central1.
- gcloud on Windows: `%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`; from Git Bash, args with
  spaces break — use PowerShell. API keys used in the last 7 days need `--no-check-existing-usage` to delete.
- `temp/` = owner's inbox (gitignored); consumed files get deleted.
- Repo-local git email is the GitHub noreply address. Editing ROADMAP.md = declared deviation (no auto-merge).
- Owner PRs auto-merge after checks — open as draft or label `no-automerge` to review first. Squash only.
