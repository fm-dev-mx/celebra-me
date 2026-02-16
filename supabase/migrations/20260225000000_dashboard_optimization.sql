-- Migración: Optimización Dashboard y Gestión de Invitados
-- Añade soporte para emails, tags y metadatos, además de una función atómica para upsert masivo.

begin;

-- 1. Extender tabla guest_invitations
alter table public.guest_invitations
add column if not exists email text,
add column if not exists tags text[] default '{}',
add column if not exists metadata jsonb default '{}';

-- 2. Crear índices para optimizar búsquedas por email y tags
create index if not exists idx_guest_invitations_email on public.guest_invitations (email);
create index if not exists idx_guest_invitations_tags on public.guest_invitations using gin (tags);

-- 3. Función RPC para Upsert Masivo
-- Esta función maneja la lógica de:
--   - Match por phone dentro de un evento.
--   - Merge de tags (no sobrescribe, añade).
--   - Marcado de "needs_review" si falta teléfono.
create or replace function public.upsert_guests_v1(
  p_event_id uuid,
  p_guests jsonb -- Array de objetos: {full_name, phone, email, tags, max_allowed_attendees}
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
    -- Caso: Sin teléfono (Requiere revisión)
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
        'PENDING_' || gen_random_uuid(), -- Placeholder único
        v_guest->>'email',
        array(select jsonb_array_elements_text(v_guest->'tags')),
        (v_guest->>'max_allowed_attendees')::int,
        jsonb_build_object('needs_review', true, 'import_source', 'bulk')
      );
      v_count_created := v_count_created + 1;

    -- Caso: Con teléfono (Upsert por phone + event_id)
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
      on conflict (event_id, phone) where (phone not like 'PENDING_%')
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

-- Nota: Para el "on conflict" necesitamos un índice único compuesto si no existe
-- Verificamos si existe el índice de unicidad para evitar duplicados en el mismo evento
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'guest_invitations_event_phone_unique'
    ) then
        alter table public.guest_invitations
        add constraint guest_invitations_event_phone_unique
        unique (event_id, phone);
    end if;
end $$;

commit;
