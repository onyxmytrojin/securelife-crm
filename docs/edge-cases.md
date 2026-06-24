# SecureLife CRM — Edge Cases & Failure Modes

---

## Chatbot

| Scenario | Handling |
|----------|---------|
| User gives vague answer ("I earn okay") | AI asks a gentle follow-up; on second vague answer, moves on and marks field as unknown |
| User refuses to share a field | AI says "No problem!" and continues; field stays null |
| User gives multiple concerns in one message | Regex and AI both extract all of them; `concerns` is an array, not a single value |
| User sends off-topic message | AI redirects: "That's a great question! For now, let me focus on understanding your needs better." |
| Duplicate lead (same email, new session) | New lead row created with `parent_lead_id` pointing to original; profile fields synced via `syncProfileToSiblings` |
| Rate limit hit (>20 msg/min) | HTTP 429 returned; frontend shows inline "Too many messages, please wait" in the chat bubble |
| Redis unavailable | Chat route catches the error; falls back to loading conversation history from Supabase directly |
| AI returns malformed LEAD_DATA JSON | `JSON.parse` fails silently; logged as warning; lead update skipped for that turn |
| User opens two sessions simultaneously | Each session has its own lead row; profile updates sync bidirectionally via email match |
| NUMBER_INPUT submitted as 0 or out of range | Frontend enforces min/max on the widget; `sendNumInput` only fires when value is valid |

---

## Document Extraction

| Scenario | Handling |
|----------|---------|
| Scanned PDF (no text layer) | `pdf-parse` returns empty string; extraction prompt returns `{"error": "no_text_layer"}`; UI shows "Please upload a text-searchable PDF" |
| PDF with partial text (mixed scan + digital) | Extracted text is partial; Claude fills what it can, uses null for missing fields |
| Claude returns invalid JSON | Zod parse fails → retry once with explicit error message in prompt → fallback to GPT-4.1-mini |
| Both Claude and GPT-4.1-mini fail | Document marked as `failed`; error stored in `documents.error`; broker sees "Extraction failed" badge |
| PDF over 50 pages | Warning shown to user; PDF chunked into 10-page sections; results merged (later fields override if duplicated) |
| Duplicate document upload | No deduplication currently — second upload creates a new `documents` row; broker sees both in the list |
| Non-PDF file uploaded | Frontend restricts to `accept=".pdf"`; API route validates MIME type and rejects non-PDF with 400 |
| Supabase Storage outage | Upload fails; error surfaced to user with retry option |
| Policy with non-standard date formats | Claude normalises to YYYY-MM-DD per extraction prompt; if ambiguous, returns null |
| Currency in lakhs/crores text | Extraction prompt instructs conversion to plain integer (₹5,00,000 → 500000) |

---

## Analysis Generation

| Scenario | Handling |
|----------|---------|
| No documents uploaded | Analysis runs on profile data only; all fields marked STATED; confidence score capped at 60 |
| Analysis JSON fails Zod validation | Re-prompt once with the schema error message → if still invalid, store raw text in `raw_analysis` and flag for manual review |
| Client has no existing coverage | Analysis focuses on recommendations only; Section 5 (existing coverage review) omitted |
| Client income is zero (student/retired) | HLV section adapted — focus on health and critical illness rather than life cover |
| Confidence score below 40 | `priority` automatically set to `medium` at most regardless of AI output; broker alerted to collect more data |

---

## Dashboard & Real-time

| Scenario | Handling |
|----------|---------|
| Supabase Realtime connection dropped | Auto-reconnects; "Live" indicator in header turns grey during reconnect window |
| Broker and customer edit same lead simultaneously | Last-write-wins (Supabase default); no optimistic locking — acceptable at CRM scale |
| Very large conversation history (>200 messages) | Redis TTL 1h; full history loaded from Supabase on cache miss; no pagination yet (future work) |
| Lead stuck in `processing` | No automatic timeout currently; broker can manually move status via dashboard |

---

## Auth & Security

| Scenario | Handling |
|----------|---------|
| Customer tries to access `/` (broker dashboard) | Middleware redirects to `/chat` |
| Broker tries to access `/chat` | Middleware redirects to `/` |
| Unauthenticated request to any page | Middleware redirects to `/login` |
| API routes called without service role key | All writes use `supabaseAdmin` (service role) server-side; anon key is read-only and never used for writes |
| Prompt injection via chat message | System prompt is server-controlled and never user-editable; user message is passed as a separate `user` role turn |

---

## Email Notifications

| Scenario | Handling |
|----------|---------|
| `RESEND_BROKER_API_KEY` not set | `sendEmail` returns early silently; no crash |
| Lead has no email (customer notification) | `notifyCustomerDocsRequested` checks `lead.email` and returns early if null |
| Resend API returns non-200 | Error logged to console; notification silently dropped (non-critical path) |
| Broker email bounces | Resend handles bounce tracking; no retry logic in CRM code |
