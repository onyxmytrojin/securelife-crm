-- SecureLife Insurance AI CRM — Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── LEADS ──────────────────────────────────────────────────────────────────
create table leads (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Contact
  name          text,
  email         text,
  phone         text,

  -- Qualification
  status        text not null default 'new'
                check (status in ('new','chatting','qualified','awaiting_docs','processing','completed','rejected')),
  score         integer default 0 check (score between 0 and 100),
  source        text default 'chatbot' check (source in ('chatbot','manual','api')),

  -- Profile (captured during chat)
  age           integer,
  occupation    text,
  annual_income numeric(12,2),
  family_size   integer,
  existing_coverage text,   -- brief freetext summary
  primary_concern   text,   -- first / most important concern (backward compat)
  concerns      text[],     -- all concerns: health, life, auto, property, loan, retirement, travel, other
  location      text,

  notes         text,

  -- Multi-session / follow-up support
  parent_lead_id uuid references leads(id) on delete set null,
  session_type   text not null default 'new_inquiry'
                 check (session_type in ('new_inquiry','follow_up')),

  -- Sequential ticket numbers (human-readable, e.g. #0003)
  ticket_number  integer unique
);

-- ─── CONVERSATIONS ──────────────────────────────────────────────────────────
create table conversations (
  id         uuid primary key default uuid_generate_v4(),
  lead_id    uuid not null references leads(id) on delete cascade,
  created_at timestamptz not null default now(),

  role       text not null check (role in ('user','assistant','system')),
  content    text not null
);

create index on conversations(lead_id, created_at);

-- ─── DOCUMENTS ──────────────────────────────────────────────────────────────
create table documents (
  id           uuid primary key default uuid_generate_v4(),
  lead_id      uuid not null references leads(id) on delete cascade,
  created_at   timestamptz not null default now(),

  filename     text not null,
  storage_path text,           -- Supabase Storage path
  file_size    integer,
  mime_type    text default 'application/pdf',
  status       text not null default 'pending'
               check (status in ('pending','processing','extracted','failed')),
  error        text
);

create index on documents(lead_id);

-- ─── EXTRACTED DATA ─────────────────────────────────────────────────────────
create table extracted_data (
  id           uuid primary key default uuid_generate_v4(),
  document_id  uuid not null references documents(id) on delete cascade,
  lead_id      uuid not null references leads(id) on delete cascade,
  created_at   timestamptz not null default now(),

  -- Policy details
  policy_number     text,
  policy_type       text,   -- life / health / auto / property
  provider_name     text,
  policyholder_name text,

  -- Coverage
  sum_insured       numeric(14,2),
  premium_amount    numeric(10,2),
  premium_frequency text,   -- monthly / quarterly / annual
  coverage_start    date,
  coverage_end      date,
  renewal_date      date,

  -- Health-specific
  pre_existing_conditions text,
  exclusions              text,
  waiting_period          text,
  claim_history           text,

  -- Raw extraction for flexibility
  raw_fields   jsonb default '{}'
);

create index on extracted_data(lead_id);
create index on extracted_data(document_id);

-- ─── ANALYSES ───────────────────────────────────────────────────────────────
create table analyses (
  id          uuid primary key default uuid_generate_v4(),
  lead_id     uuid not null references leads(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- AI output
  coverage_gaps      text,
  potential_savings  text,
  risk_flags         text,
  recommendation     text,   -- action for broker
  priority           text default 'medium' check (priority in ('low','medium','high','urgent')),
  confidence_score   integer check (confidence_score between 0 and 100),

  -- Full structured JSON from Claude
  raw_analysis   jsonb default '{}'
);

create index on analyses(lead_id);

-- ─── AUTO-UPDATE updated_at ─────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_updated_at before update on leads
  for each row execute procedure update_updated_at();

-- Ticket number sequence — auto-assign on INSERT
create sequence if not exists leads_ticket_number_seq start 1;

create or replace function assign_ticket_number()
returns trigger language plpgsql as $$
begin
  if new.ticket_number is null then
    new.ticket_number = nextval('leads_ticket_number_seq');
  end if;
  return new;
end;
$$;

create trigger leads_assign_ticket before insert on leads
  for each row execute procedure assign_ticket_number();

create trigger analyses_updated_at before update on analyses
  for each row execute procedure update_updated_at();

-- ─── ROW LEVEL SECURITY (basic) ─────────────────────────────────────────────
-- For the assessment, use service role key server-side; anon key is read-only
alter table leads enable row level security;
alter table conversations enable row level security;
alter table documents enable row level security;
alter table extracted_data enable row level security;
alter table analyses enable row level security;

-- Allow service role full access (enforced at API layer)
create policy "service role full access" on leads for all using (true);
create policy "service role full access" on conversations for all using (true);
create policy "service role full access" on documents for all using (true);
create policy "service role full access" on extracted_data for all using (true);
create policy "service role full access" on analyses for all using (true);
