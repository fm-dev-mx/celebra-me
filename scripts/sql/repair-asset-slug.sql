-- ============================================================================
-- DIAGNOSTIC ONLY — Inspect _assetSlug integrity without modifying data.
--
-- Client _assetSlug values must NOT be force-set to equal public route slugs.
-- Route slugs identify URLs/RSVP events; _assetSlug identifies the Astro asset
-- directory and may intentionally differ. Non-missing client _assetSlugs that
-- do not point to a demo require application-side asset registry review.
--
-- Safe: SELECT only. No UPDATE statements. No data mutation.
-- ============================================================================


-- ============================================================================
-- 1. Client published content missing _assetSlug
-- ============================================================================

SELECT
    'published'                  AS source_table,
    pic.id                       AS content_id,
    i.id                         AS invitation_id,
    i.slug                       AS invitation_slug,
    i.event_type,
    i.kind,
    pic.content->>'_assetSlug'   AS stored_asset_slug,
    'missing _assetSlug'         AS diagnostic
FROM published_invitation_content pic
JOIN invitations i ON i.id = pic.invitation_project_id
WHERE pic.deleted_at IS NULL
  AND i.archived_at IS NULL
  AND i.kind IS DISTINCT FROM 'demo'
  AND i.slug IS NOT NULL
  AND NULLIF(pic.content->>'_assetSlug', '') IS NULL
ORDER BY i.event_type, i.slug;


-- ============================================================================
-- 2. Client draft content missing _assetSlug when the key is expected to exist
-- ============================================================================

SELECT
    'draft'                      AS source_table,
    icd.id                       AS content_id,
    i.id                         AS invitation_id,
    i.slug                       AS invitation_slug,
    i.event_type,
    i.kind,
    icd.content->>'_assetSlug'   AS stored_asset_slug,
    'missing _assetSlug'         AS diagnostic
FROM invitation_content_drafts icd
JOIN invitations i ON i.id = icd.invitation_project_id
WHERE i.archived_at IS NULL
  AND i.kind IS DISTINCT FROM 'demo'
  AND i.slug IS NOT NULL
  AND icd.content ? '_assetSlug'
  AND NULLIF(icd.content->>'_assetSlug', '') IS NULL
ORDER BY i.event_type, i.slug;


-- ============================================================================
-- 3. Client content whose _assetSlug points to a demo invitation slug
-- ============================================================================

SELECT
    'published'                  AS source_table,
    pic.id                       AS content_id,
    i.id                         AS invitation_id,
    i.slug                       AS invitation_slug,
    i.event_type,
    i.kind,
    pic.content->>'_assetSlug'   AS stored_asset_slug,
    demo.slug                    AS referenced_demo_slug,
    'client _assetSlug points to demo invitation slug' AS diagnostic
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
    demo.slug                    AS referenced_demo_slug,
    'client _assetSlug points to demo invitation slug' AS diagnostic
FROM invitation_content_drafts icd
JOIN invitations i ON i.id = icd.invitation_project_id
JOIN invitations demo
    ON demo.slug = icd.content->>'_assetSlug'
   AND demo.kind = 'demo'
WHERE i.archived_at IS NULL
  AND i.kind IS DISTINCT FROM 'demo'
  AND icd.content ? '_assetSlug'
ORDER BY source_table, event_type, invitation_slug;


-- ============================================================================
-- 4. Client content needing application-side asset registry review
-- ============================================================================

SELECT
    'published'                  AS source_table,
    pic.id                       AS content_id,
    i.id                         AS invitation_id,
    i.slug                       AS invitation_slug,
    i.event_type,
    i.kind,
    pic.content->>'_assetSlug'   AS stored_asset_slug,
    'requires asset registry check in app' AS diagnostic
FROM published_invitation_content pic
JOIN invitations i ON i.id = pic.invitation_project_id
WHERE pic.deleted_at IS NULL
  AND i.archived_at IS NULL
  AND i.kind IS DISTINCT FROM 'demo'
  AND i.slug IS NOT NULL
  AND NULLIF(pic.content->>'_assetSlug', '') IS NOT NULL
ORDER BY i.event_type, i.slug;


-- ============================================================================
-- 5. Demo invitations whose _assetSlug does not match their own route slug
-- ============================================================================

SELECT
    pic.id                       AS published_content_id,
    i.id                         AS invitation_id,
    i.slug                       AS invitation_slug,
    i.event_type,
    pic.content->>'_assetSlug'   AS stored_asset_slug,
    i.slug                       AS required_demo_asset_slug,
    CASE
        WHEN pic.content->>'_assetSlug' IS NULL THEN 'missing'
        WHEN pic.content->>'_assetSlug' = i.slug THEN 'correct'
        ELSE 'WRONG'
    END                          AS diagnostic
FROM published_invitation_content pic
JOIN invitations i ON i.id = pic.invitation_project_id
WHERE pic.deleted_at IS NULL
  AND i.archived_at IS NULL
  AND i.kind = 'demo'
  AND pic.content->>'_assetSlug' IS DISTINCT FROM i.slug
ORDER BY i.event_type, i.slug;
