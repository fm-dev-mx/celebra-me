-- Corrective migration: security hardening for SECURITY DEFINER functions.
--
-- Several functions declared with SECURITY DEFINER lack SET search_path,
-- exposing them to schema-injection attacks. This migration adds search_path
-- bounds without changing function behaviour.
--
-- Also marks deprecated functions with a comment for documentation.
--
-- SAFETY: CREATE OR REPLACE is used throughout. No DROP, no rename, no
-- column change. This migration can be applied against any environment
-- that has run migrations 1 through 36.

begin;

-- ============================================================================
-- 1. is_admin_user — used by RLS policies
-- ============================================================================
create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from public.app_user_roles
    where user_id = auth.uid()
    and role = 'super_admin'
  );
$$;

comment on function public.is_admin_user is
  'Returns true when the current auth user has a super_admin role. Used by RLS policies.';

-- ============================================================================
-- 2. sync_user_role_to_metadata — trigger on app_user_roles
-- ============================================================================
create or replace function public.sync_user_role_to_metadata()
returns trigger
security definer
set search_path = 'public'
as $$
begin
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', new.role)
  where id = new.user_id;
  return new;
end;
$$ language plpgsql;

comment on function public.sync_user_role_to_metadata is
  'Trigger: copies app_user_roles.role into auth.users.raw_app_meta_data for JWT claims.';

