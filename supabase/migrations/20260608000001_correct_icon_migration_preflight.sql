-- Corrective icon migration: migrates legacy itinerary `icon` fields into
-- canonical `iconName` values and aborts on unknown non-empty legacy values.
--
-- Why this exists:
-- - Production data may still contain legacy itinerary item fields like:
--   { "icon": "church" }
-- - The current runtime expects canonical icon names, for example:
--   { "iconName": "Church" }
-- - Unknown legacy icon values must abort instead of being silently skipped,
--   because silently leaving legacy fields can break the editor/rendering flow.

DROP TABLE IF EXISTS _legacy_itinerary_icon_map;

CREATE TEMP TABLE _legacy_itinerary_icon_map (
  legacy_value TEXT PRIMARY KEY,
  canonical_icon_name TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _legacy_itinerary_icon_map (legacy_value, canonical_icon_name)
SELECT DISTINCT ON (legacy_value)
  legacy_value,
  canonical_icon_name
FROM (
  VALUES
    ('accordion', 'Accordion'),
    ('boot', 'BootSeal'),
    ('boot-seal', 'BootSeal'),
    ('bootseal', 'BootSeal'),
    ('cake', 'Cake'),
    ('church', 'Church'),
    ('dinner', 'Dinner'),
    ('heel', 'Heel'),
    ('party', 'Party'),
    ('photo', 'Photo'),
    ('reception', 'Reception'),
    ('sparkles', 'Sparkles'),
    ('taco', 'Taco'),
    ('toast', 'Toast'),
    ('tuba', 'Tuba'),
    ('waltz', 'Waltz'),
    ('western-hat', 'WesternHat'),
    ('westernhat', 'WesternHat'),
    ('calendar', 'Calendar'),
    ('check-seal', 'CheckSeal'),
    ('checkseal', 'CheckSeal'),
    ('crown', 'Crown'),
    ('diamond', 'Diamond'),
    ('dove', 'Dove'),
    ('dresscode', 'DressCode'),
    ('dress-code', 'DressCode'),
    ('envelope', 'Enveloped'),
    ('enveloped', 'Enveloped'),
    ('flower-seal', 'FlowerSeal'),
    ('flowerseal', 'FlowerSeal'),
    ('forbidden', 'Forbidden'),
    ('gift', 'Gift'),
    ('heartbreak', 'Heartbreak'),
    ('heart-seal', 'HeartSeal'),
    ('heartseal', 'HeartSeal'),
    ('map', 'MapLocation'),
    ('map-location', 'MapLocation'),
    ('maplocation', 'MapLocation'),
    ('monogram-seal', 'MonogramSeal'),
    ('monogramseal', 'MonogramSeal'),
    ('rings', 'Rings')
) AS mappings(legacy_value, canonical_icon_name)
ORDER BY legacy_value;

-- PREFLIGHT:
-- Abort if any non-empty legacy itinerary `icon` value cannot be mapped.
DO $$
DECLARE
  unknown_record RECORD;
  unknown_values TEXT := '';
  first_loop BOOLEAN := true;
BEGIN
  FOR unknown_record IN
    WITH all_icon_values AS (
      SELECT
        'published_invitation_content'::text AS source_table,
        COALESCE(slug::text, '<missing-slug>') AS source_key,
        item->>'icon' AS icon_value,
        lower(btrim(item->>'icon')) AS normalized_icon_value
      FROM public.published_invitation_content
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(content #> '{itinerary,items}') = 'array'
            THEN content #> '{itinerary,items}'
          ELSE '[]'::jsonb
        END
      ) AS item
      WHERE item ? 'icon'
        AND NULLIF(btrim(item->>'icon'), '') IS NOT NULL

      UNION ALL

      SELECT
        'invitation_content_drafts'::text AS source_table,
        COALESCE(invitation_project_id::text, '<missing-project-id>') AS source_key,
        item->>'icon' AS icon_value,
        lower(btrim(item->>'icon')) AS normalized_icon_value
      FROM public.invitation_content_drafts
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(content #> '{itinerary,items}') = 'array'
            THEN content #> '{itinerary,items}'
          ELSE '[]'::jsonb
        END
      ) AS item
      WHERE item ? 'icon'
        AND NULLIF(btrim(item->>'icon'), '') IS NOT NULL
    )
    SELECT DISTINCT
      all_icon_values.source_table,
      all_icon_values.source_key,
      all_icon_values.icon_value
    FROM all_icon_values
    LEFT JOIN _legacy_itinerary_icon_map icon_map
      ON icon_map.legacy_value = all_icon_values.normalized_icon_value
    WHERE icon_map.legacy_value IS NULL
    ORDER BY
      all_icon_values.source_table,
      all_icon_values.source_key,
      all_icon_values.icon_value
  LOOP
    IF NOT first_loop THEN
      unknown_values := unknown_values || '; ';
    END IF;

    unknown_values :=
      unknown_values
      || unknown_record.source_table
      || '['
      || unknown_record.source_key
      || ']: '
      || unknown_record.icon_value;

    first_loop := false;
  END LOOP;

  IF unknown_values <> '' THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Unknown legacy itinerary icon values found and cannot be safely migrated: %. Migration aborted to prevent data loss. Add an explicit mapping or fix the affected content manually.',
      unknown_values;
  END IF;
END $$;

-- Migrate published invitation content.
WITH normalized_rows AS (
  SELECT
    published.ctid AS row_ctid,
    jsonb_agg(
      CASE
        WHEN item ? 'icon'
          AND NULLIF(btrim(item->>'icon'), '') IS NOT NULL
          THEN
            (item - 'icon')
            || jsonb_build_object('iconName', icon_map.canonical_icon_name)

        WHEN item ? 'icon'
          THEN item - 'icon'

        ELSE item
      END
      ORDER BY item_position
    ) AS normalized_items
  FROM public.published_invitation_content AS published
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(published.content #> '{itinerary,items}') = 'array'
        THEN published.content #> '{itinerary,items}'
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS itinerary_item(item, item_position)
  LEFT JOIN _legacy_itinerary_icon_map AS icon_map
    ON icon_map.legacy_value = lower(btrim(item->>'icon'))
  WHERE jsonb_typeof(published.content #> '{itinerary,items}') = 'array'
  GROUP BY published.ctid
)
UPDATE public.published_invitation_content AS published
SET content = jsonb_set(
  published.content,
  '{itinerary,items}',
  normalized_rows.normalized_items,
  false
)
FROM normalized_rows
WHERE published.ctid = normalized_rows.row_ctid
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(published.content #> '{itinerary,items}') AS item
    WHERE item ? 'icon'
  );

-- Migrate draft invitation content.
WITH normalized_rows AS (
  SELECT
    draft.ctid AS row_ctid,
    jsonb_agg(
      CASE
        WHEN item ? 'icon'
          AND NULLIF(btrim(item->>'icon'), '') IS NOT NULL
          THEN
            (item - 'icon')
            || jsonb_build_object('iconName', icon_map.canonical_icon_name)

        WHEN item ? 'icon'
          THEN item - 'icon'

        ELSE item
      END
      ORDER BY item_position
    ) AS normalized_items
  FROM public.invitation_content_drafts AS draft
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(draft.content #> '{itinerary,items}') = 'array'
        THEN draft.content #> '{itinerary,items}'
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS itinerary_item(item, item_position)
  LEFT JOIN _legacy_itinerary_icon_map AS icon_map
    ON icon_map.legacy_value = lower(btrim(item->>'icon'))
  WHERE jsonb_typeof(draft.content #> '{itinerary,items}') = 'array'
  GROUP BY draft.ctid
)
UPDATE public.invitation_content_drafts AS draft
SET content = jsonb_set(
  draft.content,
  '{itinerary,items}',
  normalized_rows.normalized_items,
  false
)
FROM normalized_rows
WHERE draft.ctid = normalized_rows.row_ctid
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(draft.content #> '{itinerary,items}') AS item
    WHERE item ? 'icon'
  );

DROP TABLE IF EXISTS _legacy_itinerary_icon_map;
