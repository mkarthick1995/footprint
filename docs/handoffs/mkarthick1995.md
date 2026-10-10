# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r1.2-detector-tracker

## Now
- Q2 claimed (draft PR #21): MediaPipe detector, IoU tracker, exact 1/h looming TTC, distance, in-path, edge-cut,
  overlay; 24 shared tests; desktop 62 fps; street-photo zoom approach escalated person P2→P1→P0.
- Dev clip evaluator `/clip-eval.html` (npm run dev). Real clip 1 (owner's Ray-Ban, cycling, empty covered track,
  3 min): 0 in-path alerts, 0 P0; 3 P1 frames = real off-path objects. Thresholds unchanged (no true approach in it).
- Clips live in `data/clips/` (gitignored): rayban-cycling-01.mov (original) + -720.mp4 (silent, 720 px).
- Preview: https://q02---footprint-bubu3vkhwa-as.a.run.app (0 % live traffic).

## Next
1. Owner: phone fps on q02 (need ≥ 10, note GPU/CPU) + a WALKING clip with people/bikes coming towards you in path.
2. Run that clip through /clip-eval.html (sample fps 10); check P1 ≥ 3 s before contact; then Q2 [x] → merge → deploy.
3. Q3 (alert manager) is next unclaimed — speaks Q2's candidates.
4. Teammates: GitHub handles (R0.4). Blind-user outreach (ETH-02). Discord (deadline, credits).

## Blockers
- Q2 completion needs the phone fps reading and a walking clip with in-path approaches.

## Gotchas / learned
- Ray-Ban clips: 1584×2112 portrait, ~71° horizontal FOV (computed) → pass hfov 71 in the evaluator.
- Vertex AI uses the GCP trial (ADR-030); Live native-audio needs AUDIO + transcription, us-central1 only.
- gcloud from Git Bash breaks on args with spaces — use PowerShell.
- `temp/` = owner's inbox (gitignored); consumed files get moved/deleted.
- Owner PRs auto-merge after checks — open as draft or label `no-automerge`. Squash only.
