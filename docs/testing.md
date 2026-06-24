# Testing — SecureLife Insurance AI CRM

## Overview

Unit tests live in `frontend/__tests__/` and run with **Vitest**. They cover the pure business-logic functions in `frontend/lib/` that have no network or database dependencies.

---

## Test Files

| File | Covers | Tests |
|------|--------|-------|
| `__tests__/lead-utils.test.ts` | `lib/lead-utils.ts` — concern deduplication, merging, formatting | 11 |
| `__tests__/scoring.test.ts` | `lib/scoring.ts` — score totals, grade thresholds, each factor | 28 |
| `__tests__/urgency.test.ts` | `lib/urgency.ts` — SLA breach levels, P0–P3 classification, non-SLA stages | 17 |

**Total: 51 tests across 3 files.**

---

## Running Tests

From the `frontend/` directory:

```sh
# Run once and exit
npm test

# Watch mode — re-runs on file save
npm run test:watch

# Browser UI
npm run test:ui
```

---

## Pre-commit Hook

A git pre-commit hook runs the full test suite automatically before every `git commit`. If any test fails, the commit is aborted with a clear error message.

**The hook is stored in `.githooks/pre-commit`** and committed to the repository so the whole team gets it.

### One-time setup (required after cloning)

```sh
git config core.hooksPath .githooks
```

This tells git to use `.githooks/` instead of the default `.git/hooks/`. Run it once per clone — you will not need to run it again.

To verify it's active:
```sh
git config core.hooksPath
# should print: .githooks
```

### Bypassing the hook (use sparingly)

```sh
git commit --no-verify -m "your message"
```

Only use this for WIP commits on a personal branch where tests are intentionally broken.

---

## Claude Code Loop

**`.githooks/test-guard-loop.md`** contains loop instructions for Claude Code. Invoke it with `/loop` to have Claude run the tests and report results interactively — useful before a PR or after a big refactor.

What the loop does each iteration:
1. Runs `npm test` in `frontend/`
2. If all tests pass — reports the count, checks git status, prints "Ready to commit"
3. If any test fails — shows which file and assertion failed, stops and waits for you to fix it

### Cron job

A Claude Code cron job (job ID `6b66ddb7`) fires the test check every hour at :23 while Claude Code is active. It auto-expires after 7 days. To cancel it early, ask Claude to delete cron job `6b66ddb7`.

---

## What Is and Isn't Tested

### Tested (unit tests)

- `lib/lead-utils.ts` — pure functions, no I/O
- `lib/scoring.ts` — pure scoring logic
- `lib/urgency.ts` — SLA threshold calculations

### Not tested (and why)

| Area | Reason |
|------|--------|
| API routes (`app/api/`) | Require live Supabase + AI provider — integration tests, not unit tests |
| React components | No JSDOM set up; UI correctness verified manually in the browser |
| Auth flows | Require Supabase Auth — tested against the live dev environment |
| PDF extraction | Requires real PDF bytes and a live AI call |

---

## Adding New Tests

1. Create a file in `frontend/__tests__/` named `<module>.test.ts`
2. Import from `@/lib/<module>` (path alias is configured in `vitest.config.ts`)
3. Use `describe` / `it` / `expect` from `vitest` — no extra imports needed
4. Run `npm test` to confirm they pass before committing

Vitest config is at `frontend/vitest.config.ts`.
