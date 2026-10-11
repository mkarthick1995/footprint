# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r1.2-detector-tracker

## Now
- Q1–Q8 done. Q8: public `/map` page (Google Map + accessible list) of confirmed community hazards.
- Map is empty until real walks confirm hazards (≥ 2 walks). Record two real walks on one street before the video.

## Next
1. Next unclaimed: Q9 fail-loud layer (watchdogs, degradation ladder, camera-quality checks) — safety core.
2. Outdoor phone test (open check): detector + Gemini scan + map, then look at /map on a laptop.
3. FOLLOWUPS #1; scan model benchmark before judging; Cloud Run IP log exclusion (Q12).

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
