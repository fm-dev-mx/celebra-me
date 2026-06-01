-- ============================================================================
-- REPAIR: Fix _assetSlug for active non-demo/client invitations
--
-- Safe: SELECT-only DIAGNOSE and PREVIEW sections; REPAIR is commented out.
-- Idempotent: safe to run REPAIR more than once.
-- Run in local DB first, then production.
-- ============================================================================


-- ============================================================================
-- 1. DIAGNOSE: Identify all incorrect _assetSlug values
-- ============================================================================

-- 1a. Published content with wrong or missing _assetSlug for active non-demo invitations
SELECT
    'published'                  AS source_table,
    pic.id                       AS content_id,
    i.id                         AS invitation_id,
    i.slug                       AS invitation_slug,
    i.event_type,
    i.kind,
    pic.content->>'_assetSlug'   AS stored_asset_slug,
    i.slug                       AS expected_asset_slug,
    CASE
        WHEN pic.content->>'_assetSlug' IS NULL THEN 'missing'
        WHEN pic.content->>'_assetSlug' = i.slug THEN 'correct'
        ELSE 'WRONG'
    END                          AS status
FROM published_invitation_content pic
JOIN invitations i ON i.id = pic.invitation_project_id
WHERE pic.deleted_at IS NULL
  AND i.archived_at IS NULL
  AND i.kind IS DISTINCT FROM 'demo'
  AND i.slug IS NOT NULL
  AND pic.content->>'_assetSlug' IS DISTINCT FROM i.slug

UNION ALL

-- 1b. Draft content with wrong or missing _assetSlug for active non-demo invitations
SELECT
    'draft'                      AS source_table,
    icd.id                       AS content_id,
    i.id                         AS invitation_id,
    i.slug                       AS invitation_slug,
    i.event_type,
    i.kind,
    icd.content->>'_assetSlug'   AS stored_asset_slug,
    i.slug                       AS expected_asset_slug,
    CASE
        WHEN NOT (icd.content ? '_assetSlug') THEN 'no _assetSlug key'
        WHEN icd.content->>'_assetSlug' = i.slug THEN 'correct'
        ELSE 'WRONG'
    END                          AS status
FROM invitation_content_drafts icd
JOIN invitations i ON i.id = icd.invitation_project_id
WHERE i.archived_at IS NULL
  AND i.kind IS DISTINCT FROM 'demo'
  AND i.slug IS NOT NULL
  AND (
    NOT (icd.content ? '_assetSlug')
    OR icd.content->>'_assetSlug' IS DISTINCT FROM i.slug
  );

-- 1c. Client content whose _assetSlug points to a demo slug (the concrete bug)
SELECT
    'published'                  AS source_table,
    pic.id                       AS content_id,
    i.id                         AS invitation_id,
    i.slug                       AS invitation_slug,
    i.event_type,
    i.kind,
    pic.content->>'_assetSlug'   AS stored_asset_slug,
    demo.slug                    AS referenced_demo_slug
FROM published_invitation_content pic
JOIN invitations i ON i.id = pic.invitation_project_id
JOIN invitations demo
    ON demo.slug = pic.content->>'_assetSlug'
   AND demo.kind = 'demo'
WHERE pic.deleted_at IS NULL
  AND i.archived_at IS NULL
  AND i.kind IS DISTINCT FROM 'demo'

UNION ALL

SELECT
    'draft'                      AS source_table,
    icd.id                       AS content_id,
    i.id                         AS invitation_id,
    i.slug                       AS invitation_slug,
    i.event_type,
    i.kind,
    icd.content->>'_assetSlug'   AS stored_asset_slug,
    demo.slug                    AS referenced_demo_slug
FROM invitation_content_drafts icd
JOIN invitations i ON i.id = icd.invitation_project_id
JOIN invitations demo
    ON demo.slug = icd.content->>'_assetSlug'
   AND demo.kind = 'demo'
WHERE i.archived_at IS NULL
  AND i.kind IS DISTINCT FROM 'demo'
  AND icd.content ? '_assetSlug'
ORDER BY source_table, event_type, invitation_slug;

