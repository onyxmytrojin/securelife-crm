# SecureLife CRM — Loom Walkthrough Script

---

## BEFORE YOU START
[Open these tabs and keep them ready — do not show this list on screen]

- Tab 1 → securelife-crm.vercel.app/ — broker dashboard, logged in as shubhanmehrotra.teamedge@gmail.com / Broker123!
- Tab 2 → securelife-crm.vercel.app/chat — customer portal, logged in as shubhanmehrotra@gmail.com
- Tab 3 → gmail.com — shubhanmehrotra.teamedge@gmail.com inbox open (broker email)
- Tab 4 → mermaid.live — architecture.mmd loaded
- Tab 5 → mermaid.live — erd.mmd loaded
- Tab 6 → mermaid.live — lead-flow.mmd loaded
- VS Code → project root open, lib/prompts.ts visible in sidebar

[Start on the broker dashboard Tab 1. Make sure seed data is loaded so the pipeline looks full.]

---

## SEGMENT 1 — INTRODUCTION (0:00 – 1:00)
[Show the broker dashboard. Scroll slowly so the assessor can take it in.]

So what I've built here is SecureLife CRM — it's an AI-powered insurance lead management system. The brief was to solve a real problem that insurance brokers face: the gap between when a customer first shows interest and when the broker actually has enough information to recommend a product. Traditionally that process takes two to three days of back-and-forth calls and emails. This system compresses it into a single automated flow.

There are four things the system does. First, a conversational chatbot that qualifies leads and captures structured profile data. Second, a PDF extraction pipeline that reads the customer's existing insurance policies. Third, an AI gap analysis engine that tells the broker exactly what the customer is missing and what to recommend. And fourth, this real-time pipeline dashboard that the broker uses to manage everything.

[Point to the kanban columns left to right — New, Chatting, Qualified, Awaiting Docs, Processing, Completed.]

Every lead moves through these stages automatically as the customer interacts with the system. And this green Live badge up here — that means the board is connected via a Supabase Realtime websocket. When anything changes anywhere, it shows up here instantly without a page refresh.

[Point to the KPI strip at the top.]

The broker gets a quick snapshot up top — total leads in the pipeline, average qualification score, how many are waiting on documents, and how many closed this week. All computed client-side from the same data, no extra queries.

---

## SEGMENT 2 — ARCHITECTURE (1:00 – 3:30)
[Switch to Tab 4 — architecture diagram on mermaid.live]

Let me quickly walk through the architecture before we get into the demo, because I think the design decisions here are worth explaining.

[Point to the browser layer at the top.]

Everything runs in a single Next.js 16 App Router project — no separate backend service. The frontend and all the API routes live in one repo, deployed to Vercel. This was a deliberate choice — for a CRM of this scale, a separate microservices backend would be over-engineering. Having everything in one place makes it much easier to reason about, debug, and deploy.

[Point to the two portal routes.]

There are two distinct portals. The broker logs into the root — that's the pipeline dashboard and lead management. The customer logs into slash chat — that's the conversational interface. The middleware checks the user's role in the database on every request and routes them to the right place. A broker trying to access the customer portal gets redirected to the dashboard, and vice versa.

[Point to the API routes.]

Four API routes handle all the server-side logic — chat, leads, documents, and analysis. Each one is responsible for one thing and one thing only.

[Point to the AI layer.]

Now this is an interesting part of the architecture. The default AI provider is Groq running llama-3.3-70b — it's free, it's fast, and for a demo environment it means zero API cost. But the system is designed so you can switch to Claude claude-sonnet-4-6 by changing a single environment variable. The abstraction layer in lib/ai.ts handles the routing — the rest of the code doesn't care which model is running. I also built in a GPT-4.1-mini fallback specifically for document extraction — if the primary model fails or returns invalid JSON, it retries once with GPT before giving up.

[Point to Upstash Redis.]

Redis handles two things — conversation history caching and rate limiting. Every time the chat API receives a message, it checks Redis first before touching Supabase. Conversation history is the most frequently read piece of data in this system, and caching it saves a database round-trip on every single message. The rate limiter runs a sliding window of 20 requests per minute per IP to prevent abuse and runaway API costs.

[Point to the email block.]

Email notifications go through Resend. I actually had to use two separate Resend accounts here — one registered to the personal email for customer notifications, one registered to the broker email for broker notifications. This was the cleanest solution on Resend's free tier, which only allows you to send to the email address you signed up with. Each account's restriction becomes an asset — the broker account can only send to the broker, which is exactly what we want.

[Switch to Tab 5 — ERD diagram]

