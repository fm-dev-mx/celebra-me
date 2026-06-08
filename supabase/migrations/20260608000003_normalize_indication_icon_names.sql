-- Normalize location.indications[].iconName values to canonical icon names.
-- Covers published_invitation_content and invitation_content_drafts.
-- Uses the existing public.normalize_icon_name() function for mapping.

DO $$
DECLARE
  updated_pub INTEGER;
  updated_draft INTEGER;
BEGIN
  WITH indication_items AS (
    SELECT p.ctid,
           jsonb_agg(
             CASE
               WHEN (e->>'iconName') IS NOT NULL
                    AND public.normalize_icon_name(e->>'iconName') IS DISTINCT FROM (e->>'iconName')
                 THEN jsonb_set(e, '{iconName}', to_jsonb(public.normalize_icon_name(e->>'iconName')), true)
               ELSE e
             END
             ORDER BY ord
           ) AS normalized_indications
    FROM public.published_invitation_content p,
         jsonb_array_elements(p.content #> '{location,indications}') WITH ORDINALITY AS ie(e, ord)
    WHERE p.content #> '{location,indications}' IS NOT NULL
      AND jsonb_typeof(p.content #> '{location,indications}') = 'array'
    GROUP BY p.ctid
  )
  UPDATE public.published_invitation_content p
  SET content = jsonb_set(p.content, '{location,indications}', i.normalized_indications, false),
      updated_at = now()
  FROM indication_items i
  WHERE p.ctid = i.ctid;

  GET DIAGNOSTICS updated_pub = ROW_COUNT;

  WITH indication_items AS (
    SELECT d.ctid,
           jsonb_agg(
             CASE
               WHEN (e->>'iconName') IS NOT NULL
                    AND public.normalize_icon_name(e->>'iconName') IS DISTINCT FROM (e->>'iconName')
                 THEN jsonb_set(e, '{iconName}', to_jsonb(public.normalize_icon_name(e->>'iconName')), true)
               ELSE e
             END
             ORDER BY ord
           ) AS normalized_indications
    FROM public.invitation_content_drafts d,
         jsonb_array_elements(d.content #> '{location,indications}') WITH ORDINALITY AS ie(e, ord)
    WHERE d.content #> '{location,indications}' IS NOT NULL
      AND jsonb_typeof(d.content #> '{location,indications}') = 'array'
    GROUP BY d.ctid
  )
  UPDATE public.invitation_content_drafts d
  SET content = jsonb_set(d.content, '{location,indications}', i.normalized_indications, false),
      updated_at = now()
  FROM indication_items i
  WHERE d.ctid = i.ctid;

  GET DIAGNOSTICS updated_draft = ROW_COUNT;

  RAISE NOTICE 'location.indications iconName normalization: % published, % drafts updated', updated_pub, updated_draft;
END $$;
