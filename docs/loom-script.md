# SecureLife CRM — Loom Walkthrough Script
# Full 12–15 minute recording guide

---

## BEFORE YOU HIT RECORD — SETUP CHECKLIST

Open these tabs in your browser and keep them ready:

| Tab | URL | Who |
|-----|-----|-----|
| 1. Broker Dashboard | https://securelife-crm.vercel.app/ | Logged in as `shubhanmehrotra.teamedge@gmail.com` / `Broker123!` |
| 2. Customer Chat | https://securelife-crm.vercel.app/chat | Logged in as `shubhanmehrotra@gmail.com` |
| 3. Broker Gmail | gmail.com | `shubhanmehrotra.teamedge@gmail.com` — for incoming broker emails |
| 4. Architecture diagram | Open `diagrams/architecture.mmd` in any Mermaid renderer (mermaid.live) |
| 5. ERD | Open `diagrams/erd.mmd` in mermaid.live |
| 6. Lead flow | Open `diagrams/lead-flow.mmd` in mermaid.live |

Also open VS Code with the project root visible so you can show `lib/prompts.ts` and `lib/notifications.ts` briefly.

---

## SEGMENT 1 — INTRO (0:00 – 1:00)

**Show:** Broker dashboard at `/`

**Say:**
> "Hi — I'm going to walk through SecureLife CRM, an AI-powered insurance lead management system I built for the BraindAI Senior AI Engineer assessment. The system has four core capabilities:
> one — a conversational chatbot that qualifies leads and captures structured profile data,
> two — a PDF extraction pipeline that reads existing insurance policies,
> three — an AI gap analysis engine that produces broker-ready recommendations,
> and four — a real-time pipeline dashboard that ties it all together.
> Let me walk through each of these end to end."

