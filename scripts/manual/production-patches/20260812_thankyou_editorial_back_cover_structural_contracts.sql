-- @script-id: 20260812_thankyou_editorial_back_cover_structural_contracts
-- @purpose: Persist explicit Thank You editorial-back-cover on celestial and enchanted-rose invitations whose theme-implied editorial renderer was removed.
-- @env: production
-- @ticket: invitation-contract-render-parity-goal3
-- @tables: public.published_invitation_content, public.invitation_content_drafts
-- @operation: update
-- @expected-rows-min: 5
-- @expected-rows-max: 10
-- @requires-backup: true
-- @dry-run-query: select i.event_type, i.slug, p.version, p.content#>>'{thankYou,variant}' as thank_you_variant, p.content#>>'{sectionStyles,thankYou,structuralVariant}' as styles_thank_you_structural from public.invitations i join public.published_invitation_content p on p.invitation_project_id = i.id where i.archived_at is null and p.deleted_at is null and ((i.event_type = 'xv' and i.slug in ('xareni-iyarit','america-johana','ana-sofia-cota-guillen','ayrin-samantha-lerma-castro')) or (i.event_type = 'baby-shower' and i.slug = 'leah-lexa')) order by i.event_type, i.slug
-- @rollback: restore public.published_invitation_content and matching invitation_content_drafts for slugs xareni-iyarit, america-johana, ana-sofia-cota-guillen, ayrin-samantha-lerma-castro, and leah-lexa from the pre-apply Production backup

begin;

do $$
declare
  expected_xv text[] := array['xareni-iyarit','america-johana','ana-sofia-cota-guillen','ayrin-samantha-lerma-castro'];
  slug text;
  published_count int;
  thank_you_variant text;
begin
  foreach slug in array expected_xv loop
    select count(*) into published_count
    from public.invitations i
    join public.published_invitation_content p on p.invitation_project_id = i.id
    where i.slug = slug
      and i.event_type = 'xv'
      and i.archived_at is null
      and p.deleted_at is null;

    if published_count <> 1 then
      raise exception 'THANKYOU_CONTRACT_ABORT: xv/% has % active published rows', slug, published_count;
    end if;

    select p.content#>>'{thankYou,variant}'
    into thank_you_variant
    from public.invitations i
    join public.published_invitation_content p on p.invitation_project_id = i.id
    where i.slug = slug
      and i.event_type = 'xv'
      and i.archived_at is null
      and p.deleted_at is null;

    if thank_you_variant is not null and thank_you_variant <> 'editorial-back-cover' then
      raise exception 'THANKYOU_CONTRACT_ABORT: xv/% thankYou.variant=% contradicts Goal 3', slug, thank_you_variant;
    end if;
  end loop;

  select count(*) into published_count
  from public.invitations i
  join public.published_invitation_content p on p.invitation_project_id = i.id
  where i.slug = 'leah-lexa'
    and i.event_type = 'baby-shower'
    and i.archived_at is null
    and p.deleted_at is null;

  if published_count <> 1 then
    raise exception 'THANKYOU_CONTRACT_ABORT: baby-shower/leah-lexa has % active published rows', published_count;
  end if;
end $$;

update public.published_invitation_content p
set
  content = p.content
    || jsonb_build_object(
         'thankYou',
         coalesce(p.content->'thankYou', '{}'::jsonb)
           || jsonb_build_object('variant', 'editorial-back-cover')
       )
    || jsonb_build_object(
         'sectionStyles',
         coalesce(p.content->'sectionStyles', '{}'::jsonb)
           || jsonb_build_object(
                'thankYou',
                coalesce(p.content#>'{sectionStyles,thankYou}', '{}'::jsonb)
                  || jsonb_build_object('structuralVariant', 'editorial-back-cover')
              )
       ),
  version = p.version + 1,
  published_at = now()
from public.invitations i
where p.invitation_project_id = i.id
  and i.archived_at is null
  and p.deleted_at is null
  and (
    (i.event_type = 'xv' and i.slug in ('xareni-iyarit', 'america-johana', 'ana-sofia-cota-guillen', 'ayrin-samantha-lerma-castro'))
    or (i.event_type = 'baby-shower' and i.slug = 'leah-lexa')
  )
  and (
    p.content#>>'{thankYou,variant}' is distinct from 'editorial-back-cover'
    or p.content#>>'{sectionStyles,thankYou,structuralVariant}' is distinct from 'editorial-back-cover'
  );

update public.invitation_content_drafts d
set
  content = d.content
    || jsonb_build_object(
         'thankYou',
         coalesce(d.content->'thankYou', '{}'::jsonb)
           || jsonb_build_object('variant', 'editorial-back-cover')
       )
    || jsonb_build_object(
         'sectionStyles',
         coalesce(d.content->'sectionStyles', '{}'::jsonb)
           || jsonb_build_object(
                'thankYou',
                coalesce(d.content#>'{sectionStyles,thankYou}', '{}'::jsonb)
                  || jsonb_build_object('structuralVariant', 'editorial-back-cover')
              )
       ),
  updated_at = now()
from public.invitations i
where d.invitation_project_id = i.id
  and i.archived_at is null
  and d.deleted_at is null
  and (
    (i.event_type = 'xv' and i.slug in ('xareni-iyarit', 'america-johana', 'ana-sofia-cota-guillen', 'ayrin-samantha-lerma-castro'))
    or (i.event_type = 'baby-shower' and i.slug = 'leah-lexa')
  )
  and (
    d.content#>>'{thankYou,variant}' is distinct from 'editorial-back-cover'
    or d.content#>>'{sectionStyles,thankYou,structuralVariant}' is distinct from 'editorial-back-cover'
  );

commit;
