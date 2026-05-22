-- Migration: Make bulk guest import create-only
-- Path: supabase/migrations/20260522000001_make_bulk_guests_create_only.sql
--
-- Bulk CSV imports now route intentional updates through PATCH. This RPC must
-- never mutate an existing guest when a create row conflicts by phone.

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
        email,
        tags,
        max_allowed_attendees
      )
      values (
        p_event_id,
        v_guest->>'full_name',
        v_guest->>'phone',
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
      when v_count_conflicts > 0 or v_count_skipped > 0 or jsonb_array_length(v_errors) > 0 then 'partial'
      else 'success'
    end
  );
end;
$$;

commit;
