-- ============================================================================
-- PATCH: Add hero.backgroundImageDesktop for Xareni Iyarit published invitation
--
-- Scope:
--   public.published_invitation_content
--   slug = 'xv-xareni-iyarit'
--   event_type = 'xv'
--
-- This script sets content.hero.backgroundImageDesktop to the internal asset
-- key "heroDesktop" so the Hero.astro component renders hero-desktop.webp on
-- viewports >= 992px.
--
-- Do not run until explicitly approved.
-- Before running, create a production backup:
--   PROD_DB_URL=... pnpm db:prod:backup
-- ============================================================================
--
-- @script-id: 20260620120000_xareni_hero_desktop_background
-- @purpose: Add hero.backgroundImageDesktop for Xareni Iyarit XV published invitation
-- @env: production
-- @ticket: agent-task-xareni-hero-desktop
-- @tables: public.published_invitation_content
-- @operation: update
-- @expected-rows-min: 1
-- @expected-rows-max: 1
-- @requires-backup: true
-- @dry-run-query: SELECT id, slug, event_type, version FROM public.published_invitation_content WHERE slug = 'xv-xareni-iyarit' AND event_type = 'xv'
-- @rollback: restore the published_invitation_content row from the production backup captured before running this patch
--
-- ============================================================================

begin;

-- 1. PREFLIGHT: verify exactly one target row.
do $$
declare
  row_count int;
begin
  select count(*) into row_count
  from public.published_invitation_content
  where slug = 'xv-xareni-iyarit'
    and event_type = 'xv';

  if row_count = 0 then
    raise exception '[PREFLIGHT] No published content row found for xv-xareni-iyarit / xv. Aborting.';
  end if;

  if row_count > 1 then
    raise exception '[PREFLIGHT] Found % rows for xv-xareni-iyarit / xv. Expected exactly 1. Aborting.', row_count;
  end if;
end $$;

-- 2. PREVIEW: show current hero section before patch.
select
  'before_patch' as phase,
  id::text,
  slug,
  event_type,
  version,
  content -> 'hero' as hero_before_patch
from public.published_invitation_content
where slug = 'xv-xareni-iyarit'
  and event_type = 'xv';

-- 3. PATCH: set hero.backgroundImageDesktop = "heroDesktop".
update public.published_invitation_content
set content = jsonb_set(
  content,
  '{hero,backgroundImageDesktop}',
  '"heroDesktop"'::jsonb,
  true
),
  version = version + 1,
  updated_at = now()
where slug = 'xv-xareni-iyarit'
  and event_type = 'xv';

-- 4. VERIFY: confirm the field was added.
select
  'after_patch' as phase,
  id::text,
  slug,
  event_type,
  version,
  content -> 'hero' ->> 'backgroundImageDesktop' as background_image_desktop,
  content -> 'hero' ->> 'backgroundImage' as background_image
from public.published_invitation_content
where slug = 'xv-xareni-iyarit'
  and event_type = 'xv';

-- Review verification output before committing.
-- Replace "commit" with "rollback" if anything is unexpected.
commit;

-- ============================================================================
-- Rollback notes
--
-- Preferred rollback: restore the row from the production backup captured before
-- running this patch.
--
-- Targeted rollback:
--
-- update public.published_invitation_content
-- set content = content #- '{hero,backgroundImageDesktop}',
--     version = version + 1,
--     updated_at = now()
-- where slug = 'xv-xareni-iyarit'
--   and event_type = 'xv';
-- ============================================================================
