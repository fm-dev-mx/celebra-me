BEGIN;

DO $$
DECLARE
  v_project_id uuid;
  v_event_id uuid;
  v_owner_user_id uuid;
  v_event_count int;
  v_membership_count int;
BEGIN
  -- ==========================================================================
  -- 1. Resolve Xareni editable project.
  -- ==========================================================================

  SELECT p.id INTO v_project_id
  FROM public.invitation_projects p
  WHERE p.slug = 'xareni-iyarit'
    AND p.event_type = 'xv'
    AND p.deleted_at IS NULL
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION
      '[PREFLIGHT] Xareni invitation_project not found. Create the editable dashboard record first.';
  END IF;

  -- Published content must exist and point to the same project.
  IF NOT EXISTS (
    SELECT 1
    FROM public.published_invitation_content pc
    WHERE pc.slug = 'xareni-iyarit'
      AND pc.event_type = 'xv'
      AND pc.invitation_project_id = v_project_id
      AND pc.deleted_at IS NULL
      AND pc.content ->> '_assetSlug' = 'xv-xareni-iyarit'
      AND pc.content -> 'rsvp' ->> 'confirmationMode' = 'api'
  ) THEN
    RAISE EXCEPTION
      '[PREFLIGHT] Published Xareni content is missing, not linked to project %, or not configured for API RSVP.',
      v_project_id;
  END IF;

  -- ==========================================================================
  -- 2. Resolve owner_user_id.
  -- Prefer an existing Xareni event owner, then production owner from real XV events.
  -- ==========================================================================

  SELECT e.owner_user_id INTO v_owner_user_id
  FROM public.events e
  WHERE (
      e.invitation_project_id = v_project_id
      OR e.slug IN ('xareni-iyarit', 'xv-xareni-iyarit')
    )
  ORDER BY e.updated_at DESC
  LIMIT 1;

	IF v_owner_user_id IS NULL THEN
		RAISE EXCEPTION
			'[PREFLIGHT] Could not resolve owner_user_id. Create the Xareni event in the dashboard first or provide an explicit owner_user_id.';
	END IF;

  -- ==========================================================================
  -- 3. Detect any existing Xareni event by project or old/new slug.
  -- This handles:
  -- - no event yet
  -- - event already linked to project
  -- - old slug event that must be migrated
  -- - soft-deleted event that should be revived
  -- ==========================================================================

  SELECT count(DISTINCT e.id) INTO v_event_count
  FROM public.events e
  WHERE e.invitation_project_id = v_project_id
     OR e.slug IN ('xareni-iyarit', 'xv-xareni-iyarit');

  IF v_event_count > 1 THEN
    RAISE EXCEPTION
      '[PREFLIGHT] Found % possible Xareni events by project/slug. Resolve duplicates manually before running this patch.',
      v_event_count;
  END IF;

  SELECT e.id INTO v_event_id
  FROM public.events e
  WHERE e.invitation_project_id = v_project_id
     OR e.slug IN ('xareni-iyarit', 'xv-xareni-iyarit')
  LIMIT 1;

  -- ==========================================================================
  -- 4. Create or repair event.
  -- ==========================================================================

  IF v_event_id IS NULL THEN
    INSERT INTO public.events (
      owner_user_id,
      slug,
      event_type,
      title,
      status,
      published_at,
      created_at,
      updated_at,
      deleted_at,
      invitation_project_id
    )
    VALUES (
      v_owner_user_id,
      'xareni-iyarit',
      'xv',
      'XV años de Xareni Iyarit',
      'published',
      NULL,
      now(),
      now(),
      NULL,
      v_project_id
    )
    RETURNING id INTO v_event_id;
  ELSE
    UPDATE public.events
    SET
      owner_user_id = v_owner_user_id,
      slug = 'xareni-iyarit',
      event_type = 'xv',
      title = 'XV años de Xareni Iyarit',
      status = 'published',
      published_at = published_at,
      invitation_project_id = v_project_id,
      deleted_at = NULL,
      updated_at = now()
    WHERE id = v_event_id;
  END IF;

  -- ==========================================================================
  -- 5. Ensure owner membership exists.
  -- Update first, including soft-deleted rows, to avoid unique constraint issues.
  -- ==========================================================================

  UPDATE public.event_memberships
  SET
    membership_role = 'owner',
    deleted_at = NULL,
    updated_at = now()
  WHERE event_id = v_event_id
    AND user_id = v_owner_user_id;

  GET DIAGNOSTICS v_membership_count = ROW_COUNT;

  IF v_membership_count = 0 THEN
    INSERT INTO public.event_memberships (
      event_id,
      user_id,
      membership_role,
      created_at,
      updated_at,
      deleted_at
    )
    VALUES (
      v_event_id,
      v_owner_user_id,
      'owner',
      now(),
      now(),
      NULL
    );
  ELSIF v_membership_count > 1 THEN
    RAISE EXCEPTION
      '[VERIFY] Updated % memberships for event/user. Expected 0 or 1.',
      v_membership_count;
  END IF;

END $$;

-- ============================================================================
-- 6. Verification.
-- ============================================================================

SELECT
  e.id::text AS event_id,
  e.owner_user_id::text,
  e.slug,
  e.event_type,
  e.title,
  e.status,
  e.published_at,
  e.invitation_project_id::text,
  e.created_at,
  e.updated_at,
  e.deleted_at
FROM public.events e
JOIN public.invitation_projects p
  ON p.id = e.invitation_project_id
WHERE p.slug = 'xareni-iyarit'
  AND p.event_type = 'xv';

SELECT
  m.id::text AS membership_id,
  m.event_id::text,
  m.user_id::text,
  m.membership_role,
  m.created_at,
  m.updated_at,
  m.deleted_at
FROM public.event_memberships m
JOIN public.events e
  ON e.id = m.event_id
JOIN public.invitation_projects p
  ON p.id = e.invitation_project_id
WHERE p.slug = 'xareni-iyarit'
  AND p.event_type = 'xv';

SELECT
  pc.id::text AS published_content_id,
  pc.invitation_project_id::text,
  pc.slug,
  pc.event_type,
  pc.is_demo,
  pc.content ->> '_assetSlug' AS asset_slug,
  pc.content -> 'rsvp' ->> 'confirmationMode' AS rsvp_confirmation_mode,
  pc.content -> 'rsvp' ->> 'accessMode' AS rsvp_access_mode
FROM public.published_invitation_content pc
WHERE pc.slug = 'xareni-iyarit'
  AND pc.event_type = 'xv'
  AND pc.deleted_at IS NULL;

COMMIT;

-- ============================================================================
-- Targeted rollback, only if needed:
--
-- BEGIN;
--
-- DELETE FROM public.event_memberships
-- WHERE event_id IN (
--   SELECT e.id
--   FROM public.events e
--   JOIN public.invitation_projects p
--     ON p.id = e.invitation_project_id
--   WHERE p.slug = 'xareni-iyarit'
--     AND p.event_type = 'xv'
-- );
--
-- DELETE FROM public.events
-- WHERE invitation_project_id IN (
--   SELECT id
--   FROM public.invitation_projects
--   WHERE slug = 'xareni-iyarit'
--     AND event_type = 'xv'
-- );
--
-- COMMIT;
-- ============================================================================
