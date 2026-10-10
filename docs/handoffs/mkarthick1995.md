# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r1.2-detector-tracker

## Now
- Q1, Q2, Q3 done. Q3 (#22): AlertManager + AlertOutput; speech primed in the Start tap; silent-voice warning;
  "Possible <type>" wording. Owner phone: 14–30 fps, voice on first tap OK (indoors).
- After #22 merges: production deploy (live site gets detector + spoken alerts).

## Next
1. Owner, 10-12: outdoor street listen test (types vary? "Stop!" rate OK? tones audible over traffic?).
2. Next unclaimed: Q4 face blur → Q6 Gemini scene scan (first Gemini feature, biggest score lever).
3. Teammates: GitHub handles (R0.4) + pull queue steps. Blind-user outreach (ETH-02).

## Blockers
- None for building. Outdoor test is validation, not a blocker.

## Gotchas / learned
- Web uses shared via a Vite alias to src; tsc still reads shared dist types (root build builds shared first).
- Ray-Ban clips: 1584×2112 portrait, ~71° horizontal FOV (computed) → pass hfov 71 in the evaluator.
- Vertex AI uses the GCP trial (ADR-030); Live native-audio needs AUDIO + transcription, us-central1 only.
- gcloud from Git Bash breaks on args with spaces — use PowerShell.
- `temp/` = owner's inbox (gitignored); consumed files get moved/deleted.
- Owner PRs auto-merge after checks — open as draft or label `no-automerge`. Squash only.
