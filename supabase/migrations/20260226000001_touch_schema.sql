
-- Migration: Force schema cache reload for PostgREST
-- Path: supabase/migrations/20260226000001_touch_schema.sql

COMMENT ON TABLE guest_invitations IS 'Invitaciones de invitados con soporte para short_id v2';
