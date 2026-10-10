# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: r0.6-owner-automerge

## Now
- Phase 0 governance done: protected main, owner-PR auto-merge live (token in `automerge` env, expires 2026-11-09).
- Draft PR #5: safety case (SAFETY.md, ADR-011..014) + ADR-015 PWA-now/native-later, ADR-016 dev/test strategy,
  ADR-017 billing (Proposed), ADR-018 Gemini-from-day-one, research/FACTS.md, "document after every chat" rule.

- All ADRs accepted through ADR-029 (R0.5 findings: Gemini Developer API paid tier, ephemeral tokens, text via transcription).

## Next
1. R0.3 (owner, now): follow docs/SETUP_GCP.md; share project ID; teammates get Editor + own AI Studio keys.
2. Merge the R0.5/roadmap PR (deviation → manual merge) and the scaffold PR (auto-merges).
3. R0.4: teammates clone + `npm run setup -- --handle <x>` + `npm install`; fill handles/owners in TEAM.md.
4. Record 3–5 street clips into data/clips/ (local only); start blind-user outreach (ETH-02); ask Discord (deadline time, credits).
5. 10-11: thin slice per ADR-028.

## Blockers
- (none)

## Gotchas / learned
- Repo-local git email is the GitHub noreply address.
- `gh` CLI not installed; repo settings/protection changed via REST API with the Git Credential Manager token.
- Owner PRs auto-merge after checks — open as draft or label `no-automerge` when you want to review first.
- Merge commits are disabled — squash only.
- Editing docs/ROADMAP.md is always a deviation: tick "This PR deviates" + Why + ADR; such PRs skip auto-merge (merge manually).
- pr-guard only counts DEVIATION(...) comments inside apps/ services/ packages/ infra/.
