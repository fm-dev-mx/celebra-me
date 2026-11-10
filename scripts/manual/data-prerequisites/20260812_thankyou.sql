-- Read-only verification of 20260812_thankyou_editorial_back_cover_structural_contracts.sql.
-- Missing/ambiguous published targets fail; drafts are checked when present, as in the patch.
BEGIN TRANSACTION READ ONLY;

WITH expected(event_type, slug) AS (
  VALUES ('xv', 'ana-sofia-cota-guillen'), ('xv', 'ayrin-samantha-lerma-castro'),
    ('baby-shower', 'leah-lexa')
), targets AS (
  SELECT i.id, e.event_type, e.slug
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
  SELECT p.content
  FROM targets t
  JOIN public.published_invitation_content p ON p.invitation_project_id = t.id
  WHERE p.deleted_at IS NULL
  UNION ALL
  SELECT d.content
  FROM targets t
  JOIN public.invitation_content_drafts d ON d.invitation_project_id = t.id
  WHERE d.deleted_at IS NULL
), totals AS (
  SELECT
    (SELECT count(*) FROM published_coverage WHERE rows <> 1) AS invalid_published_targets,
    count(*) AS checked_rows,
    count(*) FILTER (WHERE
      content#>>'{thankYou,variant}' IS DISTINCT FROM 'editorial-back-cover'
      OR content#>>'{sectionStyles,thankYou,structuralVariant}' IS DISTINCT FROM 'editorial-back-cover'
    ) AS mismatched_rows
  FROM content_rows
)
SELECT *, invalid_published_targets = 0 AND mismatched_rows = 0 AS ok FROM totals;

ROLLBACK;
