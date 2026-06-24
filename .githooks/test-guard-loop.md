# Test Guard Loop

Invoke with `/loop` in Claude Code before committing or after significant changes to `frontend/lib/`.

## Instructions (execute every iteration)

1. Run the test suite:
   ```
   cd frontend && npm test
   ```

2. Parse the output. Vitest prints one of:
   - `Tests  N passed (N)` — all green
   - `Tests  N failed | M passed (N+M)` — failures present

3. If **all tests pass**:
   - Report how many passed and how long it took
   - Run `git status` and note any uncommitted changes
   - Print "Ready to commit — all tests green" if there are staged changes
   - Stop the loop

4. If **any test fails**:
   - Show which test file(s) failed and the exact failing assertion
   - Do NOT attempt to fix code automatically — report only
   - Stop the loop and wait for the user to fix the failures

## Setup (one-time per clone)

```sh
git config core.hooksPath .githooks
```

This tells git to use the `.githooks/` directory for hooks instead of `.git/hooks/`.
The `pre-commit` hook in this directory will then run automatically on every commit.

## Cron job

A Claude Code cron job (job ID `6b66ddb7`) fires this check every hour at :23
while Claude Code is active. It auto-expires after 7 days.

To cancel early, ask Claude: "delete cron job 6b66ddb7"
