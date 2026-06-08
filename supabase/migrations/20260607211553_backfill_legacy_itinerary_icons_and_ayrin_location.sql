-- Isolated Ayrin repair: only the expected invitation/demo lineage and only missing venue images.
-- Icon migrations are handled by 20260608000001 and 20260608000003.

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
FROM public.invitations AS invitation
WHERE content_row.invitation_project_id = invitation.id
  AND content_row.slug = 'ayrin-samantha-lerma-castro'
  AND invitation.base_demo_id = 'demo-xv-enchanted-rose'
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
FROM public.invitations AS invitation
WHERE draft.invitation_project_id = invitation.id
  AND invitation.slug = 'ayrin-samantha-lerma-castro'
  AND invitation.base_demo_id = 'demo-xv-enchanted-rose'
  AND draft.content #> '{location,ceremony}' IS NOT NULL
  AND draft.content #> '{location,reception}' IS NOT NULL
  AND (
    draft.content #> '{location,ceremony,image}' IS NULL
    OR draft.content #> '{location,reception,image}' IS NULL
  );
