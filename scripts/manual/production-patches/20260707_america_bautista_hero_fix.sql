-- @script-id: 20260707_america_bautista_hero_fix
-- @purpose: Fix hero.name ("América" → "América Bautista"), hero.label ("AMÉRICA · XV AÑOS" → "MIS XV AÑOS"), hero time ("—" → "8:00 P.M."), and venueName ("—" → "GRAN SALÓN DEL PRADO") in América Bautista's published invitation content, removing the need for the code-side america-bautista-hero-overrides.ts
-- @env: production
-- @tables: public.published_invitation_content
-- @operation: update
-- @expected-rows-min: 1
-- @expected-rows-max: 1
-- @requires-backup: true
-- @dry-run-query: SELECT id::text, slug, event_type, content->'hero'->>'name' AS hero_name, content->'hero'->>'label' AS hero_label, content#>'{location,reception}'->>'time' AS hero_time, content#>'{location,reception}'->>'venueName' AS hero_venueName, version FROM public.published_invitation_content WHERE slug = 'america-bautista' AND event_type = 'xv' AND deleted_at IS NULL;
-- @rollback: UPDATE public.published_invitation_content SET content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(content, '{hero,name}', '"América"'::jsonb), '{hero,label}', '"AMÉRICA · XV AÑOS"'::jsonb), '{location,reception,time}', '<original-hero-time>'::jsonb), '{location,reception,venueName}', '<original-hero-venueName>'::jsonb), version = version + 1, updated_at = now() WHERE slug = 'america-bautista' AND event_type = 'xv' AND deleted_at IS NULL;
-- NOTE: Substitute <original-hero-time> and <original-hero-venueName> with values captured from @dry-run-query output before running rollback.

begin;

-- Preflight: target row must exist
do $$
begin
  if not exists (
    select 1 from public.published_invitation_content
    where slug = 'america-bautista'
      and event_type = 'xv'
      and deleted_at is null
  ) then
    raise exception 'PUBLISHED_CONTENT_NOT_FOUND: america-bautista xv';
  end if;
end $$;

-- Verify current state (capture original time/venueName for rollback)
select
  id::text,
  slug,
  event_type,
  content->'hero'->>'name' as hero_name,
  content->'hero'->>'label' as hero_label,
  content#>'{location,reception}'->>'time' as hero_time,
  content#>'{location,reception}'->>'venueName' as hero_venueName,
  version
from public.published_invitation_content
where slug = 'america-bautista'
  and event_type = 'xv'
  and deleted_at is null;

-- Patch hero.name, hero.label, location time and venueName
update public.published_invitation_content
set
  content = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          content,
          '{hero,name}',
          '"América Bautista"'::jsonb
        ),
        '{hero,label}',
        '"MIS XV AÑOS"'::jsonb
      ),
      '{location,reception,time}',
      '"8:00 P.M."'::jsonb
    ),
    '{location,reception,venueName}',
    '"GRAN SALÓN DEL PRADO"'::jsonb
  ),
  version = version + 1,
  updated_at = now()
where slug = 'america-bautista'
  and event_type = 'xv'
  and deleted_at is null;

-- Verify final state
select
  id::text,
  slug,
  event_type,
  content->'hero'->>'name' as hero_name,
  content->'hero'->>'label' as hero_label,
  content#>'{location,reception}'->>'time' as hero_time,
  content#>'{location,reception}'->>'venueName' as hero_venueName,
  version
from public.published_invitation_content
where slug = 'america-bautista'
  and event_type = 'xv'
  and deleted_at is null;

commit;
