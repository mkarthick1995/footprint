# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r0.6-owner-automerge

## Now
- Phase 0 governance done: protected main, owner-PR auto-merge live (token in `automerge` env, expires 2026-11-09).
- Draft PR #5: safety case (SAFETY.md, ADR-011..014) + ADR-015 PWA-now/native-later, ADR-016 dev/test strategy,
  ADR-017 billing (Proposed), ADR-018 Gemini-from-day-one, research/FACTS.md, "document after every chat" rule.

- All ADRs 001–026 accepted by owner (2026-10-10); ADR-027/028 proposed.

## Next
1. Confirm ADR-027 (no turn-by-turn) + ADR-028 (thin slice first).
2. R0.3 (owner, today): GCP project + $300 trial + billing alerts, Gemini + Maps keys, IAM for teammates.
3. R0.5: verify Live TEXT output, ephemeral tokens per tier, Live model ID, session limits → pick tier.
4. R0.4: teammates clone + `npm run setup -- --handle <x>`; fill handles/owners in TEAM.md.
5. Record 3–5 street clips (local data/ only) for PC development; start blind-user outreach (ETH-02).
6. 10-11: scaffold monorepo (apps/web, services/api, packages/shared) + thin slice.

## Blockers
- (none)

## Gotchas / learned
- Repo-local git email is the GitHub noreply address.
- `gh` CLI not installed; repo settings/protection changed via REST API with the Git Credential Manager token.
- Owner PRs auto-merge after checks — open as draft or label `no-automerge` when you want to review first.
- Merge commits are disabled — squash only.
- Editing docs/ROADMAP.md is always a deviation: tick "This PR deviates" + Why + ADR; such PRs skip auto-merge (merge manually).
- pr-guard only counts DEVIATION(...) comments inside apps/ services/ packages/ infra/.
