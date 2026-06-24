# SecureLife Insurance AI CRM — Architecture Document

## 1. System Overview

SecureLife's manual 2–3 day lead-to-analysis pipeline is replaced by an AI-driven system that:
1. Captures leads conversationally (chatbot)
2. Stores structured data in PostgreSQL
3. Extracts key fields from insurance PDFs using Claude
4. Generates broker-ready analysis (gaps, savings, risks)
5. Surfaces everything in a clean pipeline dashboard

---

## 2. Core Components

```
Browser (Next.js frontend)
  │
  ├── /                → Pipeline Dashboard
  ├── /leads/[id]      → Lead Detail (chat + docs + analysis)
  │
  ▼
Next.js API Routes (server-side, Node.js)
  │
  ├── /api/chat        → Conversational lead capture (Claude)
  ├── /api/leads       → Lead CRUD
  ├── /api/documents   → PDF upload → extraction (Claude)
  └── /api/analysis    → Gap analysis generation (Claude)
  │
  ├── Supabase (PostgreSQL + Storage)
  │     leads / conversations / documents / extracted_data / analyses
  │
  ├── Anthropic API (Claude claude-sonnet-4-6)
  │     Chatbot · Extraction · Analysis
  │
  └── OpenAI API (GPT-4.1-mini) ← fallback for extraction only
```

---

## 3. Tech Stack Choices

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 16 App Router | Single repo for frontend + API routes; no separate backend service needed |
| Language | TypeScript | End-to-end type safety; Zod for runtime validation |
| UI | Tailwind + shadcn/ui | Production-quality components in minutes; Linear-style aesthetic |
| Database | Supabase (PostgreSQL) | Free tier, instant REST + realtime, built-in Storage for PDFs |
| Primary AI | Claude claude-sonnet-4-6 | Best-in-class for structured extraction and nuanced conversation |
| Fallback AI | GPT-4.1-mini | Cost-effective extraction fallback if Claude rate-limits |
| PDF parsing | pdf-parse | Pure Node.js, no external service needed; feeds raw text to Claude |
| Validation | Zod | Schema validation for all Claude JSON outputs before DB insert |

**Trade-offs considered:**
- *n8n vs. direct API calls*: n8n adds operational overhead for a single-team MVP; API routes are simpler, faster to debug, and keep all logic in one codebase.
- *Pinecone/vector search vs. simple extraction*: Out of scope for MVP; full-text search in PostgreSQL is sufficient for the pipeline dashboard.
- *Edge runtime vs. Node.js*: pdf-parse requires Node.js; stuck to Node runtime throughout for consistency.

---

## 4. Data Model

See `database/schema.sql` and `diagrams/erd.mmd` for full detail.

**Key entities:**
- `leads` — contact info, status, qualification score, profile fields
- `conversations` — every message (user + assistant + system) per lead
- `documents` — uploaded PDFs, storage path, processing status
- `extracted_data` — structured fields from each PDF
- `analyses` — Claude-generated gap analysis and recommendations

**Status flow:**
```
new → chatting → qualified → awaiting_docs → processing → completed
                                                        ↘ rejected
```

---

## 5. AI Integration Strategy

### 5.1 Chatbot (Lead Capture)
- **Model**: Claude claude-sonnet-4-6
- **Pattern**: Stateful multi-turn — full conversation history sent each call
- **System prompt**: Persona as "Priya from SecureLife". Guides user through name, contact, age, occupation, income, family size, existing coverage, and primary concern. Extracts structured lead object at end.
- **Output**: Streaming text responses + a final structured JSON block (`LEAD_DATA: {...}`) that the API route parses and upserts to `leads`.
- **Edge cases**: Vague answers → follow-up questions; user refuses → gracefully skip field; unrelated messages → gently redirect.

### 5.2 Document Extraction
- **Model**: Claude claude-sonnet-4-6 with JSON mode
- **Pattern**: pdf-parse extracts raw text → fed to Claude with extraction schema prompt → Zod validates response → insert to `extracted_data`
- **Fallback**: If Claude fails or returns invalid JSON → retry once → fall back to GPT-4.1-mini with same prompt → log error if both fail
- **Prompt engineering**: Explicit JSON schema in prompt with field descriptions. Instruct Claude to use `null` for missing fields, never hallucinate.
- **Cost management**: Chunk large PDFs (>10k tokens) into sections; only send relevant pages.

### 5.3 Analysis Generation
- **Model**: Claude claude-sonnet-4-6
- **Input**: Lead profile + all extracted_data for the lead
- **Output**: Structured JSON with `coverage_gaps`, `potential_savings`, `risk_flags`, `recommendation`, `priority`, `confidence_score`
- **Validation**: Zod schema; if invalid → re-prompt once with error message; if still invalid → store raw text and flag for manual review

### 5.4 Cost Management
- Cache system prompts (they don't change per request)
- Log token usage per API call to `raw_analysis`/`raw_fields` for monitoring
- GPT-4.1-mini fallback for extraction reduces cost on high volume

---

## 6. Edge Cases & Failure Modes

| Scenario | Handling |
|----------|---------|
| Scanned PDF (no text layer) | pdf-parse returns empty → return error to user: "Please upload a text-searchable PDF or a higher-quality scan" |
| Claude returns malformed JSON | Zod parse fails → retry with explicit error feedback in prompt → fallback to GPT-4.1-mini |
| Claude API rate limit / 529 | Exponential backoff (3 retries) → surface error to user with retry option |
| Missing fields in PDF | Extraction prompt instructs `null` for unknown fields; UI shows "Not found" gracefully |
| Ambiguous chatbot answer | Follow-up clarification question; after 2 attempts, mark field as optional and continue |
| User abandons chat mid-way | Lead saved with partial data and status `chatting`; resumes from conversation history |
| Large PDF (>50 pages) | Warn user; chunk into 10-page sections; extract per chunk; merge results |
| Duplicate lead (same email) | `leads` table: upsert on email; merge conversation history |
| Supabase Storage outage | Store PDF as base64 in `documents.storage_path` as emergency fallback |
| Network timeout | All API routes have 30s timeout; return 504 with retry hint |

---

## 7. What I'd Add With More Time

1. **Realtime dashboard** — Supabase Realtime subscriptions for live status updates
2. **WhatsApp integration** — Twilio/Meta API for lead capture over WhatsApp
3. **Email parsing** — Forward incoming emails to a webhook; parse attachments automatically
4. **Auth** — Supabase Auth with role-based access (broker vs. analyst vs. admin)
5. **Audit log** — Every state change recorded for compliance
6. **Vector search** — Embed conversation + document text; enable semantic lead search
7. **Analytics** — Conversion rates, avg qualification time, top lead sources
