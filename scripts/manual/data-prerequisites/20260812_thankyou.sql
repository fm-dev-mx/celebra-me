-- Read-only verification of the Thank You contracts of the three invitations targeted by
-- 20260812_thankyou_editorial_back_cover_structural_contracts.sql. That patch is superseded: the
-- owner-approved designs were reconciled with Production on 2026-09-07 and each invitation keeps
-- an explicit non-editorial variant. This query checks that approved variant on the published row
-- (exactly one per invitation) and every active draft. `sectionStyles.*.structuralVariant` is not
-- canonical input and is not checked.
BEGIN TRANSACTION READ ONLY;

WITH expected(event_type, slug, variant) AS (
  VALUES ('xv', 'ana-sofia-cota-guillen', 'portrait-keepsake'),
    ('xv', 'ayrin-samantha-lerma-castro', 'portrait-letter'),
    ('baby-shower', 'leah-lexa', 'portrait-keepsake')
), targets AS (
  SELECT i.id, e.event_type, e.slug, e.variant
  FROM expected e
  JOIN public.invitations i ON i.slug = e.slug AND i.event_type = e.event_type
  WHERE i.archived_at IS NULL
), published_coverage AS (
  SELECT e.event_type, e.slug, count(p.invitation_project_id) AS rows
  FROM expected e
  LEFT JOIN targets t ON t.slug = e.slug AND t.event_type = e.event_type
  LEFT JOIN public.published_invitation_content p
    ON p.invitation_project_id = t.id AND p.deleted_at IS NULL
  GROUP BY e.event_type, e.slug
), content_rows AS (
  SELECT t.variant, p.content
  FROM targets t
  JOIN public.published_invitation_content p ON p.invitation_project_id = t.id
  WHERE p.deleted_at IS NULL
  UNION ALL
  SELECT t.variant, d.content
  FROM targets t
  JOIN public.invitation_content_drafts d ON d.invitation_project_id = t.id
  WHERE d.deleted_at IS NULL
), totals AS (
  SELECT
    (SELECT count(*) FROM published_coverage WHERE rows <> 1) AS invalid_published_targets,
    count(*) AS checked_rows,
    count(*) FILTER (WHERE content#>>'{thankYou,variant}' IS DISTINCT FROM variant) AS mismatched_rows
  FROM content_rows
)
SELECT *, invalid_published_targets = 0 AND mismatched_rows = 0 AS ok FROM totals;

ROLLBACK;
