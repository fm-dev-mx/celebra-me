-- Read-only verification of 20260812_p0_itinerary_gallery_structural_contracts.sql.
-- Missing/ambiguous published targets fail; drafts are checked when present, as in the patch.
BEGIN TRANSACTION READ ONLY;

WITH expected(slug, needs_gallery) AS (
  VALUES ('xareni-iyarit', true), ('america-johana', true),
    ('ana-sofia-cota-guillen', true), ('abril-michelle-becerra-rea', false)
), targets AS (
  SELECT i.id, e.slug, e.needs_gallery
  FROM expected e
  JOIN public.invitations i ON i.slug = e.slug AND i.event_type = 'xv'
  WHERE i.archived_at IS NULL
), published_coverage AS (
  SELECT e.slug, count(p.invitation_project_id) AS rows
  FROM expected e
  LEFT JOIN targets t ON t.slug = e.slug
  LEFT JOIN public.published_invitation_content p
    ON p.invitation_project_id = t.id AND p.deleted_at IS NULL
  GROUP BY e.slug
), content_rows AS (
  SELECT t.needs_gallery, p.content
  FROM targets t
  JOIN public.published_invitation_content p ON p.invitation_project_id = t.id
  WHERE p.deleted_at IS NULL
  UNION ALL
  SELECT t.needs_gallery, d.content
  FROM targets t
  JOIN public.invitation_content_drafts d ON d.invitation_project_id = t.id
  WHERE d.deleted_at IS NULL
), totals AS (
  SELECT
    (SELECT count(*) FROM published_coverage WHERE rows <> 1) AS invalid_published_targets,
    count(*) AS checked_rows,
    count(*) FILTER (WHERE
      content#>>'{itinerary,variant}' IS DISTINCT FROM 'timeline-paper'
      OR content#>>'{itinerary,presentation,behavior}' IS DISTINCT FROM 'timeline-paper'
      OR (needs_gallery AND content#>>'{gallery,variant}' IS DISTINCT FROM 'index-choreography')
    ) AS mismatched_rows
  FROM content_rows
)
SELECT *, invalid_published_targets = 0 AND mismatched_rows = 0 AS ok FROM totals;

ROLLBACK;
