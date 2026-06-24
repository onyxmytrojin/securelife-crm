# SecureLife Insurance AI CRM

AI-powered lead capture, document extraction, and broker analysis dashboard — built for the BraindAI Senior AI Engineer Assessment.

## Demo
> Loom walkthrough link — added after recording

## What it does
1. **Chatbot (Aria)** — AI qualifies leads through natural conversation; structured widgets (occupation CHOICES, income brackets, NUMBER_INPUT for age/family size) make data capture fast and accurate
2. **PDF Extraction** — Uploads insurance PDFs → Claude extracts policy details, coverage, exclusions, premiums
3. **Gap Analysis (Arjun Kapoor persona)** — Senior consultant AI generates HLV-anchored coverage gap analysis, savings opportunities, risk flags, and actionable broker recommendations with Indian product vocabulary
4. **Pipeline Dashboard** — Kanban-style board showing all leads by status; full detail view per lead with broker-editable notes
5. **Email Notifications** — Resend emails to broker on qualified / docs received / analysis ready; to customer when docs are requested
6. **Follow-up Sessions** — Customers can start linked follow-up chats on their existing enquiry; profile synced across sessions

## Setup (< 5 minutes)

### Prerequisites
- Node.js 18+
- A Supabase project (free tier)
- A Groq API key — free at [console.groq.com](https://console.groq.com) (takes 2 min)

### 1. Clone and install
```bash
cd frontend
npm install
```

### 2. Configure environment
Copy `.env.local` and fill in your keys:
```
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=              # free at console.groq.com — default AI provider

# Optional (production upgrades)
ANTHROPIC_API_KEY=         # set AI_PROVIDER=anthropic to switch to Claude
OPENAI_API_KEY=            # fallback for PDF extraction
RESEND_API_KEY=            # email notifications (resend.com)
BROKER_EMAIL=              # where broker notification emails go
UPSTASH_REDIS_REST_URL=    # conversation cache + rate limiting
UPSTASH_REDIS_REST_TOKEN=
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
| Database | Supabase (PostgreSQL + Realtime) |
| File Storage | Supabase Storage |
| Default AI | Groq llama-3.3-70b (free) |
| Primary AI | Claude claude-sonnet-4-6 (set `AI_PROVIDER=anthropic`) |
| Fallback AI | GPT-4.1-mini |
| Cache / Rate limit | Upstash Redis |
| Email | Resend |
| PDF Parsing | pdf-parse |
| Validation | Zod |

## Architecture
See `docs/architecture.md` for full system design, trade-off analysis, AI integration strategy, and edge case handling.

Diagrams: `diagrams/architecture.mmd`, `diagrams/erd.mmd`, `diagrams/lead-flow.mmd`
