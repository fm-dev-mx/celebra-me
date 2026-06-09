-- ============================================================================
-- PATCH: Ayrin WhatsApp share template only
--
-- Scope:
--   public.published_invitation_content
--   slug = 'ayrin-samantha-lerma-castro'
--   event_type = 'xv'
--
-- This script is intentionally scoped to replace only:
--   content.sharing.whatsappTemplate
--
-- Do not run until explicitly approved.
-- Before running, create a production backup:
--   PROD_DB_URL=... pnpm db:prod:backup
-- ============================================================================

begin;

-- 1. PREFLIGHT: verify exactly one target row and capture current value.
select
  id::text,
  invitation_project_id::text,
  slug,
  event_type,
  version,
  published_at::text,
  updated_at::text,
  content -> 'sharing' ->> 'whatsappTemplate' as current_whatsapp_template
from public.published_invitation_content
where slug = 'ayrin-samantha-lerma-castro'
  and event_type = 'xv';

-- 2. PATCH: replace only content.sharing.whatsappTemplate.
update public.published_invitation_content
set content = jsonb_set(
  content,
  '{sharing,whatsappTemplate}',
  to_jsonb(
    'Hola {name}, te comparto la invitación para los XV años de Ayrin Samantha: {inviteUrl}'::text
  ),
  true
)
where slug = 'ayrin-samantha-lerma-castro'
  and event_type = 'xv';

-- 3. VERIFY: expected updated_whatsapp_template is the approved Ayrin value.
select
  id::text,
  slug,
  event_type,
  content -> 'sharing' ->> 'whatsappTemplate' as updated_whatsapp_template,
  content -> 'hero' ->> 'name' as hero_name,
  content ->> '_assetSlug' as asset_slug
from public.published_invitation_content
where slug = 'ayrin-samantha-lerma-castro'
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
-- Targeted rollback, if the preflight value is still the desired previous value:
--
-- update public.published_invitation_content
-- set content = jsonb_set(
--   content,
--   '{sharing,whatsappTemplate}',
--   to_jsonb(
--     'Hola {name}, te comparto la invitación para los XV años de Isabella Rose: {inviteUrl}'::text
--   ),
--   true
-- )
-- where slug = 'ayrin-samantha-lerma-castro'
--   and event_type = 'xv';
-- ============================================================================
