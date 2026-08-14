-- @script-id: 20260814_p0_abril_itinerary_residual_structural_contracts
-- @purpose: Reconcile the two LIVE residual itinerary contract rows for abril-michelle-becerra-rea after the original P0 patch was partially applied.
-- @env: production
-- @ticket: invitation-contract-render-parity-goal1-audit-residual
-- @tables: public.published_invitation_content, public.invitation_content_drafts
-- @operation: update
-- @expected-rows-min: 2
-- @expected-rows-max: 2
-- @requires-backup: true
-- @paired-stores: published,draft
-- @pair-key: slug
-- @dry-run-query: select 'published' as store, i.slug, p.version, p.content#>>'{itinerary,variant}' as itinerary_variant, p.content#>>'{itinerary,presentation,behavior}' as itinerary_behavior from public.invitations i join public.published_invitation_content p on p.invitation_project_id = i.id where i.archived_at is null and p.deleted_at is null and i.event_type = 'xv' and i.slug = 'abril-michelle-becerra-rea' and (p.content#>>'{itinerary,variant}' is distinct from 'timeline-paper' or p.content#>>'{itinerary,presentation,behavior}' is distinct from 'timeline-paper') union all select 'draft' as store, i.slug, null::integer as version, d.content#>>'{itinerary,variant}' as itinerary_variant, d.content#>>'{itinerary,presentation,behavior}' as itinerary_behavior from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id = i.id where i.archived_at is null and d.deleted_at is null and i.event_type = 'xv' and i.slug = 'abril-michelle-becerra-rea' and (d.content#>>'{itinerary,variant}' is distinct from 'timeline-paper' or d.content#>>'{itinerary,presentation,behavior}' is distinct from 'timeline-paper')
-- @rollback: restore public.published_invitation_content and matching invitation_content_drafts for abril-michelle-becerra-rea from the pre-apply Production backup

begin;

do $$
declare
  published_count int;
  draft_count int;
  published_version int;
  itinerary_variant text;
  itinerary_behavior text;
  draft_itinerary_variant text;
  draft_itinerary_behavior text;
begin
  select count(*) into published_count
  from public.invitations i
  join public.published_invitation_content p on p.invitation_project_id = i.id
  where i.slug = 'abril-michelle-becerra-rea'
    and i.event_type = 'xv'
    and i.archived_at is null
    and p.deleted_at is null;

  if published_count <> 1 then
    raise exception 'P0_RESIDUAL_CONTRACT_ABORT: abril-michelle-becerra-rea has % active published rows', published_count;
  end if;

  select count(*) into draft_count
  from public.invitations i
  join public.invitation_content_drafts d on d.invitation_project_id = i.id
  where i.slug = 'abril-michelle-becerra-rea'
    and i.event_type = 'xv'
    and i.archived_at is null
    and d.deleted_at is null;

  if draft_count <> 1 then
    raise exception 'P0_RESIDUAL_CONTRACT_ABORT: abril-michelle-becerra-rea has % active draft rows', draft_count;
  end if;

  select
    p.version,
    p.content#>>'{itinerary,variant}',
    p.content#>>'{itinerary,presentation,behavior}'
  into published_version, itinerary_variant, itinerary_behavior
  from public.invitations i
  join public.published_invitation_content p on p.invitation_project_id = i.id
  where i.slug = 'abril-michelle-becerra-rea'
    and i.event_type = 'xv'
    and i.archived_at is null
    and p.deleted_at is null;

  if published_version is null then
    raise exception 'P0_RESIDUAL_CONTRACT_ABORT: abril-michelle-becerra-rea published version is null';
  end if;

  if itinerary_variant is not null and itinerary_variant <> 'timeline-paper' then
    raise exception 'P0_RESIDUAL_CONTRACT_ABORT: abril-michelle-becerra-rea itinerary.variant=% contradicts Goal 1', itinerary_variant;
  end if;

  if itinerary_behavior is not null and itinerary_behavior <> 'timeline-paper' then
    raise exception 'P0_RESIDUAL_CONTRACT_ABORT: abril-michelle-becerra-rea itinerary.presentation.behavior=% contradicts Goal 1', itinerary_behavior;
  end if;

  select
    d.content#>>'{itinerary,variant}',
    d.content#>>'{itinerary,presentation,behavior}'
  into draft_itinerary_variant, draft_itinerary_behavior
  from public.invitations i
  join public.invitation_content_drafts d on d.invitation_project_id = i.id
  where i.slug = 'abril-michelle-becerra-rea'
    and i.event_type = 'xv'
    and i.archived_at is null
    and d.deleted_at is null;

  if draft_itinerary_variant is not null and draft_itinerary_variant <> 'timeline-paper' then
    raise exception 'P0_RESIDUAL_CONTRACT_ABORT: abril-michelle-becerra-rea draft itinerary.variant=% contradicts Goal 1', draft_itinerary_variant;
  end if;

  if draft_itinerary_behavior is not null and draft_itinerary_behavior <> 'timeline-paper' then
    raise exception 'P0_RESIDUAL_CONTRACT_ABORT: abril-michelle-becerra-rea draft itinerary.presentation.behavior=% contradicts Goal 1', draft_itinerary_behavior;
  end if;
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
