# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r0.3-vertex-gcp-setup

## Now
- Q1 (R1.1 frame source) claimed — draft PR #19, stacked on #18. Code done: camera/clip, wake lock, error + pause/resume
  announcements, grabFrame, favicon; unit tests 8/8; desktop browser checks passed (error path + synthetic clip 640×360).
- Preview deployed: https://q01---footprint-bubu3vkhwa-as.a.run.app (0 % live traffic).

## Next
1. Owner: merge #18 (build queue). Then phone test of Q1 on the preview link (Android Chrome checklist in PR #19).
2. If the phone test passes: set Q1 [x], mark #19 ready → /verify → merge → `npm run deploy`.
3. Teammates: run `/next` when free (Q2 is the next unclaimed step). Send GitHub handles → TEAM.md (R0.4).
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
