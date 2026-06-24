# SecureLife Insurance AI CRM — Architecture Document

## 1. System Overview

SecureLife's manual 2–3 day lead-to-analysis pipeline is replaced by an AI-driven system that:
1. Captures leads conversationally (chatbot)
2. Stores structured data in PostgreSQL with real-time push to the broker dashboard
3. Extracts key fields from insurance PDFs using Claude
4. Generates broker-ready analysis (gaps, savings, risks)
5. Surfaces everything in a clean pipeline dashboard with live KPI analytics
6. Caches conversation history in Redis and rate-limits the chat API to prevent abuse

---

## 2. Core Components

```
Browser (Next.js frontend)
  │
  ├── /                → Pipeline Dashboard (kanban + list, realtime, KPI strip)
  ├── /chat            → Customer chat portal (Priya)
  ├── /leads/[id]      → Lead Detail (chat + docs + analysis)
  │
  ▼
Next.js API Routes (server-side, Node.js)
  │
  ├── /api/chat        → Conversational lead capture (Claude) [Redis cached + rate limited]
  ├── /api/leads       → Lead CRUD
  ├── /api/documents   → PDF upload → extraction (Claude)
  └── /api/analysis    → Gap analysis generation (Claude)
  │
  ├── Supabase (PostgreSQL + Realtime + Auth)
  │     leads / conversations / documents / extracted_data / analyses / profiles
  │     └── Realtime: postgres_changes → pushes INSERT/UPDATE to broker dashboard live
  │
  ├── Upstash Redis (serverless)
  │     └── Conversation history cache (TTL 1h, invalidated on each reply)
  │     └── Chat rate limiter (20 req/min per IP, sliding window)
  │
  ├── Anthropic API (Claude claude-sonnet-4-6)
  │     Chatbot · Extraction · Analysis
  │
  └── Groq API (llama-3.3-70b) ← default free-tier AI provider
      OpenAI API (GPT-4.1-mini) ← fallback for extraction
```

---

## 3. Tech Stack Choices

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 16 App Router | Single repo for frontend + API routes; no separate backend service needed |
| Language | TypeScript | End-to-end type safety; Zod for runtime validation |
| UI | Tailwind + shadcn/ui | Production-quality components in minutes; Linear-style aesthetic |
| Database | Supabase (PostgreSQL + Realtime) | Free tier, instant REST + websocket realtime, built-in Auth + Storage |
| Cache / Rate limit | Upstash Redis | Serverless Redis with REST API — zero infra, integrates natively with Vercel |
| Primary AI | Claude claude-sonnet-4-6 | Best-in-class for structured extraction and nuanced conversation |
| Default AI | Groq (llama-3.3-70b) | Free tier, fast inference — used as default provider in dev/staging |
| Fallback AI | GPT-4.1-mini | Cost-effective extraction fallback if primary rate-limits |
| PDF parsing | pdf-parse | Pure Node.js, no external service; lazy-loaded to avoid Vercel build issues |
| Validation | Zod | Schema validation for all AI JSON outputs before DB insert |
| Auth | Supabase Auth + Google OAuth | Email/password + Google SSO; role-based routing (broker vs. customer) |
| Hosting | Vercel | Zero-config Next.js deployment; auto-deploys on push to master |
| Testing | Vitest | Native TypeScript, no Babel config; 51 unit tests for pure business logic |

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
- Groq free tier as default AI provider in dev/staging; switch to Claude for production via `AI_PROVIDER` env var

### 5.5 Caching Strategy (Redis)
Conversation history is the most frequently re-fetched data in the chat pipeline — loaded on every message to reconstruct context for the AI. Redis eliminates this repeated Supabase query:

```
User sends message
  → Check Redis key conv:{leadId}
      HIT  → use cached history (no DB call)
      MISS → fetch from Supabase, warm cache (TTL 1h)
  → Append user message + AI reply to history
  → Save both to Supabase
  → Invalidate Redis key (next fetch re-warms from DB)
```

TTL is intentionally short (1h) — conversation data is mutable and cache must not serve stale history after a new message.

### 5.6 Rate Limiting
`/api/chat` is rate-limited at 20 requests/minute per IP using Upstash Ratelimit with a sliding window algorithm. This prevents:
- Chatbot abuse / prompt injection attempts
- Runaway AI API costs from a single user
- Supabase write amplification from repeated bot messages

Returns `HTTP 429` with a user-friendly message; the frontend surfaces this inline in the chat bubble.

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
| Chat rate limit exceeded | Redis sliding window returns `429`; user sees "Too many messages, please wait" inline |
| Redis unavailable | Chat route throws → handled by global error boundary; degrades to slower Supabase-only path |
| Realtime connection dropped | Supabase Realtime auto-reconnects; "Live" indicator in header turns grey during reconnect |

---

## 7. What's Built vs. What's Next

### Already implemented
- ✅ Realtime dashboard — Supabase `postgres_changes` pushes lead INSERT/UPDATE live to all broker sessions
- ✅ Analytics KPI strip — Total leads, avg score, docs pending, completed this week (derived client-side, no extra query)
- ✅ Redis caching — Conversation history cached per lead; rate limiting on chat endpoint
- ✅ Auth — Supabase Auth with Google SSO + email/password; broker vs. customer role routing
- ✅ Unit tests — 51 Vitest tests for scoring, urgency, and lead-utils; pre-commit hook enforces green tests

### With more time
1. **WhatsApp integration** — Twilio/Meta API for lead capture over WhatsApp (mentioned explicitly in the brief)
2. **Email notifications** — Resend webhook when a lead hits `qualified` or uploads docs
3. **Audit log** — Every state change recorded for compliance (who changed what, when)
4. **Vector search** — Embed conversation + document text; enable semantic lead search across the pipeline
5. **Lead assignment** — Assign individual leads to specific brokers in multi-broker teams
6. **Document comparison** — Side-by-side diff of two uploaded policies
7. **Conversation export** — Download a lead's full chat + analysis as a branded PDF report
