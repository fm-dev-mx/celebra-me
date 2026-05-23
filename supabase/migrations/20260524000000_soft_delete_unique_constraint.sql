-- Migration: Replace all event+phone unique constraints with a single partial
-- unique index on (event_id, country_code, phone) excluding soft-deleted rows
--
-- The DB had two constraints:
--   1. guest_invitations_event_phone_unique on (event_id, phone)
--   2. guest_invitations_event_country_phone_unique on (event_id, country_code, phone)
-- The second (manually added) was the one actually enforcing uniqueness.
--
-- Fix: drop both, drop any previous partial index, create a single partial
-- unique index on the correct composite (event_id, country_code, phone)
-- that excludes soft-deleted rows.

begin;

-- 1. Drop old unique constraints (both the original and the manually-added composite)
alter table public.guest_invitations
  drop constraint if exists guest_invitations_event_phone_unique;

alter table public.guest_invitations
  drop constraint if exists guest_invitations_event_country_phone_unique;

-- 2. Drop any previously-created partial index no longer matching the model
drop index if exists public.guest_invitations_event_phone_active_unique;

-- 3. Create the correct partial unique index on (event_id, country_code, phone)
--    - country_code is part of the identity (same 10-digit phone in +52 vs +1 are different guests)
--    - Soft-deleted rows (deleted_at IS NOT NULL) are excluded
--    - This allows re-importing the same (event_id, country_code, phone) after soft-delete
--    - Rows with NULL phone are never indexed (phone is part of the key)
create unique index if not exists guest_invitations_event_country_phone_active_unique
  on public.guest_invitations(event_id, country_code, phone)
  where deleted_at is null;

-- 4. Update upsert_guests_v1 to target the correct composite partial index
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

commit;
