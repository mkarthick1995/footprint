# Handoff — @mkarthick1995
Updated: 2026-10-10 · Tool: Claude Code · Branch: main (bootstrap)

## Now
- R0.2 scaffold committed locally on main (bootstrap). GitHub repo `footprint` not created yet: GitHub MCP token invalid.

## Next
1. Fix the GitHub MCP token (repo scope), then create public repo `mkarthick1995/footprint` and push main.
2. R0.6: enable branch protection (infra/github/protect-main.mjs needs `gh`, or manual steps in docs/TEAM.md).
3. R0.1: make sure the 3rd member accepts the Hack2skill team invite before 10-11 closes.
4. R0.3: GCP project + billing + Gemini/Maps keys; share keys privately with teammates.
5. R0.4: confirm stack (ADR-003) + replace @member-b / @member-c in TEAM.md once handles are known.

## Blockers
- GitHub MCP "Bad credentials".

## Gotchas / learned
- Repo-local git email is the GitHub noreply address (keeps personal Gmail out of public history).
- Bootstrap commit/push used ALLOW_MAIN_* overrides once, at the owner's request; never again after protection.
