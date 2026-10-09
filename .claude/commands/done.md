---
description: Mark a roadmap item done and sync all affected docs
argument-hint: <R-id e.g. R1.2>
---
Mark $ARGUMENTS as done.
1. Verify it meets the exit criteria in `docs/ROADMAP.md`. If not, say what's missing and stop.
2. Set its line in `docs/STATUS.md` to `[x]` with @handle and today's date; update "Current phase" if the phase finished.
3. Update ARCHITECTURE.md / DECISIONS.md / README.md / .env.example if affected.
4. Suggest a commit message: `type(scope): summary [$ARGUMENTS]`.
