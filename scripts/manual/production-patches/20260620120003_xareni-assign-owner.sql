-- @script-id: 20260620120003_xareni-assign-owner
-- @purpose: Assign created_by owner to Xareni Iyarit client invitation to unblock publishing
-- @env: production
-- @ticket: production-incident-xareni-publish-owner
-- @tables: public.invitations
-- @operation: update
-- @expected-rows-min: 1
-- @expected-rows-max: 1
-- @requires-backup: true
-- @dry-run-query: SELECT id, kind, created_by, slug, event_type, status FROM public.invitations WHERE id = 'b3ce18b2-15f6-452a-9150-496ddd0ed133'
-- @rollback: UPDATE public.invitations SET created_by = NULL, updated_at = now() WHERE id = 'b3ce18b2-15f6-452a-9150-496ddd0ed133';

-- ============================================================================
-- PATCH: Assign created_by for Xareni Iyarit invitation
--
-- Targets: public.invitations
--   id = b3ce18b2-15f6-452a-9150-496ddd0ed133
--
-- ## TO DO BEFORE EXECUTION
--
-- 1. Create a production backup:
--      PROD_DB_URL=... pnpm db:prod:backup
--
-- 2. Replace TARGET_USER_ID below with a real admin user UUID.
--    Run the dry-run query first to find an eligible admin:
--      SELECT u.id, u.email, r.role
--      FROM auth.users u
--      JOIN public.app_user_roles r ON r.user_id = u.id
--      WHERE r.role = 'super_admin';
--
-- 3. Verify the dry-run query returns exactly 1 row and created_by IS NULL.
--
-- 4. Replace the placeholder TARGET_USER_ID with the chosen admin UUID.
--
-- Do not run until all preflight checks pass.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- CONFIG: Set this to the admin user UUID before executing.
-- --------------------------------------------------------------------------
-- TARGET_USER_ID := '00000000-0000-0000-0000-000000000000';
do $$
declare
  v_invitation_id constant uuid := 'b3ce18b2-15f6-452a-9150-496ddd0ed133';
  v_target_user_id constant uuid := 'REPLACE_ME_WITH_ADMIN_UUID';
  v_invitation_kind text;
  v_current_created_by text;
  v_user_exists boolean;
  v_user_is_admin boolean;
  v_row_count int;
begin
  -- ==========================================================================
  -- PREFLIGHT 1: Invitation exists, kind = 'client', created_by IS NULL
  -- ==========================================================================

  select kind::text, created_by::text
  into v_invitation_kind, v_current_created_by
  from public.invitations
  where id = v_invitation_id;

  if v_invitation_kind is null then
    raise exception 'INVITATION_NOT_FOUND: %', v_invitation_id;
  end if;

  if v_invitation_kind <> 'client' then
    raise exception 'INVITATION_NOT_CLIENT: invitation % has kind "%", expected "client".', v_invitation_id, v_invitation_kind;
  end if;

  if v_current_created_by is not null then
    raise exception 'OWNER_ALREADY_EXISTS: invitation % already has created_by set to %.', v_invitation_id, v_current_created_by;
  end if;

  -- ==========================================================================
  -- PREFLIGHT 2: Target user exists in auth.users and has super_admin role
  -- ==========================================================================

  if v_target_user_id = 'REPLACE_ME_WITH_ADMIN_UUID' then
    raise exception 'CONFIG_REQUIRED: TARGET_USER_ID must be replaced with a real admin UUID before execution.';
  end if;

  select exists (select 1 from auth.users where id = v_target_user_id)
  into v_user_exists;

  if not v_user_exists then
    raise exception 'USER_NOT_FOUND: target user % does not exist in auth.users.', v_target_user_id;
  end if;

  select exists (
    select 1 from public.app_user_roles
    where user_id = v_target_user_id and role = 'super_admin'
  )
  into v_user_is_admin;

  if not v_user_is_admin then
    raise exception 'USER_NOT_ADMIN: target user % does not have super_admin role in app_user_roles.', v_target_user_id;
  end if;

  -- ==========================================================================
  -- PREFLIGHT 3: Verify invitation is not archived
  -- ==========================================================================

  if exists (select 1 from public.invitations where id = v_invitation_id and archived_at is not null) then
    raise exception 'INVITATION_ARCHIVED: invitation % is archived. Restore before assigning owner.', v_invitation_id;
  end if;

  -- ==========================================================================
  -- EXECUTE: Assign owner
  -- ==========================================================================

  update public.invitations
  set
    created_by = v_target_user_id,
    updated_at = now()
  where id = v_invitation_id
    and kind = 'client'
    and created_by is null;

  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    raise exception 'UPDATE_FAILED: no rows matched the update predicate for invitation %.', v_invitation_id;
  end if;

  if v_row_count > 1 then
    raise exception 'UPDATE_UNEXPECTED: updated % rows (expected 1).', v_row_count;
  end if;

end $$;

-- ============================================================================
-- VERIFICATION 1: invitations.created_by
-- ============================================================================

select
  'invitations_after_patch' as phase,
  id::text,
  kind,
  slug,
  event_type,
  status,
  created_by::text,
  created_at::text,
  updated_at::text
from public.invitations
where id = 'b3ce18b2-15f6-452a-9150-496ddd0ed133';

-- ============================================================================
-- VERIFICATION 2: events.owner_user_id (if any RSVP event exists)
-- ============================================================================

select
  'events_after_patch' as phase,
  e.id::text,
  e.slug,
  e.event_type,
  e.title,
  e.status,
  e.owner_user_id::text,
  e.invitation_project_id::text
from public.events e
where e.invitation_project_id = 'b3ce18b2-15f6-452a-9150-496ddd0ed133'
   or e.slug in ('xareni-iyarit', 'xv-xareni-iyarit');

-- ============================================================================
-- VERIFICATION 3: published_invitation_content state
-- ============================================================================

select
  'published_content_after_patch' as phase,
  pc.id::text,
  pc.invitation_project_id::text,
  pc.slug,
  pc.event_type,
  pc.is_demo,
  pc.version,
  pc.published_at::text,
  pc.content ->> '_assetSlug' as asset_slug,
  pc.content -> 'rsvp' ->> 'confirmationMode' as rsvp_confirmation_mode
from public.published_invitation_content pc
where pc.invitation_project_id = 'b3ce18b2-15f6-452a-9150-496ddd0ed133';

-- ============================================================================
-- VERIFICATION 4: snapshot and theme state
-- ============================================================================

select
  'snapshot_after_patch' as phase,
  id::text,
  base_demo_id,
  theme_id,
  snapshot ->> 'themeId' as snap_theme,
  snapshot ->> 'id' as snap_id,
  snapshot ->> 'previewSlug' as snap_preview_slug
from public.invitations
where id = 'b3ce18b2-15f6-452a-9150-496ddd0ed133';

commit;

-- ============================================================================
-- Rollback (if needed):
--
-- BEGIN;
-- UPDATE public.invitations
-- SET created_by = NULL, updated_at = now()
-- WHERE id = 'b3ce18b2-15f6-452a-9150-496ddd0ed133';
-- COMMIT;
-- ============================================================================
