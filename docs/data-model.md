# SecureLife CRM — Data Model

Full ERD: `diagrams/erd.mmd`  
Full schema: `database/schema.sql`

---

## Tables

### `leads`
Central entity. One row per customer engagement (or follow-up session).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Auto-generated |
| `ticket_number` | integer unique | Auto-assigned (#0001, #0002…) via DB trigger |
| `name` | text | Captured by chatbot |
| `email` | text | Used for cross-session profile sync |
| `phone` | text | |
| `status` | text | `new → chatting → qualified → awaiting_docs → processing → completed → rejected` |
| `score` | integer 0–100 | Computed from field completeness |
| `source` | text | `chatbot \| manual \| api` |
| `age` | integer | |
| `occupation` | text | One of 12 CHOICES options or free text |
| `annual_income` | numeric | Stored as rupee integer (e.g. 1800000) |
| `family_size` | integer | |
| `existing_coverage` | text | Free-text summary of current policies |
| `primary_concern` | text | First / most important concern |
| `concerns` | text[] | All concerns: health, life, auto, property, loan, retirement, travel |
| `location` | text | City |
| `notes` | text | Broker-editable notes (inline edit on lead detail page) |
| `parent_lead_id` | uuid FK → leads | Set on follow-up sessions; links back to original enquiry |
| `session_type` | text | `new_inquiry \| follow_up` |

### `conversations`
Every message in a lead's chat history.

| Column | Type | Notes |
|--------|------|-------|
| `lead_id` | uuid FK → leads | |
| `role` | text | `user \| assistant \| system` |
| `content` | text | Full message text (may contain CHOICES/NUMBER_INPUT tags pre-parse) |

### `documents`
Uploaded insurance PDFs.

| Column | Type | Notes |
|--------|------|-------|
| `lead_id` | uuid FK → leads | |
| `filename` | text | Original filename |
| `storage_path` | text | Supabase Storage path |
| `status` | text | `pending → processing → extracted → failed` |

### `extracted_data`
Structured fields extracted from a PDF by Claude.

| Column | Type | Notes |
|--------|------|-------|
| `document_id` | uuid FK → documents | |
| `lead_id` | uuid FK → leads | Denormalised for query convenience |
| `policy_number` | text | |
| `policy_type` | text | `life \| health \| auto \| property \| other` |
| `provider_name` | text | |
| `sum_insured` | numeric | Rupees |
| `premium_amount` | numeric | Rupees |
| `premium_frequency` | text | `monthly \| quarterly \| annual \| one-time` |
| `coverage_start/end` | date | |
| `renewal_date` | date | |
| `pre_existing_conditions` | text | |
| `exclusions` | text | |
| `waiting_period` | text | |
| `raw_fields` | jsonb | Full extraction JSON from Claude |

### `analyses`
AI-generated broker analysis per lead.

| Column | Type | Notes |
|--------|------|-------|
| `lead_id` | uuid FK → leads | |
| `coverage_gaps` | text | What the client is missing |
| `potential_savings` | text | Cost optimisation opportunities |
| `risk_flags` | text | Underinsurance risks, expiring policies |
| `recommendation` | text | Specific action for broker with product names and amounts |
| `priority` | text | `low \| medium \| high \| urgent` |
| `confidence_score` | integer 0–100 | Based on STATED vs VERIFIED discipline |
| `raw_analysis` | jsonb | Full structured JSON from Claude |

### `profiles`
Supabase Auth user extension. Created automatically via trigger on `auth.users` insert.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK FK → auth.users | |
| `role` | text | `customer \| broker \| admin \| manager` |
| `name` | text | |
| `email` | text | |

---

## Key relationships

```
leads 1──* conversations
leads 1──* documents 1──1 extracted_data
leads 1──0/1 analyses
leads 0/1──* leads  (parent_lead_id self-join for follow-up sessions)
auth.users 1──1 profiles
```

## Status flow

```
new ──► chatting ──► qualified ──► awaiting_docs ──► processing ──► completed
                                                                  └──► rejected
```

Transitions driven by:
- `chatting`: first message sent
- `qualified`: AI detects phone + concern in LEAD_DATA block → auto-update
- `awaiting_docs`: broker manually moves lead or triggers doc request
- `processing`: document uploaded and extraction started
- `completed`: analysis generated
- `rejected`: broker marks as unqualified

## Indexes

- `conversations(lead_id, created_at)` — conversation history load
- `documents(lead_id)` — docs per lead
- `extracted_data(lead_id)`, `extracted_data(document_id)` — extraction lookup
- `analyses(lead_id)` — analysis per lead

## Notable design decisions

- **`ticket_number`** is a separate auto-incrementing sequence (not the UUID) so humans can say "ticket #0042" in a call
- **`concerns` is `text[]`** not a join table — insurance interests are a bounded set and array operations are fast enough at CRM scale
- **`parent_lead_id` self-join** enables follow-up sessions without duplicating the customer profile
- **`raw_fields` / `raw_analysis` jsonb** stores the full Claude output alongside structured columns — useful for debugging extraction quality without re-running the AI
