-- Add multi-concern support to existing leads table
-- Run this in Supabase SQL Editor if the DB was created from the original schema.sql

ALTER TABLE leads ADD COLUMN IF NOT EXISTS concerns text[] DEFAULT '{}';

-- Backfill: copy existing primary_concern into the concerns array
UPDATE leads
SET concerns = ARRAY[primary_concern]
WHERE primary_concern IS NOT NULL
  AND (concerns IS NULL OR array_length(concerns, 1) IS NULL);
