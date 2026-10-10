# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r1.2-detector-tracker

## Now
- Q2 (draft #21): detector/tracker/TTC done; only the phone fps reading is missing.
- Q3 (draft #22, stacked on #21): `AlertManager` (shared, 17 tests) + `AlertOutput` (earcon → speech, vibrate,
  aria-live, TTS watchdog) wired to Q2. Clip sim: 13 / 9 spoken per min in crowds, 0.3 on the empty ride.
- Preview q03 = Q2 + Q3 (talks). Clip regression set + licences in `data/clips/` (gitignored).

## Next
1. Owner on phone, preview q03: fps (≥ 10, GPU/CPU) + listen 1–2 min on a street → Q2 and Q3 [x].
2. Mark #21 ready (auto-merge) → retarget/rebase #22 onto main → ready → merge → `npm run deploy`.
3. Next unclaimed: Q4 face blur → Q6 Gemini scan (first Gemini feature, biggest score lever).
4. Teammates: GitHub handles (R0.4) + start pulling queue steps. Blind-user outreach (ETH-02).

## Blockers
- Phone test by the owner (fps + listen).

## Gotchas / learned
- Web uses shared via a Vite alias to src; tsc still reads shared dist types (root build builds shared first).
- Ray-Ban clips: 1584×2112 portrait, ~71° horizontal FOV (computed) → pass hfov 71 in the evaluator.
- Vertex AI uses the GCP trial (ADR-030); Live native-audio needs AUDIO + transcription, us-central1 only.
- gcloud from Git Bash breaks on args with spaces — use PowerShell.
- `temp/` = owner's inbox (gitignored); consumed files get moved/deleted.
- Owner PRs auto-merge after checks — open as draft or label `no-automerge`. Squash only.
