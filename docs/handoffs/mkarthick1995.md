# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r1.2-detector-tracker

## Now
- Q1–Q7 done. Q7: community hazard map (Firestore, evidence model, privacy trim, "reported" alerts). Production
  deploy after merge.
- Outdoor phone test (open check) now covers detector + Gemini scan + community map; GPS permission prompt appears
  on first camera walk. The map only has data after real walks (≥ 2 walks to confirm).

## Next
1. Next unclaimed: Q8 hazard map page (Maps JS, referrer-locked key) — shows confirmed hazards; strong demo visual.
2. Seed demo data honestly for the video: two real walks on one street (no fake reports — ETH/SEC-03).
3. FOLLOWUPS #1 (detector on camera frames); scan model benchmark before judging; Cloud Run IP log exclusion (Q12).

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
