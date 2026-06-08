-- Manual production patch: Ayrin venue location image repair.
--
-- This file is intentionally NOT part of the automatic Supabase migration chain.
-- It must be run manually only after:
-- - taking and verifying a production DB backup;
-- - verifying the target Ayrin invitation row exists exactly once;
-- - reviewing the before/after row-count notices in this script;
-- - confirming the release owner explicitly approves this one-off data repair.
--
-- Scope:
-- - exact invitation slug: ayrin-samantha-lerma-castro
-- - exact source demo lineage: demo-xv-enchanted-rose
-- - only fills missing location.ceremony.image and/or location.reception.image
-- - does not broaden to any other invitation
--
-- Icon migrations are handled by 20260608000001 and 20260608000003.

BEGIN;

CREATE TEMP TABLE _ayrin_expected_invitation
ON COMMIT DROP AS
SELECT invitation.id
FROM public.invitations AS invitation
WHERE invitation.slug = 'ayrin-samantha-lerma-castro'
  AND invitation.base_demo_id = 'demo-xv-enchanted-rose';

DO $$
DECLARE
  expected_invitation_count integer;
  published_rows_to_patch integer;
  draft_rows_to_patch integer;
BEGIN
  SELECT count(*) INTO expected_invitation_count
  FROM _ayrin_expected_invitation;

  IF expected_invitation_count <> 1 THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Expected exactly one Ayrin invitation for slug ayrin-samantha-lerma-castro and base_demo_id demo-xv-enchanted-rose, found %.',
      expected_invitation_count;
  END IF;

  SELECT count(*) INTO published_rows_to_patch
  FROM public.published_invitation_content AS content_row
  JOIN _ayrin_expected_invitation AS expected_invitation
    ON expected_invitation.id = content_row.invitation_project_id
  WHERE content_row.slug = 'ayrin-samantha-lerma-castro'
    AND content_row.content #> '{location,ceremony}' IS NOT NULL
    AND content_row.content #> '{location,reception}' IS NOT NULL
    AND (
      content_row.content #> '{location,ceremony,image}' IS NULL
      OR content_row.content #> '{location,reception,image}' IS NULL
    );

  SELECT count(*) INTO draft_rows_to_patch
  FROM public.invitation_content_drafts AS draft
  JOIN _ayrin_expected_invitation AS expected_invitation
    ON expected_invitation.id = draft.invitation_project_id
  WHERE draft.content #> '{location,ceremony}' IS NOT NULL
    AND draft.content #> '{location,reception}' IS NOT NULL
    AND (
      draft.content #> '{location,ceremony,image}' IS NULL
      OR draft.content #> '{location,reception,image}' IS NULL
    );

  RAISE NOTICE 'Ayrin location image preflight: % published row(s), % draft row(s) eligible for patch',
    published_rows_to_patch,
    draft_rows_to_patch;
END $$;

UPDATE public.published_invitation_content AS content_row
SET
  content = CASE
    WHEN content_row.content #> '{location,reception,image}' IS NULL THEN
      jsonb_set(
        CASE
          WHEN content_row.content #> '{location,ceremony,image}' IS NULL
            THEN jsonb_set(content_row.content, '{location,ceremony,image}', to_jsonb('mapCeremony'::text), true)
          ELSE content_row.content
        END,
        '{location,reception,image}',
        to_jsonb('mapReception'::text),
        true
      )
    WHEN content_row.content #> '{location,ceremony,image}' IS NULL THEN
      jsonb_set(content_row.content, '{location,ceremony,image}', to_jsonb('mapCeremony'::text), true)
    ELSE content_row.content
  END,
  updated_at = now()
FROM _ayrin_expected_invitation AS expected_invitation
WHERE content_row.invitation_project_id = expected_invitation.id
  AND content_row.content #> '{location,ceremony}' IS NOT NULL
  AND content_row.content #> '{location,reception}' IS NOT NULL
  AND (
    content_row.content #> '{location,ceremony,image}' IS NULL
    OR content_row.content #> '{location,reception,image}' IS NULL
  );

UPDATE public.invitation_content_drafts AS draft
SET
  content = CASE
    WHEN draft.content #> '{location,reception,image}' IS NULL THEN
      jsonb_set(
        CASE
          WHEN draft.content #> '{location,ceremony,image}' IS NULL
            THEN jsonb_set(draft.content, '{location,ceremony,image}', to_jsonb('mapCeremony'::text), true)
          ELSE draft.content
        END,
        '{location,reception,image}',
        to_jsonb('mapReception'::text),
        true
      )
    WHEN draft.content #> '{location,ceremony,image}' IS NULL THEN
      jsonb_set(draft.content, '{location,ceremony,image}', to_jsonb('mapCeremony'::text), true)
    ELSE draft.content
  END,
  updated_at = now()
FROM _ayrin_expected_invitation AS expected_invitation
WHERE draft.invitation_project_id = expected_invitation.id
  AND draft.content #> '{location,ceremony}' IS NOT NULL
  AND draft.content #> '{location,reception}' IS NOT NULL
  AND (
    draft.content #> '{location,ceremony,image}' IS NULL
    OR draft.content #> '{location,reception,image}' IS NULL
  );

DO $$
DECLARE
  remaining_published integer;
  remaining_draft integer;
BEGIN
  SELECT count(*) INTO remaining_published
  FROM public.published_invitation_content AS content_row
  JOIN _ayrin_expected_invitation AS expected_invitation
    ON expected_invitation.id = content_row.invitation_project_id
  WHERE content_row.slug = 'ayrin-samantha-lerma-castro'
    AND content_row.content #> '{location,ceremony}' IS NOT NULL
    AND content_row.content #> '{location,reception}' IS NOT NULL
    AND (
      content_row.content #> '{location,ceremony,image}' IS NULL
      OR content_row.content #> '{location,reception,image}' IS NULL
    );

  SELECT count(*) INTO remaining_draft
  FROM public.invitation_content_drafts AS draft
  JOIN _ayrin_expected_invitation AS expected_invitation
    ON expected_invitation.id = draft.invitation_project_id
  WHERE draft.content #> '{location,ceremony}' IS NOT NULL
    AND draft.content #> '{location,reception}' IS NOT NULL
    AND (
      draft.content #> '{location,ceremony,image}' IS NULL
      OR draft.content #> '{location,reception,image}' IS NULL
    );

  RAISE NOTICE 'Ayrin location image verification: % published row(s), % draft row(s) still missing venue images',
    remaining_published,
    remaining_draft;
END $$;

COMMIT;
