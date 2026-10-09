# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r0.6-owner-automerge

## Now
- Phase 0 governance done: protected main, owner-PR auto-merge live (token in `automerge` env, expires 2026-11-09).

## Next
1. R0.3: GCP project + billing/credits, Gemini + Maps keys, region asia-southeast1; share keys privately.
2. R0.4: confirm stack (ADR-003) + teammates' handles in TEAM.md.
3. R0.5: verify Live API ephemeral tokens + current Live model ID.
4. Phase 1 starts 10-11: R1.5 deploy skeleton early.

## Blockers
- (none)

## Gotchas / learned
- Repo-local git email is the GitHub noreply address.
- `gh` CLI not installed; repo settings/protection changed via REST API with the Git Credential Manager token.
- Owner PRs auto-merge after checks — open as draft or label `no-automerge` when you want to review first.
- Merge commits are disabled — squash only.
