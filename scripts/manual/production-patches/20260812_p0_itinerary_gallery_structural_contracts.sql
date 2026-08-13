-- @script-id: 20260812_p0_itinerary_gallery_structural_contracts
-- @purpose: Persist explicit itinerary timeline-paper and celestial gallery index-choreography on published P0 invitations whose theme-implied renderer was removed.
-- @env: production
-- @ticket: invitation-contract-render-parity-goal1-audit
-- @tables: public.published_invitation_content, public.invitation_content_drafts
-- @operation: update
-- @expected-rows-min: 4
-- @expected-rows-max: 8
-- @requires-backup: true
-- @dry-run-query: select 'published' as store, i.slug, p.version from public.invitations i join public.published_invitation_content p on p.invitation_project_id = i.id where i.archived_at is null and p.deleted_at is null and i.event_type = 'xv' and ((i.slug in ('xareni-iyarit','america-johana','ana-sofia-cota-guillen') and (p.content#>>'{itinerary,variant}' is distinct from 'timeline-paper' or p.content#>>'{itinerary,presentation,behavior}' is distinct from 'timeline-paper' or p.content#>>'{gallery,variant}' is distinct from 'index-choreography')) or (i.slug = 'abril-michelle-becerra-rea' and (p.content#>>'{itinerary,variant}' is distinct from 'timeline-paper' or p.content#>>'{itinerary,presentation,behavior}' is distinct from 'timeline-paper'))) union all select 'draft' as store, i.slug, d.revision from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id = i.id where i.archived_at is null and d.deleted_at is null and i.event_type = 'xv' and ((i.slug in ('xareni-iyarit','america-johana','ana-sofia-cota-guillen') and (d.content#>>'{itinerary,variant}' is distinct from 'timeline-paper' or d.content#>>'{itinerary,presentation,behavior}' is distinct from 'timeline-paper' or d.content#>>'{gallery,variant}' is distinct from 'index-choreography')) or (i.slug = 'abril-michelle-becerra-rea' and (d.content#>>'{itinerary,variant}' is distinct from 'timeline-paper' or d.content#>>'{itinerary,presentation,behavior}' is distinct from 'timeline-paper')))
-- @rollback: restore public.published_invitation_content and matching invitation_content_drafts for slugs xareni-iyarit, america-johana, ana-sofia-cota-guillen, and abril-michelle-becerra-rea from the pre-apply Production backup

begin;

do $$
declare
  expected text[] := array['xareni-iyarit','america-johana','ana-sofia-cota-guillen','abril-michelle-becerra-rea'];
  expected_slug text;
  published_count int;
  itinerary_variant text;
  itinerary_behavior text;
  gallery_variant text;
begin
  foreach expected_slug in array expected loop
    select count(*) into published_count
    from public.invitations i
    join public.published_invitation_content p on p.invitation_project_id = i.id
    where i.slug = expected_slug
      and i.event_type = 'xv'
      and i.archived_at is null
      and p.deleted_at is null;

    if published_count <> 1 then
      raise exception 'P0_CONTRACT_ABORT: % has % active published rows', expected_slug, published_count;
    end if;

    select
      p.content#>>'{itinerary,variant}',
      p.content#>>'{itinerary,presentation,behavior}',
      p.content#>>'{gallery,variant}'
    into itinerary_variant, itinerary_behavior, gallery_variant
    from public.invitations i
    join public.published_invitation_content p on p.invitation_project_id = i.id
    where i.slug = expected_slug
      and i.event_type = 'xv'
      and i.archived_at is null
      and p.deleted_at is null;

    if itinerary_variant is not null and itinerary_variant <> 'timeline-paper' then
      raise exception 'P0_CONTRACT_ABORT: % itinerary.variant=% contradicts Goal 1', expected_slug, itinerary_variant;
    end if;

    if itinerary_behavior is not null and itinerary_behavior <> 'timeline-paper' then
      raise exception 'P0_CONTRACT_ABORT: % itinerary.presentation.behavior=% contradicts Goal 1', expected_slug, itinerary_behavior;
    end if;

    if expected_slug <> 'abril-michelle-becerra-rea'
       and gallery_variant is not null
       and gallery_variant <> 'index-choreography' then
      raise exception 'P0_CONTRACT_ABORT: % gallery.variant=% contradicts Goal 1', expected_slug, gallery_variant;
    end if;
  end loop;
end $$;

update public.published_invitation_content p
set
  content = p.content
    || jsonb_build_object(
         'itinerary',
         coalesce(p.content->'itinerary', '{}'::jsonb)
           || jsonb_build_object('variant', 'timeline-paper')
           || jsonb_build_object(
                'presentation',
                coalesce(p.content#>'{itinerary,presentation}', '{}'::jsonb)
                  || jsonb_build_object('behavior', 'timeline-paper')
              )
       )
    || jsonb_build_object(
         'gallery',
         coalesce(p.content->'gallery', '{}'::jsonb)
           || jsonb_build_object('variant', 'index-choreography')
       ),
  version = p.version + 1,
  published_at = now()
from public.invitations i
where p.invitation_project_id = i.id
  and i.archived_at is null
  and p.deleted_at is null
  and i.event_type = 'xv'
  and i.slug in ('xareni-iyarit', 'america-johana', 'ana-sofia-cota-guillen')
  and (
    p.content#>>'{itinerary,variant}' is distinct from 'timeline-paper'
    or p.content#>>'{itinerary,presentation,behavior}' is distinct from 'timeline-paper'
    or p.content#>>'{gallery,variant}' is distinct from 'index-choreography'
  );

update public.published_invitation_content p
set
  content = p.content
    || jsonb_build_object(
         'itinerary',
         coalesce(p.content->'itinerary', '{}'::jsonb)
           || jsonb_build_object('variant', 'timeline-paper')
           || jsonb_build_object(
                'presentation',
                coalesce(p.content#>'{itinerary,presentation}', '{}'::jsonb)
                  || jsonb_build_object('behavior', 'timeline-paper')
              )
       ),
  version = p.version + 1,
  published_at = now()
from public.invitations i
where p.invitation_project_id = i.id
  and i.archived_at is null
  and p.deleted_at is null
  and i.event_type = 'xv'
  and i.slug = 'abril-michelle-becerra-rea'
  and (
    p.content#>>'{itinerary,variant}' is distinct from 'timeline-paper'
    or p.content#>>'{itinerary,presentation,behavior}' is distinct from 'timeline-paper'
  );

update public.invitation_content_drafts d
set
  content = d.content
    || jsonb_build_object(
         'itinerary',
         coalesce(d.content->'itinerary', '{}'::jsonb)
           || jsonb_build_object('variant', 'timeline-paper')
           || jsonb_build_object(
                'presentation',
                coalesce(d.content#>'{itinerary,presentation}', '{}'::jsonb)
                  || jsonb_build_object('behavior', 'timeline-paper')
              )
       )
    || jsonb_build_object(
         'gallery',
         coalesce(d.content->'gallery', '{}'::jsonb)
           || jsonb_build_object('variant', 'index-choreography')
       ),
  updated_at = now()
from public.invitations i
where d.invitation_project_id = i.id
  and i.archived_at is null
  and d.deleted_at is null
  and i.event_type = 'xv'
  and i.slug in ('xareni-iyarit', 'america-johana', 'ana-sofia-cota-guillen')
  and (
    d.content#>>'{itinerary,variant}' is distinct from 'timeline-paper'
    or d.content#>>'{itinerary,presentation,behavior}' is distinct from 'timeline-paper'
    or d.content#>>'{gallery,variant}' is distinct from 'index-choreography'
  );

update public.invitation_content_drafts d
set
  content = d.content
    || jsonb_build_object(
         'itinerary',
         coalesce(d.content->'itinerary', '{}'::jsonb)
           || jsonb_build_object('variant', 'timeline-paper')
           || jsonb_build_object(
                'presentation',
                coalesce(d.content#>'{itinerary,presentation}', '{}'::jsonb)
                  || jsonb_build_object('behavior', 'timeline-paper')
              )
       ),
  updated_at = now()
from public.invitations i
where d.invitation_project_id = i.id
  and i.archived_at is null
  and d.deleted_at is null
  and i.event_type = 'xv'
  and i.slug = 'abril-michelle-becerra-rea'
  and (
    d.content#>>'{itinerary,variant}' is distinct from 'timeline-paper'
    or d.content#>>'{itinerary,presentation,behavior}' is distinct from 'timeline-paper'
  );

commit;
