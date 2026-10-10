# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r1.2-detector-tracker

## Now
- Q2 (draft PR #21): detector, tracker, exact 1/h TTC, distance, in-path, overlay, dev `/clip-eval.html`.
- Clip regression set in `data/clips/` (gitignored): Ray-Ban cycling + CC-BY Shanghai crowd + Singapore night lane
  (`public/SOURCES.md` has licences). Crowd clips exposed false P0s → ADR-024 refinement 2; P0 frames 3.6→1.3 % and
  16.6→3.9 %, spot-checked P0s real (ST-31 ✅). 28 shared tests.
- Preview: https://q02---footprint-bubu3vkhwa-as.a.run.app (0 % live traffic).

## Next
1. Owner: phone fps on q02 (need ≥ 10, note GPU/CPU) → then Q2 [x] → ready → verify → merge → deploy.
2. Q3 alert manager (next unclaimed): must merge crowds ("people close ahead"), earcons for repeats (SAF-31).
3. R1.6 later: self-occlusion check (own umbrella/hat → "camera partly blocked", SAF-30).
4. Teammates: GitHub handles (R0.4). Blind-user outreach (ETH-02). Discord (deadline, credits).

## Blockers
- Q2 completion needs the phone fps reading only.

## Gotchas / learned
- Web uses shared via a Vite alias to src; tsc still reads shared dist types (root build builds shared first).
- Ray-Ban clips: 1584×2112 portrait, ~71° horizontal FOV (computed) → pass hfov 71 in the evaluator.
- Vertex AI uses the GCP trial (ADR-030); Live native-audio needs AUDIO + transcription, us-central1 only.
- gcloud from Git Bash breaks on args with spaces — use PowerShell.
- `temp/` = owner's inbox (gitignored); consumed files get moved/deleted.
- Owner PRs auto-merge after checks — open as draft or label `no-automerge`. Squash only.
