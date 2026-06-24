-- SecureLife Insurance AI CRM — Seed Data
-- Paste and run in Supabase SQL Editor AFTER schema.sql
-- Provides 7 sample leads across all pipeline stages for demo purposes

insert into leads (name, email, phone, status, score, source, age, occupation, annual_income, family_size, existing_coverage, primary_concern, concerns, location, notes)
values

-- 1. New — just arrived, no info yet
('Rohan Sharma', 'rohan.sharma@example.com', null, 'new', 0, 'chatbot',
 null, null, null, null, null, null, null, null, null),

-- 2. Chatting — mid-conversation
('Priya Nair', 'priya.nair@example.com', null, 'chatting', 20, 'chatbot',
 28, 'Salaried – Private Sector', 850000, null, null, 'health', array['health'], 'Bengaluru', null),

-- 3. Qualified — chatbot captured full profile
('Arjun Mehta', 'arjun.mehta@example.com', '9876543210', 'qualified', 70, 'chatbot',
 34, 'Engineer / IT Professional', 1800000, 4, 'LIC term plan ₹50L',
 'life', array['life', 'health'], 'Mumbai', null),

-- 4. Awaiting docs — broker asked for policy PDFs
('Sunita Reddy', 'sunita.reddy@example.com', '9845012345', 'awaiting_docs', 65, 'chatbot',
 42, 'Doctor / Healthcare', 3500000, 3, 'Group health cover from employer',
 'health', array['health', 'retirement'], 'Hyderabad', 'High-income client — priority follow-up'),

-- 5. Processing — PDFs uploaded, extraction running
('Vikram Singh', 'vikram.singh@example.com', '9812300456', 'processing', 75, 'chatbot',
 39, 'Business Owner / Self-Employed', 5000000, 5, 'ULIP from HDFC Life, car insurance',
 'life', array['life', 'health', 'property'], 'Delhi', null),

-- 6. Completed — analysis done, broker has recommended products
('Meera Joshi', 'meera.joshi@example.com', '9900112233', 'completed', 90, 'chatbot',
 31, 'Finance / Banking / Insurance', 1400000, 2, 'Term plan ₹1 Cr, no health cover',
 'health', array['health', 'life'], 'Pune', 'Sold family floater ₹10L — follow up in 6 months'),

-- 7. Rejected — unresponsive / unqualified
('Karan Patel', 'karan.patel@example.com', '9700223344', 'rejected', 15, 'chatbot',
 22, 'Student', 0, 1, null,
 'other', array['other'], 'Ahmedabad', 'Student with no income — revisit after graduation');


-- Sample conversations for the qualified lead (Arjun Mehta)
-- Note: lead_id is resolved by subquery so this works regardless of UUID assigned
insert into conversations (lead_id, role, content)
select id, 'assistant', 'Hi! I''m Aria from SecureLife Insurance. I''m here to understand your insurance needs and help you find the right coverage. Could you start by telling me your name?'
from leads where email = 'arjun.mehta@example.com';

insert into conversations (lead_id, role, content)
select id, 'user', 'Hi, my name is Arjun Mehta'
from leads where email = 'arjun.mehta@example.com';

insert into conversations (lead_id, role, content)
select id, 'assistant', 'Great to meet you, Arjun! What brings you here today — are you looking to protect your health, life, family, or something else?'
from leads where email = 'arjun.mehta@example.com';

insert into conversations (lead_id, role, content)
select id, 'user', 'I''m mainly worried about life insurance. I have a family of 4 and I''m the sole earner.'
from leads where email = 'arjun.mehta@example.com';

insert into conversations (lead_id, role, content)
select id, 'assistant', 'That''s a really important concern — being the sole earner with dependants makes life cover essential. Could I get your phone number so we can follow up?'
from leads where email = 'arjun.mehta@example.com';

insert into conversations (lead_id, role, content)
select id, 'user', 'Sure, it''s 9876543210'
from leads where email = 'arjun.mehta@example.com';


-- Sample analysis for the completed lead (Meera Joshi)
insert into analyses (lead_id, coverage_gaps, potential_savings, risk_flags, recommendation, priority, confidence_score, raw_analysis)
select
  id,
  'No health insurance for self or spouse despite ₹1.4L annual income. Existing term plan (₹1 Cr) is below HLV of ₹2.1–2.8 Cr at current income. No critical illness or personal accident cover.',
  'Switching from any endowment/ULIP riders to a standalone term plan could save ₹15,000–25,000/yr. Section 80D not utilised — health premium of ₹15,000–20,000/yr fully deductible.',
  'Single point of failure: if primary earner is hospitalised, no income replacement cover exists. Employer group cover (if any) will lapse on job change.',
  'Priority 1: Family floater health plan ₹10L (Star Health / Niva Bupa) — annual premium ~₹18,000. Priority 2: Top-up existing term to ₹1.5 Cr. Priority 3: Personal accident cover 10x income (~₹14L).',
  'high',
  82,
  '{"life_stage":"Prime Earning","hlv_recommended":21000000,"hlv_existing":10000000,"health_recommended":1000000,"health_existing":0}'::jsonb
from leads where email = 'meera.joshi@example.com';
