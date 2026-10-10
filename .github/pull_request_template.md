## Roadmap item(s)
R?.? <!-- required: e.g. R1.2 — or [docs] / [chore] / [off-roadmap] -->

## What & why
<!-- 2–4 lines. Which judging criterion does this improve? Tech 40 / Impact 25 / Innovation 25 / UX 10 -->

## Definition of Done (required for non-draft code PRs — CI checks this)
- [ ] This PR fully completes queue step(s): Q? — every DoD item met, tests added, STATUS line set to [x]
<!-- Not finished? Keep the PR as a draft, or release the step with the remaining items listed here. -->

## Roadmap deviation (required — CI checks this)
- [ ] This PR deviates from docs/ROADMAP.md
<!-- Tick it if ANY of: work outside the item's scope, new feature/dependency not in the roadmap,
     ROADMAP.md / Accepted ADR changed, [off-roadmap] commits, DEVIATION(...) code comments. -->
Why: <!-- if ticked: the reason, in one or two sentences -->
Score impact: <!-- criterion ± and time cost -->
ADR: <!-- ADR-0xx added in docs/DECISIONS.md -->
Code locations: <!-- each deviating spot carries a `DEVIATION(ADR-0xx): reason` comment -->

## Safety review (required for code changes — CI checks this; see docs/SAFETY.md §7)
Risk IDs: <!-- e.g. SAF-03, PRI-01 — or "none: <one-line reason>" -->
Negative scenarios considered: <!-- wrong / late / silent / offline / bad input / unknown case → what happens? -->
New limitations disclosed in SAFETY.md §4: <!-- yes / none -->

## Checklist
- [ ] Branch is `r<id>-name` (or docs-/chore-/hotfix-), based on latest `main`
- [ ] `docs/STATUS.md` updated (my lines only); handoff updated
- [ ] ARCHITECTURE / DECISIONS / README / `.env.example` updated if affected
- [ ] No secrets, personal data, recordings, or faces in the diff
- [ ] Self-review done with `/open-pr`; tested on a real phone (or explain why not yet)

## Screenshots / demo clip (optional)