The data model has five tables. Leads is the central entity — one row per customer session. Conversations stores every message in every chat. Documents and extracted_data handle the PDF pipeline. And analyses stores the AI-generated output.

[Point to the self-join on leads.]

One thing worth calling out — there's a self-join on the leads table via parent_lead_id. This enables follow-up sessions. When a returning customer starts a new chat, it creates a new lead row that points back to the original. Their profile syncs automatically across both sessions.

[Point to ticket_number.]

Every lead also gets a human-readable ticket number — #0001, #0002 — assigned automatically by a PostgreSQL trigger on insert. So the broker can say "I'm looking at ticket 17" in a call without needing to reference a UUID.

[Switch to Tab 6 — lead flow diagram]

And this is the full sequence from customer opening the chat to broker receiving a notification. I'll walk through all of this live now.

---

## SEGMENT 3 — CUSTOMER CHAT FLOW (3:30 – 7:00)
[Switch to Tab 2 — customer chat portal. Make sure you're logged in as shubhanmehrotra@gmail.com]

So this is what the customer sees when they log in. A clean, full-screen chat interface. The persona here is Aria — a friendly insurance advisor at SecureLife. I want to show you a few specific things about how this works under the hood as we go through it.

[Type and send: "Hi, I'm looking for health insurance for my family"]

The first thing to notice is that Aria acknowledges what the customer said before asking for anything. The prompt explicitly instructs her to never lead with a data collection question — she has to respond to the customer's stated need first. That makes the conversation feel natural rather than like filling out a form.

[Wait for Aria's response, then provide a phone number when asked.]

[When the occupation question comes up with the CHOICES widget visible — pause and point to it]

This is one of the things I'm quite happy with in the UX. Instead of asking "what do you do for work?" and getting a free-text answer that's hard to standardise — like "I'm a software guy" or "work at a hospital" — Aria presents a structured choice list. Twelve occupation categories. The customer clicks one button and we get clean, consistent data in the database every time.

[Select "Doctor / Healthcare"]

Now here's what's happening in the background simultaneously. The moment that message is sent, there are two parallel extraction paths running. One is a regex engine that scans the message immediately — before the AI even responds — and extracts anything it can recognise: phone numbers, age, income labels, known occupation strings. The second path is the AI itself, which appends a structured JSON block called LEAD_DATA to every reply once it has collected any field. Both paths update the lead record — the regex path is instant, the AI path fills in more context. They're complementary.

[When income CHOICES appear]

Income brackets — same idea. Nine categories from under three lakhs to above one crore. And this is where it gets interesting — when the customer picks "₹20 to 35 lakhs", the system doesn't store that string. It converts it to a numeric midpoint — 2,750,000 rupees — so the data is immediately usable for scoring, analysis, and filtering without any downstream parsing.

[Select "₹20–35 lakhs"]

[When the age NUMBER_INPUT widget appears]

For numeric fields — age and family size — there's a number input widget with a stepper. Again, the goal is the same: get clean, typed data rather than free text. No chance of getting "early thirties" in an age field.

[Set age to 31, submit. Then set family size to 3 when it appears.]

[When insurance MULTI_CHOICES appear]

Multi-select for insurance interests. This populates the concerns array on the lead — and unlike primary_concern which is a single value for backward compatibility, this captures everything the customer cares about.

[Select Health Insurance and Life Insurance]

[Continue the conversation until Aria wraps up and says a specialist will be in touch]

Right — so the conversation is done. Now let me show you what just happened automatically in the background.

[Switch to Tab 3 — broker Gmail (teamedge)]

The broker received this email without any manual action. The moment Aria detected a phone number and at least one concern in the conversation, the API route set the lead status to qualified and immediately called the notification function. This email shows the ticket number, the full profile Aria collected — name, phone, age, occupation, income, family size, interests — and a direct link to open the lead in the CRM.

[Point to the "Open lead →" button in the email]

The broker can go straight from their inbox into the lead detail. No hunting through a dashboard.

---

## SEGMENT 4 — BROKER DASHBOARD REALTIME (7:00 – 8:30)
[Switch to Tab 1 — broker dashboard]

And here on the broker dashboard — that same lead is already sitting in the Qualified column. It appeared the moment the status changed. Supabase Realtime pushed the postgres_changes event over a websocket connection. The frontend is subscribed to INSERT and UPDATE events on the leads table and updates the kanban state in memory — no re-fetch, no polling.

[Click into the new lead card]

This is the lead detail view. Let me walk through the right panel first.

[Point to the insurance interests chips]

Concerns come through as colour-coded chips — health and life in this case. Much easier to scan than reading a comma-separated string.

[Point to the financial profile section]

Income is displayed in short form — ₹28L/yr — converted from the raw number. Occupation, age, family size all pulled from what Aria captured.

[Point to the broker notes section]

This section is editable inline. The broker doesn't need to go to a separate form. They click the pencil, type, and save — it's a PATCH to the leads API that updates the notes field.

[Click the pencil, type: "Doctor with high income — no health cover. Sole earner. Call before Thursday." — click Save]

---

## SEGMENT 5 — STATUS CHANGE AND CUSTOMER EMAIL (8:30 – 9:30)
[Still on lead detail — find the status control]

When the broker is ready to ask for documents, they move the lead to Awaiting Docs. This is a manual step — the broker decides when they've had enough of a conversation and want to see the customer's existing policies.

[Change status to "Awaiting Docs"]

And that status change triggers a customer notification automatically — the API route checks whether the status transition is from qualified to awaiting_docs and fires the email.

[Switch to Tab 2 — customer Gmail (shubhanmehrotra@gmail.com)]

The customer receives this email asking them to upload their existing policy documents. It's personalised — uses their first name — and the button takes them straight back to their chat portal.

[Point to the email content]

The copy here is deliberately warm — "our advisor team would love to review your existing policy documents". This is a customer-facing email so the tone is different from the broker notifications.

---

## SEGMENT 6 — PDF UPLOAD AND EXTRACTION (9:30 – 11:30)
[Switch to Tab 1 — broker dashboard, go to the lead detail, Documents tab]

Back on the broker view — the documents tab shows the upload zone. I'm going to upload two sample insurance policy PDFs now.

[Upload samples/lic-tech-term-plan.pdf]

This is an LIC Tech Term plan. When this file lands on the API route, a few things happen. First, pdf-parse extracts the raw text — this is a pure Node.js library, no external service, which matters because Vercel's serverless functions can't shell out to system commands. Then that raw text goes to the AI with a strict extraction prompt. The prompt includes the full JSON schema and explicit instructions: use null for any field not in the document, never guess, never hallucinate values.

[Show the extracted fields appearing]

Policy number, policy type — life — provider LIC of India. Sum insured one crore fifty lakhs. Annual premium seventeen thousand four hundred and twelve rupees. Coverage dates, renewal date. Exclusions — suicide clause, hazardous activities.

[Point to raw_fields section if visible]

The full extraction JSON is also stored in raw_fields — a jsonb column — alongside the structured columns. That means if we later want to add a new field to the extraction schema, we can backfill it from the raw JSON without re-running the AI on every document.

[Upload samples/star-health-family-floater.pdf]

Second document — a Star Health family floater covering three members.

[Show extracted fields]

Health policy, sum insured ten lakhs, annual premium twenty-six thousand. Three family members. And here — pre-existing condition: hypertension, with a thirty-six month waiting period. That's a really important piece of information for the analysis.

---

## SEGMENT 7 — AI GAP ANALYSIS (11:30 – 13:30)
[Click Generate Analysis button]

Now for the analysis. The AI persona here is different — this is Arjun Kapoor, a senior insurance consultant with twenty-four years of experience. The system prompt establishes his background — IRDA certified, chartered insurance practitioner, has personally advised over two thousand five hundred Indian families. The analysis is written for junior brokers who will call the client within twenty-four hours. So the tone is blunt and specific — not marketing copy.

[While it loads — keep talking]

The prompt runs through seven sections. Life stage assessment — is this person early career, prime earning, pre-retirement, or near-retirement? Human Life Value calculation — the recommended life cover is fifteen to twenty times annual income for someone with dependants. Health adequacy against Indian benchmarks — ten lakhs minimum for an individual, twenty lakhs for a family floater in a metro city. Protection gaps — things like critical illness cover and personal accident that most people don't think about. Existing coverage review from the documents we just uploaded. Tax optimisation — Section 80C for life premiums, 80D for health premiums. And premium affordability — total premiums should be three to six percent of income, never more than ten.

[Analysis appears — walk through it]

[Point to coverage gaps]

Coverage gaps — the HLV at this income level recommends four to five crore of life cover. The existing LIC term plan is only one and a half crore. There's a gap of at least two and a half crore. And there's no health insurance at all despite employer group cover — group cover lapses the moment you change jobs, which at a doctor's career stage is a real risk.

[Point to risk flags]

Risk flags — this is where the pre-existing hypertension condition matters. The Star Health policy has a thirty-six month waiting period for pre-existing conditions. That means if this person needs hospitalisation for anything hypertension-related before mid-2027, the policy won't pay. The analysis flags that as a critical risk.

[Point to potential savings]

Potential savings — the Section 80D limit hasn't been utilised. At this income and tax bracket, the health premium is fully deductible — that's roughly eight thousand rupees a year in actual tax saving.

[Point to recommendation]

And the recommendation — specific product types with rupee amounts. Pure term top-up to three crore. Standalone critical illness plan, twenty-five to fifty lakhs. Super top-up health cover as a cost-effective way to increase the health sum insured.

[Point to confidence score and priority]

Priority is high. Confidence is seventy-eight percent — not a hundred, and here's why. The income figure, the occupation, the family size — those are all STATED. The customer told Aria. They haven't been verified against any document. The policy details from the two PDFs are VERIFIED — the AI actually read those. That distinction is built into the prompt as a discipline. It tells the broker: trust the policy details, probe on the financial profile.

[Switch to Tab 3 — broker Gmail]

And a third email to the broker — analysis ready, with the priority level and a preview of the recommendation. The broker can read the headline in their inbox and decide whether to call immediately or schedule it.

---

## SEGMENT 8 — FOLLOW-UP SESSIONS (13:30 – 14:00)
[Switch to Tab 2 — customer chat portal]

One more feature worth showing. If a returning customer logs back in — maybe they have a question after the initial consultation — they can start a follow-up session.

[Show the session history and start a follow-up]

The follow-up chat has a completely different persona mode. It knows this person's name and their existing enquiry. Instead of collecting information, it focuses on answering questions. And if the customer mentions something new — a new concern, an updated income — the system propagates that information backwards to their original session via a cross-session sync function. So the broker's view always has the most up-to-date profile regardless of which session the customer last interacted with.

---

## SEGMENT 9 — PIPELINE VIEW AND TOOLS (14:00 – 14:45)
[Back to broker dashboard — show the full pipeline]

The full pipeline with all the seed data loaded. Seven leads across every stage — you can see the whole lifecycle at once.

[Scroll across the columns]

Each card shows the ticket number, the customer's name, their score, and their concern chips. The score is computed from field completeness — a lead with name, phone, email, age, income, family size, concerns, and location filled in scores around eighty. Missing fields drag it down.

[Briefly open VS Code — show lib/prompts.ts]

One thing I want to show quickly — all the AI prompts live in a single file. The Aria chatbot persona, the Arjun Kapoor analysis persona, the document extraction schema, the follow-up session prompt. None of them are inline in the route handlers. This makes them easy to audit, version-control, and iterate on without touching any business logic.

[Briefly show lib/notifications.ts]

And the email templates — all four notification functions in one file. The template functions — wrap, pill, cta, field — are shared so every email has a consistent dark-branded look without duplicating HTML.

[Show the scripts/loops/ folder briefly]

Finally — local automation. There are two Claude Code loop files. One runs the test suite every thirty minutes and reports failures. The other checks for a .docs-pending flag that the post-commit hook writes whenever source files change, and if it finds it, regenerates all the Mermaid diagrams and the architecture doc automatically. So the documentation stays in sync with the code without any manual effort.

---

## SEGMENT 10 — WRAP-UP (14:45 – 15:00)
[Back to broker dashboard — final wide shot]

So to bring it all together — what's been built and shipped is a complete insurance lead management pipeline. A customer starts a conversation, gets qualified automatically, the broker is notified, documents are requested and extracted, an AI analysis is generated with specific Indian insurance recommendations, and the broker has everything they need to make a call.

The stack is Next.js 16 on Vercel, Supabase for the database and realtime, Groq as the default free AI provider with Claude as a production upgrade, Upstash Redis for caching and rate limiting, and Resend for email. Fifty-one unit tests with a pre-commit hook that enforces them before every commit. Full architecture, data model, AI strategy, and edge case documentation in the repo.

Thanks for watching.

---

## YOUR CHEAT SHEET — THINGS THAT HAPPEN AUTOMATICALLY
[Keep this visible on your second monitor while recording — never mention it on camera]

| You do this | System does this automatically |
|-------------|-------------------------------|
| Customer gives phone + any concern in chat | Lead → qualified, broker email fires to teamedge |
| Broker moves lead to Awaiting Docs | Customer email fires |
| PDF uploaded | Extraction runs, fields saved, document status → extracted |
| Broker clicks Generate Analysis | Analysis saved, broker email fires |

## CREDENTIALS
[Do not show on camera]

| Role | Login | Password |
|------|-------|----------|
| Broker | shubhanmehrotra.teamedge@gmail.com | Broker123! |
| Customer | shubhanmehrotra@gmail.com | your Google password |
