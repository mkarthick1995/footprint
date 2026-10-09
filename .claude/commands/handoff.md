---
description: Update STATUS + overwrite my handoff file so any AI can resume from it
---
Prepare a handoff for the end of this session.
1. Make sure `docs/STATUS.md` reflects everything changed this session (my lines only: state, @handle, date).
2. If architecture, interfaces, env vars, or decisions changed, update ARCHITECTURE.md / DECISIONS.md / .env.example.
   Also document **this conversation** (AGENTS.md §5 "Discussions count too"): decisions and rejected options → ADRs,
   new risks/limitations → SAFETY.md, verified facts → docs/research/FACTS.md, open questions → STATUS.md.
3. **Overwrite** `docs/handoffs/<handle>.md` (handle: `git config aicup.handle`) using `docs/handoffs/TEMPLATE.md`,
   ≤ 25 lines: Now / Next (concrete steps) / Blockers / Gotchas. No transcript, only facts a fresh session needs.
4. Show me a 3-line summary and suggest a commit message with the roadmap ID. Then tell me to `/clear`.
