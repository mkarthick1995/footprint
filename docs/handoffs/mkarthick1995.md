# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r0.3-vertex-gcp-setup

## Now
- Q1 done + live. Q2 claimed (draft PR #21): MediaPipe detector, IoU tracker, exact 1/h looming TTC, distance, in-path,
  edge-cut, overlay; 24 shared tests; desktop 62 fps; real street photo approach escalated person P2→P1→P0.
- Preview: https://q02---footprint-bubu3vkhwa-as.a.run.app (0 % live traffic).

## Next
1. Owner: phone fps check on q02 (Start → read "fps" in the grey line; need ≥ 10) + record street clips into data/clips/.
2. Tune thresholds on real clips; then Q2 [x] → ready → verify → merge → deploy.
3. Q3 (alert manager) is next unclaimed — speaks Q2's candidates.
4. Teammates: setup + GitHub handles (R0.4). Blind-user outreach (ETH-02). Discord (deadline, credits).

## Blockers
- Q2 completion needs the owner's phone fps reading and real walking clips.

## Gotchas / learned
- First source deploy needed `roles/run.builder` on the default compute SA. POST without a body → 411 from Cloud Run front end.
- Gemini Developer API returns 402 without AI Studio prepaid credit; Vertex AI uses the GCP trial (ADR-030).
- Vertex Live: native-audio model needs AUDIO + output transcription (TEXT rejected); only us-central1.
- gcloud on Windows: `%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`; from Git Bash, args with
  spaces break — use PowerShell. API keys used in the last 7 days need `--no-check-existing-usage` to delete.
- `temp/` = owner's inbox (gitignored); consumed files get deleted.
- Repo-local git email is the GitHub noreply address. Editing ROADMAP.md = declared deviation (no auto-merge).
- Owner PRs auto-merge after checks — open as draft or label `no-automerge` to review first. Squash only.
