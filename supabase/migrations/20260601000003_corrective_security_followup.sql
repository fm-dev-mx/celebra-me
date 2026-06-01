-- Corrective migration: security hardening follow-up for SECURITY DEFINER functions.
--
-- Migration 37 hardened search_path via CREATE OR REPLACE and ALTER FUNCTION.
-- This migration ensures the final database state is correct:
--   1. Uses ALTER FUNCTION to harden search_path for all SECURITY DEFINER
--      functions (idempotent — no-op if already set).
--   2. Adds the missing REVOKE for upsert_guests_v1 (was not covered in 37).
--   3. Uses explicit function signatures for all privilege statements.
--
-- SAFETY: All statements are idempotent. REVOKE on already-revoked
-- privileges is a no-op. ALTER FUNCTION on an already-configured function
-- is a no-op. This migration can be applied against any environment that
-- has run migrations 1 through 37.

begin;

-- ============================================================================
-- 1. Ensure search_path = 'public' on all SECURITY DEFINER functions via
--    ALTER FUNCTION. No-op on functions already hardened by migration 37.
--    No function bodies are copied or changed.
-- ============================================================================

alter function public.is_admin_user()
  set search_path = 'public';

alter function public.sync_user_role_to_metadata()
  set search_path = 'public';

alter function public.soft_delete_event(uuid, uuid)
  set search_path = 'public';

alter function public.restore_event(uuid, uuid)
  set search_path = 'public';

alter function public.upsert_guests_v1(uuid, jsonb)
  set search_path = 'public';

-- Functions already hardened via ALTER FUNCTION in migration 37:
--   backfill_guest_invitations_from_legacy()
--   redeem_claim_code(uuid, text)

-- ============================================================================
-- 2. Explicitly revoke execute on deprecated/sensitive RPCs from public,
--    anon, and authenticated roles. Uses full function signatures for
--    clarity and to disambiguate overloaded functions.
--    This adds upsert_guests_v1 (missing from migration 37) and adds
--    explicit signatures for soft_delete_event and restore_event.
-- ============================================================================

revoke execute on function public.soft_delete_event(uuid, uuid)
  from public, anon, authenticated;

revoke execute on function public.restore_event(uuid, uuid)
  from public, anon, authenticated;

revoke execute on function public.upsert_guests_v1(uuid, jsonb)
  from public, anon, authenticated;

-- Only service_role should retain execute on these functions.
grant execute on function public.soft_delete_event(uuid, uuid) to service_role;
grant execute on function public.restore_event(uuid, uuid) to service_role;
grant execute on function public.upsert_guests_v1(uuid, jsonb) to service_role;

commit;