-- 1d. Demo invitations with wrong _assetSlug (should always point to own slug)
SELECT
    pic.id                       AS published_content_id,
    i.id                         AS invitation_id,
    i.slug                       AS invitation_slug,
    i.event_type,
    pic.content->>'_assetSlug'   AS stored_asset_slug,
    i.slug                       AS expected_asset_slug,
    CASE
        WHEN pic.content->>'_assetSlug' IS NULL THEN 'missing'
        WHEN pic.content->>'_assetSlug' = i.slug THEN 'correct'
        ELSE 'WRONG'
    END                          AS status
FROM published_invitation_content pic
JOIN invitations i ON i.id = pic.invitation_project_id
WHERE pic.deleted_at IS NULL
  AND i.archived_at IS NULL
  AND i.kind = 'demo'
  AND pic.content->>'_assetSlug' IS DISTINCT FROM i.slug
ORDER BY i.event_type, i.slug;


-- ============================================================================
-- 2. PREVIEW: Rows that would be changed by REPAIR
-- ============================================================================

-- 2a. Published content rows to fix
SELECT
    pic.id                       AS published_content_id,
    i.id                         AS invitation_id,
    i.slug                       AS invitation_slug,
    i.event_type,
    i.kind,
    pic.content->>'_assetSlug'   AS old_asset_slug,
    i.slug                       AS new_asset_slug
FROM published_invitation_content pic
JOIN invitations i ON i.id = pic.invitation_project_id
WHERE pic.deleted_at IS NULL
  AND i.archived_at IS NULL
  AND i.kind IS DISTINCT FROM 'demo'
  AND i.slug IS NOT NULL
  AND pic.content->>'_assetSlug' IS DISTINCT FROM i.slug
ORDER BY i.event_type, i.slug;

-- 2b. Draft content rows to fix (only where _assetSlug already exists)
SELECT
    icd.id                       AS draft_id,
    i.id                         AS invitation_id,
    i.slug                       AS invitation_slug,
    i.event_type,
    i.kind,
    icd.content->>'_assetSlug'   AS old_asset_slug,
    i.slug                       AS new_asset_slug
FROM invitation_content_drafts icd
JOIN invitations i ON i.id = icd.invitation_project_id
WHERE i.archived_at IS NULL
  AND i.kind IS DISTINCT FROM 'demo'
  AND i.slug IS NOT NULL
  AND icd.content ? '_assetSlug'
  AND icd.content->>'_assetSlug' IS DISTINCT FROM i.slug
ORDER BY i.event_type, i.slug;


-- ============================================================================
-- 3. REPAIR: Uncomment and run in a transaction when ready
-- ============================================================================

-- BEGIN;
--
-- -- Repair published content.
-- UPDATE published_invitation_content pic
-- SET content = jsonb_set(
--     COALESCE(pic.content, '{}'::jsonb),
--     '{_assetSlug}',
--     to_jsonb(i.slug)
-- )
-- FROM invitations i
-- WHERE i.id = pic.invitation_project_id
--   AND pic.deleted_at IS NULL
--   AND i.archived_at IS NULL
--   AND i.kind IS DISTINCT FROM 'demo'
--   AND i.slug IS NOT NULL
--   AND pic.content->>'_assetSlug' IS DISTINCT FROM i.slug;
--
-- -- Repair draft content only when _assetSlug already exists.
-- UPDATE invitation_content_drafts icd
-- SET content = jsonb_set(
--     COALESCE(icd.content, '{}'::jsonb),
--     '{_assetSlug}',
--     to_jsonb(i.slug)
-- )
-- FROM invitations i
-- WHERE i.id = icd.invitation_project_id
--   AND i.archived_at IS NULL
--   AND i.kind IS DISTINCT FROM 'demo'
--   AND i.slug IS NOT NULL
--   AND icd.content ? '_assetSlug'
--   AND icd.content->>'_assetSlug' IS DISTINCT FROM i.slug;
--
-- COMMIT;


-- ============================================================================
-- 4. VERIFY: Re-run section 1 DIAGNOSE queries after REPAIR
-- Expected result after successful repair: 0 rows across all queries
-- ============================================================================
