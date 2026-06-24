# Update Docs Loop

Runs on a cron schedule. Checks whether source files have changed since the last doc update and, if so, regenerates all three Mermaid diagrams and the architecture doc.

## Setup required

Before using this file, copy it to `.claude/update-docs-loop.md` and replace `<PROJECT_ROOT>` with the absolute path to your local clone of this repo. See `scripts/loops/README.md` for full setup instructions.

## Instructions (execute every iteration)

1. **Check the flag** — look for a file called `.docs-pending` at `<PROJECT_ROOT>/.docs-pending`.
   - If the file does NOT exist: print "No pending doc update — skipping." and stop. Do NOT schedule another iteration.
   - If the file exists: continue to step 2.

2. **Read the source files** — read ALL of the following (paths relative to `<PROJECT_ROOT>`):
   - `frontend/lib/types.ts`
   - `frontend/lib/concerns.ts`
   - `frontend/lib/prompts.ts`
   - `frontend/lib/scoring.ts`
   - `database/schema.sql`
   - `frontend/app/api/chat/route.ts`
   - `frontend/app/api/leads/route.ts`
   - `frontend/app/api/documents/route.ts`
   - `frontend/app/api/analysis/route.ts`
   - `frontend/app/chat/page.tsx` (first 80 lines)
   - Current `diagrams/architecture.mmd`
   - Current `diagrams/erd.mmd`
   - Current `diagrams/lead-flow.mmd`

3. **Rewrite the three diagrams** based on what you read. Rules:
   - `diagrams/erd.mmd` — erDiagram. Include ALL columns in the `leads` table (from types.ts + schema.sql). Show all FK relationships including the self-join for follow-up sessions (`parent_lead_id`).
   - `diagrams/architecture.mmd` — flowchart TD. Show: browser pages, Next.js API routes, AI layer (Groq default, Claude fallback, regex engine), data layer (Supabase PostgreSQL + Realtime + Storage, Upstash Redis), Resend email (dual accounts: broker + customer). Include the `syncProfileToSiblings` flow.
   - `diagrams/lead-flow.mmd` — sequenceDiagram. Show: session start, CHOICES/NUMBER_INPUT widget interactions, regex extraction, LEAD_DATA parsing, Realtime push to broker dashboard, document upload, analysis generation, follow-up session creation, email notification triggers (broker + customer).

4. **Update `docs/architecture.md`** — keep the same section structure but update component list, routes, AI strategy section, and "What's Built" checklist to reflect current code.

5. **Commit the changes** using git at `<PROJECT_ROOT>`:
   ```
   git add diagrams/ docs/architecture.md
   git commit -m "docs: auto-update diagrams and architecture [skip ci]"
   git push
   ```
   Only commit if files actually changed. Check `git diff --staged --quiet` first — exit 0 means nothing staged, skip the commit.

6. **Delete the flag** — remove `<PROJECT_ROOT>/.docs-pending`.

7. Print a one-line summary: how many files were updated, whether the commit was made.

## Trigger

This loop is triggered by the post-commit git hook (`scripts/post-commit`) which writes `.docs-pending` whenever a commit touches source files. Install it with:
```bash
cp scripts/post-commit .git/hooks/post-commit
chmod +x .git/hooks/post-commit   # macOS/Linux only
```
