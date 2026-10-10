# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r0.3-vertex-gcp-setup

## Now
- Q1 done (PR #19): phone-tested by owner (rear camera, screen on, pause/resume heard). Calm wording "Alerts are off"
  (ADR-032), best installed device voice (ADR-033). Natural Google voice deferred to R3.4 (near submission).

## Next
1. After #19 merges: `npm run deploy` (production) and smoke-test the live URL.
2. Q2 (detector + tracker) is the next unclaimed step — `/next`.
3. Teammates: setup + send GitHub handles → TEAM.md (R0.4).
4. Record 3–5 street clips into data/clips/ (local only); blind-user outreach (ETH-02); Discord (deadline, credits).

## Blockers
- (none)

## Gotchas / learned
- First source deploy needed `roles/run.builder` on the default compute SA. POST without a body → 411 from Cloud Run front end.
- Gemini Developer API returns 402 without AI Studio prepaid credit; Vertex AI uses the GCP trial (ADR-030).
- Vertex Live: native-audio model needs AUDIO + output transcription (TEXT rejected); only us-central1.
- gcloud on Windows: `%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`; from Git Bash, args with
  spaces break — use PowerShell. API keys used in the last 7 days need `--no-check-existing-usage` to delete.
- `temp/` = owner's inbox (gitignored); consumed files get deleted.
- Repo-local git email is the GitHub noreply address. Editing ROADMAP.md = declared deviation (no auto-merge).
- Owner PRs auto-merge after checks — open as draft or label `no-automerge` to review first. Squash only.
