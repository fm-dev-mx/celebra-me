-- Read-only verification of 20260812_p0_itinerary_gallery_structural_contracts.sql.
-- Missing/ambiguous published targets fail; drafts are checked when present, as in the patch.
-- It also checks the content shape every reader assumes (invitation.service.ts and
-- invitation-access.repository.ts read content->rsvp, content->eventTiming and
-- content->hero->>date by path) across all live published content and active drafts.
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
), all_content AS (
  SELECT 'published' AS source, p.is_demo, p.content
  FROM public.published_invitation_content p
  WHERE p.deleted_at IS NULL
  UNION ALL
  SELECT 'draft' AS source, NULL::boolean AS is_demo, d.content
  FROM public.invitation_content_drafts d
  WHERE d.deleted_at IS NULL
), shape_totals AS (
  SELECT
    count(*) AS shape_checked_rows,
    count(*) FILTER (WHERE jsonb_typeof(content) IS DISTINCT FROM 'object') AS content_not_object,
    count(*) FILTER (WHERE content ? 'rsvp'
      AND jsonb_typeof(content->'rsvp') NOT IN ('object', 'null')) AS rsvp_not_object,
    count(*) FILTER (WHERE content ? 'eventTiming'
      AND jsonb_typeof(content->'eventTiming') NOT IN ('object', 'null')) AS event_timing_not_object,
    count(*) FILTER (WHERE content ? 'hero'
      AND jsonb_typeof(content->'hero') NOT IN ('object', 'null')) AS hero_not_object,
    -- Same derivation the app uses (eventTiming first, then the legacy hero.date).
    count(*) FILTER (WHERE source = 'published' AND NOT is_demo
      AND jsonb_typeof(content) = 'object'
      AND public.invitation_event_date(content) IS NULL) AS client_published_without_event_date
  FROM all_content
)
SELECT *,
  invalid_published_targets = 0
    AND mismatched_rows = 0
    AND content_not_object = 0
    AND rsvp_not_object = 0
    AND event_timing_not_object = 0
    AND hero_not_object = 0
    AND client_published_without_event_date = 0 AS ok
FROM totals CROSS JOIN shape_totals;

ROLLBACK;
