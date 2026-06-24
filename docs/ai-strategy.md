# SecureLife CRM — AI Integration Strategy

---

## Overview

Three distinct AI tasks, each with a different model configuration, prompt style, and validation approach:

| Task | Model (default) | Pattern | Output |
|------|----------------|---------|--------|
| Lead capture chatbot | Groq llama-3.3-70b | Stateful multi-turn | Streaming text + LEAD_DATA JSON |
| Document extraction | Groq llama-3.3-70b | Single-shot JSON mode | Structured fields (Zod validated) |
| Gap analysis | Groq llama-3.3-70b | Single-shot JSON mode | 6-field analysis object (Zod validated) |

Switch to Claude claude-sonnet-4-6 for any task by setting `AI_PROVIDER=anthropic` in environment variables.

---

## 1. Chatbot — Lead Capture (Aria)

**Persona**: Aria, friendly insurance advisor at SecureLife.

**Goal**: Collect name, phone, email, age, occupation, annual income, family size, existing coverage, location, and all insurance concerns through natural conversation — not a form.

**Structured input widgets**: The system prompt instructs the AI to append special tags after its message text:
- `CHOICES:[...]` — single-select (e.g. occupation, income bracket)
- `MULTI_CHOICES:[...]` — multi-select (e.g. insurance interests)
- `NUMBER_INPUT:{label, min, max}` — numeric stepper (age, family size)

The frontend parses these tags and renders native UI widgets instead of free-text replies, improving data accuracy without breaking conversation flow.

**Data extraction**: Two parallel extraction paths run on every user message:

1. **Regex extraction** (`lib/concerns.ts`) — fires immediately when the user sends a message, before AI responds. Captures phone numbers, age, family size, income labels, and known occupation strings from exact text matches. Saves to `leads` without waiting for the AI round-trip.

2. **LEAD_DATA block** — the AI appends a JSON object to every reply once it has collected any field:
   ```
   LEAD_DATA:{"name":"...","phone":"...","age":34,"concerns":["health","life"],...}
   ```
   The API route strips this from the displayed reply and upserts all fields to `leads`. Annual income bracket labels are converted to numeric midpoints (e.g. "₹8–12 lakhs" → 1000000).

**Auto-qualification**: When LEAD_DATA contains a phone number and at least one concern, the lead is automatically moved to `qualified` and the broker receives an email notification.

**Cross-session sync**: When a returning customer starts a follow-up session, any new profile data they share is propagated backwards to all their sibling sessions via `syncProfileToSiblings`.

**Conversation caching**: Full conversation history is cached in Upstash Redis (TTL 1h). On every message the API checks Redis first; Supabase is only queried on cache miss. Cache is invalidated after each AI reply so stale history is never served.

**Rate limiting**: 20 requests/minute per IP using Upstash sliding window. Returns HTTP 429 with a user-facing message.

---

## 2. Document Extraction

**Input**: Raw text extracted from a PDF by `pdf-parse` (Node.js, no external service).

**Prompt**: Explicit JSON schema in the system prompt. Claude is instructed to use `null` for any field not found — never guess or hallucinate. Scanned PDFs with no text layer return `{"error": "no_text_layer"}`.

**Output schema** (Zod validated before DB insert):
```typescript
{
  policy_number, policy_type, provider_name, policyholder_name,
  sum_insured, premium_amount, premium_frequency,
  coverage_start, coverage_end, renewal_date,
  pre_existing_conditions, exclusions, waiting_period, claim_history,
  raw_fields
}
```

**Fallback chain**: Claude → GPT-4.1-mini (if Claude fails or returns invalid JSON). Each fallback is logged with the error reason.

**Large PDFs**: PDFs over 10k tokens are chunked into sections; results are merged post-extraction.

---

## 3. Gap Analysis — Arjun Kapoor Persona

**Persona**: Arjun Kapoor, Senior Insurance Consultant with 24 years of experience, IRDA Certified, Chartered Insurance Practitioner. Writes for junior brokers who will call the client within 24 hours.

**7-section analytical framework**:
1. Life Stage Assessment (Early Career / Prime Earning / Pre-Retirement / Retired)
2. Human Life Value (HLV) calculation — 15–20x annual income recommended
3. Health insurance adequacy vs. Indian benchmarks (₹10L minimum individual, ₹20L family floater in metros)
4. Protection gaps — critical illness, personal accident, disability income
5. Existing coverage review (from uploaded documents)
6. Tax optimisation — Section 80C (life premiums up to ₹1.5L) and Section 80D (health premiums up to ₹50K)
7. Premium affordability — total premiums should be 3–6% of annual income

**STATED vs VERIFIED discipline**: All client-stated information is clearly labelled STATED; information extracted from uploaded documents is VERIFIED. The confidence score is penalised when key claims are STATED but not VERIFIED.

**Indian product vocabulary** used precisely: pure term plan, family floater, super top-up, standalone critical illness plan, personal accident policy, ULIP, endowment policy, group cover.

**Output schema** (Zod validated):
```typescript
{
  coverage_gaps: string,
  potential_savings: string,
  risk_flags: string,
  recommendation: string,
  priority: 'low' | 'medium' | 'high' | 'urgent',
  confidence_score: number  // 0–100
}
```

---

## Prompt engineering principles

- All system prompts live in `lib/prompts.ts` — never inline in route handlers
- JSON schemas are included verbatim in prompts to eliminate ambiguity
- Fallback instructions are explicit: "if a field is not in the document, return null — never guess"
- Persona prompts establish authority and audience before giving instructions
- LEAD_DATA format is pinned in the system prompt with a concrete example to prevent format drift

---

## Cost management

- Groq free tier is the default provider — zero API cost in development and staging
- Conversation history is Redis-cached to avoid re-fetching from Supabase on every message
- System prompts are static per session; Anthropic prompt caching applies automatically on Claude
- GPT-4.1-mini used only as extraction fallback (cheapest capable model for structured JSON tasks)
- Large PDFs chunked to avoid sending unnecessary tokens
