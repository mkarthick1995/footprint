# Handoff — @mkarthick1995
Updated: 2026-10-14 · Tool: Claude Code · Branch: main (released)

## Now
- Live: redesign (ADR-040), fewer repeats (ADR-039), natural voice Aoede (ADR-041), languages en/hi/ta/te/ja (ADR-042).
- Rollback: branch `backup/main-2026-10-14` (= previous live main fe63adc) → `git checkout` it and `npm run deploy`.
- Translations unreviewed: teammates review docs/i18n-review.md (hi/ta/te); Japanese has no reviewer → hide before submission if none.

## Next
1. 10-14: owner phone test (earbuds 1/2/3, presets, voice commands, "route to …"); two real walks on one street (map data for the demo), then check a route summary along that street lists them.
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
- Routes API runs server-side with the service account (needs serviceUsageConsumer + `x-goog-user-project`).
- Owner PRs auto-merge after checks — open as draft or label `no-automerge`. Squash only.
