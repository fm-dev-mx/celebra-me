-- Migration: Add country_code column, migrate phone to 10-digit national format
-- Path: supabase/migrations/20260523000001_add_country_code.sql
--
-- Stores phone as the normalized 10-digit national number and country_code separately.
-- Composes full international numbers only at usage boundaries (WhatsApp links).
--
-- Migration strategy:
--   1. Add country_code column with CHECK constraint
--   2. Split existing E.164 phone values into country_code + 10-digit phone
--   3. Add phone CHECK constraint
--   4. Update upsert_guests_v1 RPC to accept country_code

begin;

-- 1. Add country_code column
alter table public.guest_invitations
  add column country_code text;

alter table public.guest_invitations
  add constraint guest_invitations_country_code_check
  check (country_code is null or country_code ~ '^\+[0-9]{1,4}$');

-- 2. Migrate existing phone values from E.164 (+52XXXXXXXXXX) to 10-digit + country_code
--    Known prefixes: +52 (3 chars), +34 (3 chars), +1 (2 chars)
--    Any value that cannot be cleanly split is set to null (no meaningful records to preserve).
update public.guest_invitations
set
  country_code = case
    when phone like '+52%' then '+52'
    when phone like '+34%' then '+34'
    when phone like '+1%'  then '+1'
    else null
  end,
  phone = case
    when phone like '+52%' then substring(phone, 4)
    when phone like '+34%' then substring(phone, 4)
    when phone like '+1%'  then substring(phone, 3)
    when phone ~ '^\d{10}$' then phone
    else null
  end
where phone is not null;

-- 3. Add phone CHECK constraint
alter table public.guest_invitations
  add constraint guest_invitations_phone_check
  check (phone is null or phone ~ '^[0-9]{10}$');

-- 4. Update upsert_guests_v1 RPC to accept country_code
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
      on conflict (event_id, phone)
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
