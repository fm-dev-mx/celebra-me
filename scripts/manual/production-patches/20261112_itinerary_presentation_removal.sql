-- @script-id: 20261112_itinerary_presentation_removal
-- @purpose: Remove the non-schema itinerary.presentation key that 20260812_p0_itinerary_gallery_structural_contracts added; the strict itinerary schema rejects it and the four invitations answer 404.
-- @env: production
-- @ticket: release-v0.70.0-itinerary-presentation-incident
-- @tables: public.published_invitation_content, public.invitation_content_drafts
-- @operation: update
-- @expected-rows-min: 4
-- @expected-rows-max: 8
-- @requires-backup: true
-- @catalog: historical
-- @paired-stores: published,draft
-- @pair-key: slug
-- @dry-run-query: select 'published' as store, i.slug, p.version from public.invitations i join public.published_invitation_content p on p.invitation_project_id = i.id where i.archived_at is null and p.deleted_at is null and i.event_type = 'xv' and i.slug in ('xareni-iyarit','america-johana','ana-sofia-cota-guillen','abril-michelle-becerra-rea') and p.content->'itinerary' ? 'presentation' union all select 'draft' as store, i.slug, null::integer as version from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id = i.id where i.archived_at is null and d.deleted_at is null and i.event_type = 'xv' and i.slug in ('xareni-iyarit','america-johana','ana-sofia-cota-guillen','abril-michelle-becerra-rea') and d.content->'itinerary' ? 'presentation'
-- @rollback: restore public.published_invitation_content and matching invitation_content_drafts for slugs xareni-iyarit, america-johana, ana-sofia-cota-guillen, and abril-michelle-becerra-rea from the pre-apply Production backup

begin;

do $$
declare
  expected text[] := array['xareni-iyarit','america-johana','ana-sofia-cota-guillen','abril-michelle-becerra-rea'];
  expected_slug text;
  published_count int;
  itinerary_variant text;
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
      raise exception 'ITINERARY_PRESENTATION_ABORT: % has % active published rows', expected_slug, published_count;
    end if;

    select p.content#>>'{itinerary,variant}'
    into itinerary_variant
    from public.invitations i
    join public.published_invitation_content p on p.invitation_project_id = i.id
    where i.slug = expected_slug
      and i.event_type = 'xv'
      and i.archived_at is null
      and p.deleted_at is null;

    if itinerary_variant is distinct from 'timeline-paper' then
      raise exception 'ITINERARY_PRESENTATION_ABORT: % itinerary.variant=% is not timeline-paper', expected_slug, itinerary_variant;
    end if;
  end loop;
end $$;

update public.published_invitation_content p
set
  content = p.content #- '{itinerary,presentation}',
  version = p.version + 1,
  published_at = now()
from public.invitations i
where p.invitation_project_id = i.id
  and i.archived_at is null
  and p.deleted_at is null
  and i.event_type = 'xv'
  and i.slug in ('xareni-iyarit', 'america-johana', 'ana-sofia-cota-guillen', 'abril-michelle-becerra-rea')
  and p.content->'itinerary' ? 'presentation';

update public.invitation_content_drafts d
set
  content = d.content #- '{itinerary,presentation}',
  updated_at = now()
from public.invitations i
where d.invitation_project_id = i.id
  and i.archived_at is null
  and d.deleted_at is null
  and i.event_type = 'xv'
  and i.slug in ('xareni-iyarit', 'america-johana', 'ana-sofia-cota-guillen', 'abril-michelle-becerra-rea')
  and d.content->'itinerary' ? 'presentation';

commit;
