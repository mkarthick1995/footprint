# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r1.2-detector-tracker

## Now
- Q1–Q10 done. Q10: "Ask a question" → Gemini Live (voice + blurred frame) → filtered spoken answer, ~3 s.
- PR #30 (teammate, blurred on-screen view) reviewed + fixed (500 ms refresh) — waiting for owner approval.

## Next
1. 10-14 triage of Q11 route / Q12 privacy / Q13 abuse+headers / Q14 presets before the 10-16 freeze. Recommendation:
   Q13 + Q12 (small, judge-visible security/privacy), Q14 lite, cut or simplify Q11.
2. Outdoor phone test (open): detector, scan, map, fail-loud checks, and now asking questions outdoors.
3. Demo assets (R4.x): two real walks for the map, video script, deck.

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
