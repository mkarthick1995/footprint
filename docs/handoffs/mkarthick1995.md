# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r0.6-owner-automerge

## Now
- Phase 0 governance done: protected main, owner-PR auto-merge live (token in `automerge` env, expires 2026-11-09).
- Draft PR #5: safety case (SAFETY.md, ADR-011..014) + ADR-015 PWA-now/native-later, ADR-016 dev/test strategy,
  ADR-017 billing (Proposed), ADR-018 Gemini-from-day-one, research/FACTS.md, "document after every chat" rule.

## Next
1. Review draft PR #5 → "Ready for review" (auto-merges after checks).
2. Confirm ADR-017 + ADR-014: GCP $300 trial → paid Gemini tier vs Vertex AI; check ephemeral-token support.
3. R0.3: GCP project + billing + budget alerts, Gemini + Maps keys, IAM for teammates; ask Discord about credits.
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
- Editing docs/ROADMAP.md is always a deviation: tick "This PR deviates" + Why + ADR; such PRs skip auto-merge (merge manually).
- pr-guard only counts DEVIATION(...) comments inside apps/ services/ packages/ infra/.
