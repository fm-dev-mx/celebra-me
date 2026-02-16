-- Migration: Make phone nullable in guest_invitations
-- Path: supabase/migrations/20260216133000_make_phone_nullable.sql

BEGIN;

-- 1. Drop the NOT NULL constraint from the phone column
ALTER TABLE public.guest_invitations
ALTER COLUMN phone DROP NOT NULL;

-- 2. Ensure existing 'placeholder' values or empty strings from previous attempts
-- (if any exist) can be cleaned up if needed, though usually not required
-- just to fix the constraint issue.

COMMIT;
