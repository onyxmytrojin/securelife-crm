# SecureLife Insurance AI CRM — BraindAI Assessment

## Project Goal
Build an AI-powered insurance CRM for SecureLife Brokers:
- Conversational lead capture chatbot
- PDF document extraction (policy details, coverage, exclusions)
- AI-generated gap analysis and broker recommendations
- Pipeline dashboard for the sales team

## Stack
- **Framework**: Next.js 16 (App Router, TypeScript, Turbopack)
- **UI**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **AI**: Claude claude-sonnet-4-6 (primary), GPT-4.1-mini (fallback extraction)
- **PDF**: pdf-parse + Claude structured outputs
- **Validation**: Zod

## Directory Layout
```
frontend/
  app/
    page.tsx                  → Dashboard (lead pipeline)
    leads/[id]/page.tsx       → Lead detail view
    api/
      chat/route.ts           → Chatbot endpoint
      leads/route.ts          → CRUD for leads
      documents/route.ts      → PDF upload + extraction
      analysis/route.ts       → AI analysis generation
  components/
    ui/                       → shadcn primitives
    chat/                     → ChatWindow, ChatMessage, ChatInput
    dashboard/                → LeadCard, PipelineColumn, StatusBadge
    documents/                → UploadZone, ExtractedFields
    analysis/                 → AnalysisPanel
  lib/
    supabase.ts               → Supabase client
    anthropic.ts              → Claude client + helpers
    prompts.ts                → All system prompts
    pdf.ts                    → PDF parsing logic
    types.ts                  → Shared TypeScript types
database/
  schema.sql                  → Full DB schema
  seed.sql                    → Sample data
docs/
  architecture.md
  data-model.md
  ai-strategy.md
  edge-cases.md
diagrams/
  architecture.mmd
  erd.mmd
  lead-flow.mmd
```

## Database Tables
| Table | Purpose |
|-------|---------|
| `leads` | Contact info, status, qualification score |
| `conversations` | Full chat history per lead |
| `documents` | Uploaded PDF metadata |
| `extracted_data` | Structured fields from PDFs |
| `analyses` | AI-generated gap analysis + recommendations |

## Lead Status Flow
`new` → `chatting` → `qualified` → `awaiting_docs` → `processing` → `completed` → `rejected`

## Design Principles
- Minimal white dashboard — Linear-style, clean typography
- No magic strings — use enums/constants
- All AI outputs validated with Zod before DB insert
- Every API route handles errors and returns typed JSON
- Prompts live in `lib/prompts.ts`, not inline in routes

## Environment Variables (see .env.local)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
