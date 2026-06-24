# Claude Code Loops — Local Automation

This folder contains **loop instruction files** for [Claude Code](https://claude.ai/code). They drive two local background automation jobs that keep the repo healthy without any CI/CD dependency.

## What are Claude Code loops?

A loop is a markdown file read by Claude Code's `/loop` command. Claude executes the instructions, then decides whether to schedule another iteration via `CronCreate`. Loops run locally on your machine — no GitHub Actions, no external services, no secrets leave your environment.

## Loops in this project

| File | What it does | Default cadence |
|------|-------------|-----------------|
| `update-docs-loop.md` | Regenerates Mermaid diagrams and `docs/architecture.md` when source files change | Every 30 min (only acts when `.docs-pending` flag exists) |
| `test-guard-loop.md` | Runs the full Vitest suite and reports failures | On-demand via `/loop`, also every 30 min |

## How to set up locally

### 1. Copy the loop files into `.claude/`

```bash
cp scripts/loops/update-docs-loop.md .claude/update-docs-loop.md
cp scripts/loops/test-guard-loop.md  .claude/test-guard-loop.md
```

`.claude/` is gitignored — your local copy is where Claude Code reads from.

### 2. Update absolute paths in `update-docs-loop.md`

Open `.claude/update-docs-loop.md` and replace `<PROJECT_ROOT>` with the absolute path to your local clone:

```
# macOS / Linux
/Users/yourname/projects/securelife-crm

# Windows
C:\Users\yourname\projects\securelife-crm
```

### 3. Install the post-commit hook

```bash
cp scripts/post-commit .git/hooks/post-commit
chmod +x .git/hooks/post-commit   # macOS/Linux only
```

The hook writes a `.docs-pending` flag file whenever you commit changes to source files (`frontend/lib/`, `frontend/app/api/`, `frontend/components/`, `database/schema.sql`). The update-docs loop picks it up on its next run.

### 4. Start the loops

In Claude Code:
```
/loop .claude/update-docs-loop.md
/loop .claude/test-guard-loop.md
```

Claude will run each loop once immediately and schedule a recurring cron job for it.

### 5. Manage the cron jobs

```
# List active cron jobs
Ask Claude: "list my cron jobs"

# Cancel a specific job
Ask Claude: "cancel cron job <id>"
```

## How the doc update flow works

```
git commit (touches source file)
        │
        ▼
post-commit hook writes .docs-pending
        │
        ▼  (within 30 min)
update-docs loop fires
        │
        ├── reads all source files
        ├── rewrites diagrams/architecture.mmd
        ├── rewrites diagrams/erd.mmd
        ├── rewrites diagrams/lead-flow.mmd
        └── updates docs/architecture.md
        │
        ▼
git commit "docs: auto-update [skip ci]" + push
        │
        ▼
.docs-pending deleted
```

## Notes

- The loops use **Claude itself** as the AI — no separate `ANTHROPIC_API_KEY` env var needed for the loop runner
- `.docs-pending` is gitignored — it only exists transiently between a commit and the next loop run
- GitHub Actions (`update-docs.yml`) does the same doc update job in CI — the local loop is a fallback for when the Actions secret isn't configured
- The pre-commit hook (`scripts/pre-commit`) enforces tests before every commit independently of the test-guard loop
