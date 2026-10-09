# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: chore-r0-setup-status

## Now
- R0.1, R0.2, R0.6 done. Repo public at github.com/mkarthick1995/footprint; `main` protected.
- PR from `chore-r0-setup-status` (STATUS + handoff update) awaiting owner approval/merge.

## Next
1. Merge the chore PR (owner), then `git switch main && git pull`.
2. R0.3: GCP project + billing/credits, Gemini + Maps keys, region asia-southeast1; share keys privately.
3. R0.4: confirm stack (ADR-003) + replace @member-b / @member-c in TEAM.md and CODEOWNERS with real handles.
4. R0.5: verify Live API ephemeral tokens + current Live model ID.

## Blockers
- (none)

## Gotchas / learned
- Repo-local git email is the GitHub noreply address (keeps personal Gmail out of public history).
- `gh` CLI not installed on this machine; use GitHub MCP or install via `winget install GitHub.cli`.
- Protection rule details (required reviews etc.) not verified by AI — unauthenticated API only shows `protected: true`.
