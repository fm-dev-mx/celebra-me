-- Migration: Fix upsert_guests_v1 RPC -- no phone_e164, no PENDING_ placeholders
-- Path: supabase/migrations/20260521000002_fix_upsert_guests_phone_column.sql
--
-- 1. Replaces phone_e164 references with real column name phone.
-- 2. Inserts null for phone when guest has no phone (no PENDING_* placeholders).
-- 3. Removes the WHERE clause from ON CONFLICT (no PENDING_* to exclude).
-- 4. Drops the constraint guard (guest_invitations_event_phone_unique exists).
-- No schema change -- only a function replace.

begin;

create or replace function public.upsert_guests_v1(
  p_event_id uuid,
  p_guests jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_guest jsonb;
  v_count_created int := 0;
  v_count_updated int := 0;
  v_result jsonb;
begin
  for v_guest in select * from jsonb_array_elements(p_guests)
  loop
    if (v_guest->>'phone') is null or (v_guest->>'phone') = '' then
      insert into public.guest_invitations (
        event_id,
        full_name,
        phone,
        email,
        tags,
        max_allowed_attendees,
        metadata
      )
      values (
        p_event_id,
        v_guest->>'full_name',
        null,
        v_guest->>'email',
        array(select jsonb_array_elements_text(v_guest->'tags')),
        coalesce((v_guest->>'max_allowed_attendees')::int, 2),
        jsonb_build_object('needs_review', true, 'import_source', 'bulk')
      );
      v_count_created := v_count_created + 1;
    else
      insert into public.guest_invitations (
        event_id,
        full_name,
        phone,
        email,
        tags,
        max_allowed_attendees
      )
      values (
        p_event_id,
        v_guest->>'full_name',
        v_guest->>'phone',
        v_guest->>'email',
        array(select jsonb_array_elements_text(v_guest->'tags')),
        coalesce((v_guest->>'max_allowed_attendees')::int, 2)
      )
      on conflict (event_id, phone)
      do update set
        full_name = excluded.full_name,
        email = coalesce(excluded.email, guest_invitations.email),
        tags = array(select distinct unnest(guest_invitations.tags || excluded.tags)),
        updated_at = now();

      if found then
        v_count_updated := v_count_updated + 1;
      else
        v_count_created := v_count_created + 1;
      end if;
    end if;
  end loop;

  v_result := jsonb_build_object(
    'created', v_count_created,
    'updated', v_count_updated,
    'status', 'success'
  );

  return v_result;
end;
$$;

commit;

-- =============================================================================
-- Cleanup: convert existing PENDING_* placeholders to null
-- =============================================================================
-- Run this separately after deploying the new function if any rows were
-- already inserted with PENDING_* phones by the previous RPC version.
--
-- update public.guest_invitations
-- set phone = null
-- where event_id = '1b9a1ee7-8ed2-4b47-b2f0-c5e1b4a3ad36'
--   and phone like 'PENDING_%'
--   and metadata->>'import_source' = 'bulk';
