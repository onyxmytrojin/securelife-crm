# SecureLife Insurance AI CRM

AI-powered lead capture, document extraction, and broker analysis dashboard — built for the BraindAI Senior AI Engineer Assessment.

## Demo
> Loom walkthrough link — added after recording

## What it does
1. **Chatbot** — AI (Claude) qualifies leads through natural conversation, captures structured profile data
2. **PDF Extraction** — Uploads insurance PDFs → Claude extracts policy details, coverage, exclusions, premiums
3. **Gap Analysis** — Claude generates coverage gap analysis, savings opportunities, risk flags, and broker recommendations
4. **Pipeline Dashboard** — Kanban-style board showing all leads by status; full detail view per lead

## Setup (< 5 minutes)

### Prerequisites
- Node.js 18+
- A Supabase project (free tier)
- Anthropic API key

### 1. Clone and install
```bash
cd frontend
npm install
```

### 2. Configure environment
Copy `.env.local` and fill in your keys:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=       # optional, used as fallback
```

### 3. Set up database
In your Supabase project → SQL Editor → paste and run `database/schema.sql`.

### 4. Run
```bash
cd frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

## Project Structure
```
frontend/          Next.js 16 app (UI + API routes)
database/          schema.sql + seed data
docs/              Architecture, data model, AI strategy, edge cases
diagrams/          Mermaid source files (architecture, ERD, sequence)
samples/           Sample insurance PDFs for testing
CLAUDE.md          Claude Code context file
tasks.md           Build plan and progress tracker
```

## Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React, TypeScript, Tailwind |
| UI Components | shadcn/ui |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage |
| Primary AI | Claude claude-sonnet-4-6 |
| Fallback AI | GPT-4.1-mini |
| PDF Parsing | pdf-parse |
| Validation | Zod |

## Architecture
See `docs/architecture.md` for full system design, trade-off analysis, AI integration strategy, and edge case handling.

Diagrams: `diagrams/architecture.mmd`, `diagrams/erd.mmd`, `diagrams/lead-flow.mmd`
