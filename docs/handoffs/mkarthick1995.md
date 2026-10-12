# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r1.2-detector-tracker

## Now
- Q1–Q10, Q12–Q14 done; Q11 held to 10-14 (owner) as Q11 lite (voice destination → Routes API → hazards along the
  route → spoken summary; no turn-by-turn).
- Owner to test earbud presses (1 ask / 2 describe / 3 repeat), presets and voice commands on the phone on 10-14.

## Next
1. 10-14: Q11 lite; owner phone test with earbuds; two real walks on one street (map data for the demo).
2. 10-15/16: field test (R4.1) + full ST matrix (R4.7); demo video script; deck; judges' README; teammates on Phase 4.
3. 10-17: final deploy with min instances 1, link checks, submit. Re-run scan model benchmark before judging.

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