-- ============================================================================
-- 3. soft_delete_event — deprecated (use archive_invitation instead)
--    Kept for compatibility; only search_path is hardened.
-- ============================================================================
create or replace function public.soft_delete_event(
    p_event_id uuid,
    p_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare
    v_existing public.events%rowtype;
    v_is_owner boolean;
    v_is_admin boolean;
begin
    select * into v_existing
    from public.events
    where id = p_event_id and deleted_at is null;

    if not found then
        return false;
    end if;

    v_is_owner := v_existing.owner_user_id = p_user_id;

    select exists(
        select 1 from public.app_user_roles
        where user_id = p_user_id and role = 'super_admin'
    ) into v_is_admin;

    if not (v_is_owner or v_is_admin) then
        return false;
    end if;

    update public.events
    set deleted_at = now(), updated_at = now()
    where id = p_event_id;

    update public.guest_invitations
    set deleted_at = now()
    where event_id = p_event_id and deleted_at is null;

    update public.event_memberships
    set deleted_at = now()
    where event_id = p_event_id and deleted_at is null;

    update public.event_claim_codes
    set deleted_at = now()
    where event_id = p_event_id and deleted_at is null;

    insert into public.audit_logs (actor_id, action, target_table, target_id, old_data)
    values (p_user_id, 'soft_delete_event', 'events', p_event_id, to_jsonb(v_existing));

    return true;
end;
$$;

comment on function public.soft_delete_event is
  '[DEPRECATED] Use archive_invitation instead. Soft-deletes an event and relations.';

-- ============================================================================
-- 4. restore_event — deprecated (use restore_invitation instead)
--    Kept for compatibility; only search_path is hardened.
-- ============================================================================
create or replace function public.restore_event(
    p_event_id uuid,
    p_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare
    v_is_admin boolean;
begin
    select exists(
        select 1 from public.app_user_roles
        where user_id = p_user_id and role = 'super_admin'
    ) into v_is_admin;

    if not v_is_admin then
        return false;
    end if;

    update public.events
    set deleted_at = null, updated_at = now()
    where id = p_event_id and deleted_at is not null;

    if not found then
        return false;
    end if;

    update public.guest_invitations
    set deleted_at = null
    where event_id = p_event_id and deleted_at is not null;

    update public.event_memberships
    set deleted_at = null
    where event_id = p_event_id and deleted_at is not null;

    update public.event_claim_codes
    set deleted_at = null
    where event_id = p_event_id and deleted_at is not null;

    insert into public.audit_logs (actor_id, action, target_table, target_id, new_data)
    values (p_user_id, 'restore_event', 'events', p_event_id, jsonb_build_object('restored_at', now()));

    return true;
end;
$$;

comment on function public.restore_event is
  '[DEPRECATED] Use restore_invitation instead. Restores a soft-deleted event and relations.';

-- ============================================================================
-- 5. upsert_guests_v1 — actively used by bulk import and public RSVP
--    Hardens search_path only; behaviour is identical to the final version
--    from migration 20260524000000_soft_delete_unique_constraint.sql.
-- ============================================================================
create or replace function public.upsert_guests_v1(
  p_event_id uuid,
  p_guests jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_guest jsonb;
  v_row_index int;
  v_count_created int := 0;
  v_count_conflicts int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_inserted_id uuid;
begin
  for v_guest, v_row_index in
    select value, ordinality::int
    from jsonb_array_elements(p_guests) with ordinality as t(value, ordinality)
  loop
    v_inserted_id := null;

    if (v_guest->>'phone') is null or (v_guest->>'phone') = '' then
      insert into public.guest_invitations (
        event_id,
        full_name,
        phone,
        country_code,
        email,
        tags,
        max_allowed_attendees,
        metadata
      )
      values (
        p_event_id,
        v_guest->>'full_name',
        null,
        null,
        v_guest->>'email',
        array(select jsonb_array_elements_text(coalesce(v_guest->'tags', '[]'::jsonb))),
        coalesce((v_guest->>'max_allowed_attendees')::int, 2),
        jsonb_build_object('needs_review', true, 'import_source', 'bulk')
      )
      returning id into v_inserted_id;

      v_count_created := v_count_created + 1;
    else
      insert into public.guest_invitations (
        event_id,
        full_name,
        phone,
        country_code,
        email,
        tags,
        max_allowed_attendees
      )
      values (
        p_event_id,
        v_guest->>'full_name',
        v_guest->>'phone',
        v_guest->>'country_code',
        v_guest->>'email',
        array(select jsonb_array_elements_text(coalesce(v_guest->'tags', '[]'::jsonb))),
        coalesce((v_guest->>'max_allowed_attendees')::int, 2)
      )
      on conflict (event_id, country_code, phone) where deleted_at is null
      do nothing
      returning id into v_inserted_id;

      if v_inserted_id is null then
        v_count_conflicts := v_count_conflicts + 1;
        v_errors := v_errors || jsonb_build_array(
          format('Fila %s: el teléfono ya existe para este evento. Usa "Actualizar existente" para modificar ese invitado.', v_row_index)
        );
      else
        v_count_created := v_count_created + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'created', v_count_created,
    'updated', 0,
    'skipped', 0,
    'conflicts', v_count_conflicts,
    'errors', v_errors,
    'status', case
      when v_count_conflicts > 0 or jsonb_array_length(v_errors) > 0 then 'partial'
      else 'success'
    end
  );
end;
$$;

comment on function public.upsert_guests_v1 is
  'Bulk creates guests for an event. Create-only: duplicates by (event_id, country_code, phone) are reported as conflicts. Rows without a phone are always inserted.';

-- ============================================================================
-- 6. Revoke execute on deprecated functions from public roles as a safety
--    measure. The grant to service_role remains.
-- ============================================================================
revoke execute on function public.soft_delete_event from public, anon, authenticated;
grant execute on function public.soft_delete_event to service_role;

revoke execute on function public.restore_event from public, anon, authenticated;
grant execute on function public.restore_event to service_role;

-- ============================================================================
-- 7. Harden remaining SECURITY DEFINER functions that were defined in
--    migrations 4 and 9 before search_path was required.
--    Using ALTER FUNCTION to avoid replacing the function body.
-- ============================================================================

alter function public.backfill_guest_invitations_from_legacy()
  set search_path = 'public';

comment on function public.backfill_guest_invitations_from_legacy is
  '[DEPRECATED] One-time backfill helper from legacy RSVP storage.';

alter function public.redeem_claim_code(uuid, text)
  set search_path = 'public';

commit;