**Point out on screen:**
- The kanban columns: New → Chatting → Qualified → Awaiting Docs → Processing → Completed
- The KPI strip at the top (total leads, average score, docs pending, completed this week)
- The green "Live" badge — "this is a live Supabase Realtime connection — the board updates the moment anything changes, no refresh needed"
- Scroll through a few lead cards to show ticket numbers (#0001 etc.) and score badges

---

## SEGMENT 2 — ARCHITECTURE (1:00 – 3:30)

**Show:** Switch to the architecture Mermaid diagram (Tab 4)

**Say:**
> "Before the demo, let me quickly walk through the architecture. Everything runs in a single Next.js 16 App Router project — the frontend pages and all API routes live in one repo, deployed to Vercel."

**Point out on the architecture diagram:**
- Browser splits into two portals: `/` for the broker, `/chat` for the customer
- Next.js API routes: `/api/chat`, `/api/leads`, `/api/documents`, `/api/analysis`
- AI layer: "Groq with llama-3.3-70b is the default — it's free and fast. Switching to Claude claude-sonnet-4-6 is one environment variable change. There's also a GPT-4.1-mini fallback for document extraction."
- Supabase block: "PostgreSQL for persistence, Realtime websockets for the live dashboard, Storage for uploaded PDFs"
- Upstash Redis: "Conversation history is cached here — the chat API checks Redis first on every message to avoid hitting the database. Rate limiting also runs through Redis — 20 messages per minute per IP."
- Resend block: "Two separate Resend accounts — one for broker notifications, one for customer emails. This was the cleanest way to send to both addresses on Resend's free tier without a verified domain."

**Switch to ERD diagram (Tab 5)**

**Say:**
> "The data model has five tables."

**Point out:**
- `leads` — "central entity. One row per customer session. Has a self-join via `parent_lead_id` for follow-up sessions — more on that later."
- `conversations` — "every single message in every chat, with role: user or assistant"
- `documents` + `extracted_data` — "uploaded PDFs link to structured field rows"
- `analyses` — "AI output per lead: gaps, savings, risk flags, recommendation, priority, confidence score"
- `profiles` — "extends Supabase Auth users with role: broker or customer — drives the middleware routing"
- Point to the ticket_number column: "auto-assigned by a PostgreSQL trigger on insert, so every lead gets a human-readable ID like #0017"

**Switch to lead-flow diagram (Tab 6)**

**Say:**
> "And this is the full sequence — from customer opening the chat to the broker receiving an email. I'll walk through all of this live now."

---

## SEGMENT 3 — CUSTOMER CHAT FLOW (3:30 – 7:00)

**Show:** Switch to Tab 2 — Customer chat at `/chat`

**Say:**
> "This is the customer portal. The chatbot is Aria, a friendly insurance advisor persona. The goal is to collect a full insurance profile through natural conversation — not a form."

**Type and send:** `"Hi, I need health insurance for my family"`

**Show Aria's response — say:**
> "Aria acknowledges the concern first before asking for anything. That's intentional — the prompt instructs her to never lead with a data collection question."

**When Aria asks for phone — type:** `9876500001`

**When Aria asks for occupation — CHOICES widget appears — say:**
> "Here's one of the structured input widgets. Instead of free text, Aria renders a single-select choice list — twelve occupation categories. This was built to improve data accuracy. The customer clicks a button instead of typing, so we get clean, consistent data in the database."

**Select:** "Doctor / Healthcare"

**When Aria asks for income — CHOICES appear — say:**
> "Same pattern for income — nine pre-defined brackets. The customer picks one, the system converts the label to a numeric midpoint — so '₹20–35 lakhs' becomes 2,750,000 in the database. No parsing ambiguity."

**Select:** "₹20–35 lakhs"

**When Aria asks for age — NUMBER_INPUT widget appears — say:**
> "For numeric fields like age and family size, there's a number input widget — a stepper with min/max validation. No free text, no chance of getting 'thirty-two' instead of 32."

**Set age to 31, submit.**

**When Aria asks for family size — NUMBER_INPUT — set to 3, submit.**

**When Aria asks about insurance interests — MULTI_CHOICES appear — say:**
> "Multi-select for insurance interests — the customer can pick as many as apply. This populates the `concerns` array on the lead."

**Select:** Health Insurance, Life Insurance

**Continue until Aria says a specialist will be in touch. Then say:**
> "Two things just happened simultaneously. First, the moment Aria detected a phone number plus at least one concern, she tagged this lead as qualified and the database was updated. Second — an email fired automatically to the broker."

**Switch to Tab 3 — Broker Gmail (teamedge)**

**Say:**
> "Here it is — the broker notification landed automatically. Ticket number, full profile, all the fields Aria collected, and a direct link to open the lead in the CRM. This is powered by Resend using the broker's dedicated account."

**Point out:** name, phone, income, occupation, family size, interests chips, Open lead button

---

## SEGMENT 4 — BROKER DASHBOARD REALTIME (7:00 – 8:30)

**Switch to Tab 1 — Broker dashboard**

**Say:**
> "And on the broker dashboard — that lead is already here in the Qualified column. No refresh. Supabase Realtime pushed the INSERT event via websocket the moment it happened."

**Point out the new lead card:**
- Ticket number, name, score badge, concern chips
- "The score is computed from field completeness — this lead has 7 out of 10 fields filled so it scores around 70"

**Click into the lead — show the Lead Detail page. Say:**
> "This is the lead detail view. On the right is the properties panel."

**Point out:**
- Insurance interests as coloured chips
- Financial profile section: income formatted as ₹28L/yr, occupation, age, family
- Personal details: phone, email, location
- Broker notes section: "This is editable inline — brokers can add private notes without leaving the page"

**Click the pencil icon on Broker Notes — type:** `Doctor with high income — no health cover at all, priority follow-up`

**Click Save — say:**
> "Saved via a PATCH to the leads API. No form submit, no page reload."

---

## SEGMENT 5 — STATUS CHANGE & CUSTOMER EMAIL (8:30 – 9:30)

**Still on lead detail page — find the status selector**

**Say:**
> "When the broker is ready to request documents, they move the lead to Awaiting Docs. This triggers a customer notification email automatically."

**Change status to "Awaiting Docs"**

**Switch to Tab 2 customer Gmail (shubhanmehrotra@gmail.com) — say:**
> "The customer receives this email — asking them to upload their existing policy documents through the chat portal. The link goes straight back to their session."

**Show the email — point out:** personalised greeting with first name, upload button, privacy note

---

## SEGMENT 6 — PDF UPLOAD & EXTRACTION (9:30 – 11:30)

**Switch to the Lead Detail page — go to Documents tab**

**Say:**
> "Back on the lead detail as broker — the Documents tab shows the upload zone. Let me upload the two sample policies."

**Upload `samples/lic-tech-term-plan.pdf` — say:**
> "This is an LIC Tech Term plan. The pipeline runs pdf-parse to extract raw text, then sends it to the AI with a strict JSON schema prompt — the model is told to use null for any field not in the document, never hallucinate."

**Show the extracted fields appearing:**
- Policy number, type: Life, provider: LIC of India
- Sum insured: ₹1,50,00,000
- Annual premium: ₹17,412
- Coverage dates, renewal date
- Exclusions

**Say:**
> "Every field is Zod-validated before it touches the database. If the AI returns something that doesn't match the schema, we retry once with the error message in the prompt, then fall back to GPT-4.1-mini."

**Upload `samples/star-health-family-floater.pdf` — say:**
> "Second document — a Star Health family floater. Different policy type, different fields."

**Show extracted fields:**
- Type: Health, provider: Star Health
- Sum insured: ₹10,00,000
- Family floater covering 3 members
- Pre-existing condition: Hypertension, 36-month waiting period
- Premium: ₹26,491/yr

**Say:**
> "Notice the pre-existing condition and the waiting period — these go directly into the analysis as risk flags."

---

## SEGMENT 7 — AI GAP ANALYSIS (11:30 – 13:30)

**Click "Generate Analysis" button — say:**
> "Now for the analysis. This uses a persona called Arjun Kapoor — a senior insurance consultant with 24 years of experience. The AI receives the full lead profile plus both extracted documents and runs through a seven-section framework."

**While it loads, say:**
> "The seven sections are: life stage assessment, Human Life Value calculation, health insurance adequacy against Indian benchmarks, protection gaps like critical illness and personal accident cover, existing coverage review from the documents, tax optimisation under Section 80C and 80D, and premium affordability as a percentage of income."

**Analysis loads — show and point out:**

- **Coverage gaps** — "HLV recommends ₹4.2–5.6 Cr at this income level. The existing LIC term is only ₹1.5 Cr — a ₹3 Cr shortfall. No standalone critical illness cover."
- **Risk flags** — "The hypertension pre-existing condition has a 36-month waiting period — if hospitalisation happens before June 2027, the health policy won't pay. That's a major gap."
- **Potential savings** — "80D hasn't been utilised — ₹26,491 premium is fully deductible. That's a saving of ₹8,247/yr at the 31% tax bracket."
- **Recommendation** — "Specific product types with rupee amounts — not vague suggestions. Pure term top-up to ₹3 Cr, standalone critical illness ₹25–50L, super top-up for health."
- **Priority badge** — "High. Confidence: 78%. The confidence is lower than 100% because some fields are STATED — from the chat — not VERIFIED from a document."
- **STATED vs VERIFIED discipline** — "The AI distinguishes what the client told us versus what's in an actual document. Income is STATED. The policy details are VERIFIED. That distinction drives the confidence score and tells the broker where to probe further."

**Switch to Tab 3 — Broker Gmail (teamedge) — say:**
> "And the broker gets a third email — analysis ready, with priority level and a preview of the recommendation."

---

## SEGMENT 8 — FOLLOW-UP SESSIONS (13:30 – 14:15)

**Switch to customer chat portal at `/chat`**

**Say:**
> "One more feature — returning customers can start a follow-up session. If the same customer logs back in after their initial consultation, they see their previous sessions and can open a linked follow-up."

**Show the session history list — click "Start follow-up"**

**Say:**
> "The follow-up chat has a different persona — it already knows their name and history, and focuses on answering questions rather than collecting data again. Any new information they share gets synced back to all their previous sessions automatically via a cross-session profile sync function."

**Show the follow-up greeting — point out:** "it references their existing enquiry and topic rather than starting from scratch"

---

## SEGMENT 9 — PIPELINE & FILTERS (14:15 – 14:45)

**Back to broker dashboard — say:**
> "The full pipeline. Every lead across all stages."

**Show:**
- Scroll across all kanban columns
- Point out the different status colours and score badges
- Show the filter controls — filter by status or score range
- "Seven leads seeded across every stage so you can see the full pipeline at a glance"

**Briefly open `docs/architecture.md` in VS Code — say:**
> "The full architecture doc, data model doc, AI strategy doc, and edge cases doc are all in the repo. The Mermaid diagrams in `diagrams/` are version-controlled and auto-regenerated by a local Claude Code cron loop whenever source files change."

**Briefly show `frontend/lib/prompts.ts` in VS Code — say:**
> "All AI prompts live in a single file — never inline in route handlers. The Aria persona, the Arjun Kapoor analysis persona, the extraction schema — all here, version-controlled, easy to audit and change."

---

## SEGMENT 10 — WRAP-UP (14:45 – 15:00)

**Show broker dashboard one final time**

**Say:**
> "To summarise what's built and shipped:
> — Conversational lead capture with structured CHOICES and NUMBER_INPUT widgets
> — Real-time broker dashboard via Supabase Realtime websockets
> — PDF extraction with Claude or Groq plus Zod schema validation
> — AI gap analysis with an Indian insurance expert persona and seven-section framework
> — Dual Resend email notifications — broker gets qualified, docs, and analysis alerts; customer gets the docs request
> — Follow-up sessions with cross-session profile sync
> — Role-based auth with Supabase and Google SSO
> — 51 unit tests with a pre-commit hook that blocks commits on failure
> — Local automation loops for doc regeneration via Claude Code CronCreate
> — Full architecture, data model, AI strategy, and edge case documentation in the repo
>
> The stack is Next.js 16, TypeScript, Supabase, Groq as the default free AI provider with Claude as a one-env-var upgrade, Upstash Redis, and Resend for email. Thanks for watching."

---

## QUICK REFERENCE — CREDENTIALS FOR THE RECORDING

| Role | Email | Password |
|------|-------|----------|
| Broker | shubhanmehrotra.teamedge@gmail.com | Broker123! |
| Customer | shubhanmehrotra@gmail.com | (Google SSO or your existing password) |

## THINGS THAT HAPPEN AUTOMATICALLY (no manual steps needed)

| Action | Automatic result |
|--------|-----------------|
| Customer gives phone + concern in chat | Lead → Qualified + broker email fires |
| Broker moves lead to Awaiting Docs | Customer email fires |
| PDF extracted successfully | Document status → extracted, fields shown |
| Broker clicks Generate Analysis | Analysis saved + broker email fires |
| Any source file committed to git | `.docs-pending` flag written → Claude Code loop regenerates diagrams |
