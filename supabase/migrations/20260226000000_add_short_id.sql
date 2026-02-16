-- Migration: Add short_id to guest_invitations for user-friendly links
-- Path: supabase/migrations/20260226000000_add_short_id.sql

BEGIN;

-- 1. Add short_id column
ALTER TABLE public.guest_invitations
ADD COLUMN IF NOT EXISTS short_id VARCHAR(12) UNIQUE;

-- 2. Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_guest_invitations_short_id ON public.guest_invitations(short_id);

-- 3. Function to generate a random short ID (Base62-like)
CREATE OR REPLACE FUNCTION public.generate_short_id(length INTEGER DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 4. Backfill existing records that don't have a short_id
-- Using a loop to ensure uniqueness during backfill if needed,
-- although 62^8 is large enough for most cases.
WITH missing_short_ids AS (
  SELECT id FROM public.guest_invitations WHERE short_id IS NULL
)
UPDATE public.guest_invitations gi
SET short_id = public.generate_short_id(8)
FROM missing_short_ids
WHERE gi.id = missing_short_ids.id;

-- 5. Add NOT NULL constraint after backfill
-- We don't make it NOT NULL immediately to allow the backfill to run smoothly
-- and to keep it flexible if we want to allow nulls temporarily during deployment.
-- ALTER TABLE public.guest_invitations ALTER COLUMN short_id SET NOT NULL;

COMMIT;
