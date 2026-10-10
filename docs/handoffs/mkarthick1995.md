# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r0.3-vertex-gcp-setup

## Now
- Phase 0 done except R0.4 handles: GCP project ready (Vertex AI, Firestore, SA, restricted Maps key), teammates have
  Editor access, scaffold merged, `build-test` required.

## Next
1. Teammates: clone, `npm run setup -- --handle <x>`, `npm install`, follow docs/SETUP_GCP.md (gcloud + ADC);
   send GitHub handles → fill TEAM.md (R0.4).
2. R1.5 deploy: first Cloud Run deployment with SA `footprint-api`; restrict Maps key to that URL.
3. Record 3–5 street clips into data/clips/ (local only); blind-user outreach (ETH-02); Discord (deadline time, credits).
4. 10-11: thin slice per ADR-028.

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
