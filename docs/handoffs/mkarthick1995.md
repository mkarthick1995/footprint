# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r1.2-detector-tracker

## Now
- Q1–Q6 done (Q4/Q5 by @chill-guy-1234, reviewed + fixed). Q6: Gemini scene scan live on preview q06 →
  production after merge. Model gemini-3.6-flash, thinking off (ADR-034).
- Outdoor phone test still open (STATUS open questions) — now also listen for scan alerts ("Pothole, ahead").

## Next
1. Next unclaimed: Q7 community hazards (backend + client posts scan observations) — pairs with Q6.
2. FOLLOWUPS #1 (detector loop on camera frames, not display refresh) before the field test.
3. Re-run the scan model benchmark before judging (model IDs change; REL-07). Cloud Run IP log exclusion → Q12.

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
