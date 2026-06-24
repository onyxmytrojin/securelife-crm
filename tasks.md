# Assessment Tasks — SecureLife AI CRM

## Phase 1: Foundation (60 min) ✅
- [x] Scaffold Next.js 16 app
- [x] Install shadcn/ui + all components
- [x] Install Supabase, Anthropic, OpenAI, pdf-parse, zod
- [x] Write CLAUDE.md
- [x] Write architecture.md
- [x] Write data model diagram (ERD)
- [x] Create .env.local template
- [x] Create database/schema.sql

## Phase 2: Database Layer (30 min)
- [ ] Set up Supabase project (free tier)
- [ ] Run schema.sql in Supabase SQL editor
- [ ] Create lib/supabase.ts client
- [ ] Create lib/types.ts shared types

## Phase 3: AI + PDF Layer (60 min)
- [ ] Create lib/anthropic.ts Claude client
- [ ] Create lib/prompts.ts — chatbot system prompt, extraction prompt, analysis prompt
- [ ] Create lib/pdf.ts — pdf-parse wrapper
- [ ] Create app/api/chat/route.ts — conversational lead capture
- [ ] Create app/api/documents/route.ts — PDF upload + Claude extraction
- [ ] Create app/api/analysis/route.ts — gap analysis generation
- [ ] Create app/api/leads/route.ts — CRUD

## Phase 4: Dashboard UI (90 min)
- [ ] app/page.tsx — pipeline board (Kanban-style columns by status)
- [ ] components/dashboard/LeadCard.tsx
- [ ] components/dashboard/PipelineColumn.tsx
- [ ] components/dashboard/StatusBadge.tsx
- [ ] app/leads/[id]/page.tsx — lead detail page

## Phase 5: Chatbot UI (60 min)
- [ ] components/chat/ChatWindow.tsx
- [ ] components/chat/ChatMessage.tsx
- [ ] components/chat/ChatInput.tsx
- [ ] Wire to /api/chat route
- [ ] Test full conversation → lead created in DB

## Phase 6: Document Upload UI (45 min)
- [ ] components/documents/UploadZone.tsx — drag + drop PDF
- [ ] components/documents/ExtractedFields.tsx — show parsed fields
- [ ] Wire to /api/documents route
- [ ] Test with sample insurance PDF

## Phase 7: Analysis Panel (30 min)
- [ ] components/analysis/AnalysisPanel.tsx
- [ ] Wire to /api/analysis route
- [ ] Show coverage gaps, savings, risk flags, recommendation

## Phase 8: Polish + Diagrams (45 min)
- [ ] Finish architecture.md
- [ ] Write diagrams/*.mmd (Mermaid)
- [ ] README.md with setup instructions
- [ ] Run full end-to-end test
- [ ] Record Loom walkthrough

---

## Key API Routes
| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/chat | Send message, get AI reply, save to DB |
| GET | /api/leads | List all leads with status |
| POST | /api/leads | Create lead manually |
| PATCH | /api/leads/[id] | Update lead status |
| POST | /api/documents | Upload + extract PDF |
| POST | /api/analysis | Generate AI analysis for lead |
