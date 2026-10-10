# CLAUDE.md

@AGENTS.md

## Claude Code specifics
- Hooks (`.claude/settings.json`, committed — apply to everyone using Claude Code):
  - **SessionStart** → prints a compact status brief (deadline countdown, open items, your handoff "Next").
  - **UserPromptSubmit** → one-line scope reminder (map request to an R-item, else flag DEVIATION).
  - **PreToolUse** → blocks secrets in tracked files, reading `.env`, git bypasses (`--no-verify`, `add -f`, force push),
    pushing to `main`, `gh pr merge` / approve, and `ALLOW_*` owner overrides.
  - **Stop** → blocks finishing while code changed but `docs/STATUS.md` didn't.
- Commands: `/next` (claim the next queue step), `/resume`, `/handoff`, `/scope-check`, `/done <R-id>`, `/open-pr`,
  `/review-pr <n>` and `/verify <n>` (code owner).
- `/clear` between roadmap items; `/compact <focus>` instead of plain `/compact`.
- Personal memory plugins (e.g. claude-mem) are optional and personal. **Repo docs remain the source of truth** —
  teammates on Gemini cannot see your memory.
- Personal overrides → `CLAUDE.local.md` (gitignored).
