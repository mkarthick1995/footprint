# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r1.2-detector-tracker

## Now
- Q1–Q9 done. Q9: fail-loud ladder L0–L3 + quality gate + orientation + battery/heat + GPS-lost warnings.
- Outdoor phone test (open check) should now also try: cover the lens, point at the ground, airplane mode.

## Next
1. Next unclaimed: Q10 Gemini Live Q&A proxy (voice question → filtered answer) — the big Gemini/UX demo moment.
2. FOLLOWUPS #1 (detector on camera frames); scan model benchmark before judging; Cloud Run IP log exclusion (Q12).
3. Feature freeze 10-16: Q10 must land first; Q11–Q14 get triaged (cut list) on 10-14.

## Blockers
- None.

## Gotchas / learned
- Web uses shared via a Vite alias to src; tsc still reads shared dist types (root build builds shared first).
- Scan benchmark: services/api `vertexAnalyzer` env `GEMINI_SCAN_MODEL/THINKING/MEDIA_RES`; 3.x flash = global only.
- Ray-Ban clips: 1584×2112 portrait, ~71° horizontal FOV (computed) → pass hfov 71 in the evaluator.
- Vertex AI uses the GCP trial (ADR-030); Live native-audio needs AUDIO + transcription, us-central1 only.
- gcloud from Git Bash breaks on args with spaces — use PowerShell.
- `temp/` = owner's inbox (gitignored); consumed files get moved/deleted.
- Owner PRs auto-merge after checks — open as draft or label `no-automerge`. Squash only.
