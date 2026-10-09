# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r0.6-owner-automerge

## Now
- Owner-PR auto-merge (ADR-010) built: workflow `automerge-owner.yml`, `automerge` environment, `no-automerge` label.
- PR from `r0.6-owner-automerge` awaiting manual merge (workflow only activates once it is on main).

## Next
1. Merge this PR manually (admin bypass, squash), then `git switch main && git pull`.
2. Create fine-grained PAT + add `AUTO_MERGE_TOKEN` to the `automerge` environment (steps in docs/TEAM.md).
3. Test: next owner PR should auto-merge after checks; then mark the R0.6 auto-merge line [x].
4. R0.3: GCP project + billing/credits, Gemini + Maps keys, region asia-southeast1.
5. R0.4: confirm stack (ADR-003) + teammates' handles in TEAM.md.

## Blockers
- (none)

## Gotchas / learned
- Repo-local git email is the GitHub noreply address.
- `gh` CLI not installed; repo settings/protection changed via REST API with the Git Credential Manager token.
- Owner PRs auto-merge after checks — open as draft or label `no-automerge` when you want to review first.
- Merge commits are disabled — squash only.
