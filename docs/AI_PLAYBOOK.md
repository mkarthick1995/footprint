# AI playbook — sessions, tokens, and resuming

## Why this exists
Three people, multiple AI tools, 8 days. Long sessions burn tokens and drift off-scope. The fix is **short sessions
anchored on files**, not long memories.

## Session lifecycle
```
/resume → branch r<id>-name → build + test → /done <R-id> → /open-pr → /handoff → /clear (or new session)
                                                         owner: /review-pr <n> → approve + squash-merge on GitHub
```
- `/resume`: reads STATUS + your handoff, names the next item, flags deadline risk.
- `/done R1.2`: marks the item, updates ARCHITECTURE/DECISIONS if affected.
- `/handoff`: overwrites `docs/handoffs/<handle>.md` (≤ 25 lines).
- `/scope-check <idea>`: deviation + score-impact analysis before you start something new.

## Token-saving rules (in order of impact)
1. **Clear between tasks.** A fresh session + STATUS + handoff ≈ a few thousand tokens. A 3-hour session carries 100k+.
2. **Compact with a focus** when you must continue: `/compact keep: current R-item, decisions made, failing tests`.
   Gemini CLI: `/compress`.
3. **Targeted reads.** Grep for symbols, read line ranges, never open lockfiles / `dist/` / `node_modules/` / media.
4. **Right-size the model.** Docs, renames, boilerplate → faster/cheaper model (e.g. Sonnet/Haiku, Gemini Flash).
   Architecture, tricky debugging → strongest model.
5. **Don't paste logs whole.** Paste the error + 20 relevant lines.
6. **Subagents sparingly** — only for wide searches whose output you don't need verbatim.

## Context dumps (optional, personal)
If you want to keep a raw session record, save it in `.ai-local/` (gitignored), e.g.
`.ai-local/2026-10-12-r1.2-notes.md`. **Never** treat it as team truth — distil facts into STATUS / ARCHITECTURE /
DECISIONS / your handoff. Claude: `/export` can save a transcript; Gemini: `/chat save <tag>`.

## Memory plugins & vector DBs
- claude-mem or similar: allowed for personal use, **not** a substitute for repo docs (Gemini users can't see it).
- Local vector DB: **not used** (ADR-005). Revisit only if docs exceed ~50 files.

## Deviation handling
The guard is layered: AGENTS.md rule → Claude prompt reminder hook → `commit-msg` hook (needs an R-id or
`[off-roadmap]`) → PR template → CI. An `[off-roadmap]` commit must have a matching ADR.

## Prompts that work well
- "Resume. What's the highest-scoring next item for me given the deadline?"
- "Before coding R2.2, list the 3 riskiest assumptions and how to verify each in < 15 min."
- "Challenge this plan against the judging rubric. What would a judge criticise?"
