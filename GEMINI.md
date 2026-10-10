# GEMINI.md

@./AGENTS.md

## Gemini CLI specifics
- No Gemini CLI hooks are wired in this repo. The same rules are enforced at commit time by git hooks
  (`pre-commit`, `commit-msg`) and in CI — so **self-apply AGENTS.md §3–§6 every session**; the commit will fail otherwise.
- Start every session with `/resume`; end with `/handoff`. Other commands: `/scope-check`, `/done <R-id>`,
  `/open-pr`, `/next` (claim the next queue step), `/review-pr <n>` and `/verify <n>` (code owner).
- Never push to `main`, merge, or approve PRs, and never run `ALLOW_*` overrides — git hooks and branch protection
  block these, but you must not attempt them (AGENTS.md §11).
- When context grows: `/compress`. Personal checkpoints: `/chat save <tag>` (local only, not a team artifact).
- Heavy/private paths are excluded via `.geminiignore`. Don't `cat` `.env` or `.private/`.
- Run `npm run status` for the same brief Claude gets at session start.
