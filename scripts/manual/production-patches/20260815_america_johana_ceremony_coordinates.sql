-- @script-id: 20260815_america_johana_ceremony_coordinates
-- @purpose: Align America Johana ceremony coordinates with the Coyoacán Rectoría place already linked by googleMapsUrl
-- @env: production
-- @ticket: operator-note: america-johana ceremony map pin was ~570m west of Av. División del Nte. 3430
-- @tables: public.published_invitation_content, public.invitation_content_drafts
-- @operation: update
-- @expected-rows-min: 1
-- @expected-rows-max: 2
-- @requires-backup: true
-- @catalog: historical
-- @paired-stores: published,draft
-- @pair-key: slug
-- @dry-run-query: select 'published' as store, i.slug from public.invitations i join public.published_invitation_content p on p.invitation_project_id = i.id where i.slug = 'america-johana' and i.event_type = 'xv' and i.archived_at is null and p.deleted_at is null and (p.content#>>'{location,ceremony,coordinates,lat}' is distinct from '19.2759461' or p.content#>>'{location,ceremony,coordinates,lng}' is distinct from '-99.5176924') union all select 'draft' as store, i.slug from public.invitation_content_drafts d join public.invitations i on i.id = d.invitation_project_id where i.slug = 'america-johana' and i.event_type = 'xv' and i.archived_at is null and d.deleted_at is null and (d.content#>>'{location,ceremony,coordinates,lat}' is distinct from '19.2759461' or d.content#>>'{location,ceremony,coordinates,lng}' is distinct from '-99.5176924')
-- @rollback: restore public.published_invitation_content and matching invitation_content_drafts for america-johana from the pre-apply Production backup

begin;

do $$
declare
  published_count int;
  draft_count int;
  published_maps_url text;
  draft_maps_url text;
  expected_maps_url constant text := 'https://maps.app.goo.gl/ViMYiHRgQ5HLaqGe8';
begin
  select count(*) into published_count
  from public.invitations i
  join public.published_invitation_content p on p.invitation_project_id = i.id
  where i.slug = 'america-johana'
    and i.event_type = 'xv'
    and i.archived_at is null
    and p.deleted_at is null;

  if published_count <> 1 then
    raise exception 'AMERICA_COORDINATES_ABORT: america-johana has % active published rows', published_count;
  end if;

  select count(*) into draft_count
  from public.invitations i
  join public.invitation_content_drafts d on d.invitation_project_id = i.id
  where i.slug = 'america-johana'
    and i.event_type = 'xv'
    and i.archived_at is null
    and d.deleted_at is null;

  if draft_count > 1 then
    raise exception 'AMERICA_COORDINATES_ABORT: america-johana has % active draft rows', draft_count;
  end if;

  select p.content#>>'{location,ceremony,googleMapsUrl}' into published_maps_url
  from public.invitations i
  join public.published_invitation_content p on p.invitation_project_id = i.id
  where i.slug = 'america-johana'
    and i.event_type = 'xv'
    and i.archived_at is null
    and p.deleted_at is null;

  if published_maps_url is distinct from expected_maps_url then
    raise exception 'AMERICA_COORDINATES_ABORT: america-johana published googleMapsUrl does not match the approved Rectoría';
  end if;

  if draft_count = 1 then
    select d.content#>>'{location,ceremony,googleMapsUrl}' into draft_maps_url
    from public.invitations i
    join public.invitation_content_drafts d on d.invitation_project_id = i.id
    where i.slug = 'america-johana'
      and i.event_type = 'xv'
      and i.archived_at is null
      and d.deleted_at is null;

    if draft_maps_url is distinct from expected_maps_url then
      raise exception 'AMERICA_COORDINATES_ABORT: america-johana draft googleMapsUrl does not match the approved Rectoría';
    end if;
  end if;
end $$;

update public.published_invitation_content p
set content = p.content
  || jsonb_build_object(
       'location',
       coalesce(p.content->'location', '{}'::jsonb)
         || jsonb_build_object(
              'ceremony',
              coalesce(p.content#>'{location,ceremony}', '{}'::jsonb)
                || jsonb_build_object(
                     'coordinates',
                     coalesce(p.content#>'{location,ceremony,coordinates}', '{}'::jsonb)
                       || '{"lat": 19.2759461, "lng": -99.5176924}'::jsonb
                   )
            )
     ),
  version = p.version + 1,
  published_at = now()
from public.invitations i
where p.invitation_project_id = i.id
  and i.slug = 'america-johana'
  and i.event_type = 'xv'
  and i.archived_at is null
  and p.deleted_at is null
  and (
    p.content#>>'{location,ceremony,coordinates,lat}' is distinct from '19.2759461'
    or p.content#>>'{location,ceremony,coordinates,lng}' is distinct from '-99.5176924'
  );

update public.invitation_content_drafts d
set content = d.content
  || jsonb_build_object(
       'location',
       coalesce(d.content->'location', '{}'::jsonb)
         || jsonb_build_object(
              'ceremony',
              coalesce(d.content#>'{location,ceremony}', '{}'::jsonb)
                || jsonb_build_object(
                     'coordinates',
                     coalesce(d.content#>'{location,ceremony,coordinates}', '{}'::jsonb)
                       || '{"lat": 19.2759461, "lng": -99.5176924}'::jsonb
                   )
            )
     ),
  updated_at = now()
from public.invitations i
where d.invitation_project_id = i.id
  and i.slug = 'america-johana'
  and i.event_type = 'xv'
  and i.archived_at is null
  and d.deleted_at is null
  and (
    d.content#>>'{location,ceremony,coordinates,lat}' is distinct from '19.2759461'
    or d.content#>>'{location,ceremony,coordinates,lng}' is distinct from '-99.5176924'
  );

commit;
