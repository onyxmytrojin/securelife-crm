# Test Guard Loop

Run this loop with `/loop` before committing or after significant code changes to verify all tests pass.

## Setup required

Copy this file to `.claude/test-guard-loop.md` before use. No path substitution needed — it uses relative commands only. See `scripts/loops/README.md` for full setup instructions.

## Instructions (execute every iteration)

1. Run the test suite:
   ```
   cd frontend && npm test
   ```

2. Parse the output. Look for the summary line — Vitest prints one of:
   - `Tests  N passed (N)` — all green
   - `Tests  N failed | M passed (N+M)` — failures present

3. If **all tests pass**:
   - Print a short confirmation: how many tests passed, how long it took
   - Check `git status` for uncommitted changes
   - If there are staged changes, note "Ready to commit — all tests green"
   - Stop the loop (do not schedule another iteration)

4. If **any test fails**:
   - Print which test file(s) failed and the exact assertion that broke
   - Do NOT attempt to fix the code automatically — just report clearly
   - Stop the loop and wait for the user to address the failures

## When to run manually

- Before every `git commit` (the pre-commit hook also enforces this automatically)
- After editing anything in `frontend/lib/`
- After merging in changes from a teammate

## Cron schedule

A durable cron job runs this automatically every 30 minutes while Claude Code is active.
To list or cancel it: use CronList / CronDelete tools, or ask Claude.
