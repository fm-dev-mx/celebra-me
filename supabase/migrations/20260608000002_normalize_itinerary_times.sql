-- Normalize all event time fields to canonical 24-hour HH:mm format.
-- Time fields normalized: itinerary.items[].time, location.ceremony.time, location.reception.time
--
-- Preflight guard: if any time field contains a non-empty value that cannot be parsed
-- as either HH:mm or h:mm AM/PM, the migration aborts with a detailed error.

DO $$
DECLARE
  bad_record RECORD;
  bad_values TEXT := '';
  first_loop BOOLEAN := true;
BEGIN
  FOR bad_record IN
    WITH itinerary_times AS (
      SELECT 'published_invitation_content' AS source_table, slug,
             'itinerary.items[' || idx - 1 || '].time' AS field_path,
             item->>'time' AS time_value
      FROM public.published_invitation_content,
           jsonb_array_elements(content #> '{itinerary,items}') WITH ORDINALITY AS itinerary_item(item, idx)
      WHERE content #> '{itinerary,items}' IS NOT NULL
        AND jsonb_typeof(content #> '{itinerary,items}') = 'array'
        AND item->>'time' IS NOT NULL AND item->>'time' <> ''
    UNION ALL
      SELECT 'invitation_content_drafts' AS source_table,
             invitation_project_id::text AS slug,
             'itinerary.items[' || idx - 1 || '].time' AS field_path,
             item->>'time' AS time_value
      FROM public.invitation_content_drafts,
           jsonb_array_elements(content #> '{itinerary,items}') WITH ORDINALITY AS itinerary_item(item, idx)
      WHERE content #> '{itinerary,items}' IS NOT NULL
        AND jsonb_typeof(content #> '{itinerary,items}') = 'array'
        AND item->>'time' IS NOT NULL AND item->>'time' <> ''
    UNION ALL
      SELECT 'published_invitation_content' AS source_table, slug,
             'location.ceremony.time' AS field_path,
             content #>> '{location,ceremony,time}' AS time_value
      FROM public.published_invitation_content
      WHERE content #> '{location,ceremony}' IS NOT NULL
        AND content #>> '{location,ceremony,time}' IS NOT NULL
        AND content #>> '{location,ceremony,time}' <> ''
    UNION ALL
      SELECT 'published_invitation_content' AS source_table, slug,
             'location.reception.time' AS field_path,
             content #>> '{location,reception,time}' AS time_value
      FROM public.published_invitation_content
      WHERE content #> '{location,reception}' IS NOT NULL
        AND content #>> '{location,reception,time}' IS NOT NULL
        AND content #>> '{location,reception,time}' <> ''
    UNION ALL
       SELECT 'invitation_content_drafts' AS source_table,
              invitation_project_id::text AS slug,
              'location.ceremony.time' AS field_path,
              content #>> '{location,ceremony,time}' AS time_value
       FROM public.invitation_content_drafts
       WHERE content #> '{location,ceremony}' IS NOT NULL
         AND content #>> '{location,ceremony,time}' IS NOT NULL
         AND content #>> '{location,ceremony,time}' <> ''
     UNION ALL
       SELECT 'invitation_content_drafts' AS source_table,
              invitation_project_id::text AS slug,
              'location.reception.time' AS field_path,
              content #>> '{location,reception,time}' AS time_value
       FROM public.invitation_content_drafts
       WHERE content #> '{location,reception}' IS NOT NULL
         AND content #>> '{location,reception,time}' IS NOT NULL
         AND content #>> '{location,reception,time}' <> ''
    ),
    invalid_times AS (
      SELECT source_table, slug, field_path, time_value
      FROM itinerary_times t
      WHERE t.time_value !~ E'^(\\d{2}:\\d{2})$'
        AND t.time_value !~* E'^(\\d{1,2}:\\d{2})\\s*[AP]\\.?M\\.?$'
    )
    SELECT source_table, slug, field_path, time_value
    FROM invalid_times
    ORDER BY source_table, slug, field_path
  LOOP
    IF NOT first_loop THEN
      bad_values := bad_values || '; ';
    END IF;
    bad_values := bad_values || bad_record.source_table || ' ' || bad_record.slug || ' ' || bad_record.field_path || ': "' || bad_record.time_value || '"';
    first_loop := false;
  END LOOP;

  IF bad_values <> '' THEN
    RAISE EXCEPTION 'PREFLIGHT_ABORT: Unparseable time values found that cannot be safely normalized: %. Migration aborted. Please fix these values manually before migrating.', bad_values;
  END IF;
END $$;

-- Parse 12-hour time string to hours and minutes
CREATE OR REPLACE FUNCTION public._parse_12h_time(time_str text)
RETURNS INTEGER[] AS $$
DECLARE
  m TEXT[];
  hours INTEGER;
  minutes INTEGER;
  period TEXT;
BEGIN
  m := regexp_match(time_str, E'^(\\d{1,2}):(\\d{2})\\s*([AP]\\.?M\\.?)$', 'i');
  IF m IS NULL THEN RETURN NULL; END IF;

  hours := CAST(m[1] AS INTEGER);
  minutes := CAST(m[2] AS INTEGER);
  period := UPPER(REGEXP_REPLACE(m[3], '\\.', '', 'g'));

  IF hours < 1 OR hours > 12 THEN RETURN NULL; END IF;
  IF minutes < 0 OR minutes > 59 THEN RETURN NULL; END IF;

  IF period = 'PM' THEN
    IF hours != 12 THEN hours := hours + 12; END IF;
  ELSE
    IF hours = 12 THEN hours := 0; END IF;
  END IF;

  RETURN ARRAY[hours, minutes];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Convert a time string (HH:mm or h:mm AM/PM) to canonical HH:mm format
CREATE OR REPLACE FUNCTION public._normalize_time_str(time_str text)
RETURNS text AS $$
DECLARE
  h24_m TEXT[];
  h12_i INTEGER[];
BEGIN
  IF time_str IS NULL OR time_str = '' THEN RETURN NULL; END IF;

  -- Try 24-hour format first (HH:mm)
  IF time_str ~ E'^\\d{2}:\\d{2}$' THEN
    IF SUBSTRING(time_str FROM 1 FOR 2)::INTEGER > 23 THEN RETURN NULL; END IF;
    IF SUBSTRING(time_str FROM 4 FOR 2)::INTEGER > 59 THEN RETURN NULL; END IF;
    RETURN time_str;
  END IF;

  -- Try 12-hour format (h:mm AM/PM)
  h12_i := public._parse_12h_time(time_str);
  IF h12_i IS NOT NULL THEN
    RETURN LPAD(h12_i[1]::TEXT, 2, '0') || ':' || LPAD(h12_i[2]::TEXT, 2, '0');
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Normalize itinerary item times in a JSONB object
CREATE OR REPLACE FUNCTION public._normalize_itinerary_times(content jsonb)
RETURNS jsonb AS $$
DECLARE
  items jsonb;
BEGIN
  IF content #> '{itinerary,items}' IS NULL
    OR jsonb_typeof(content #> '{itinerary,items}') <> 'array'
  THEN
    RETURN content;
  END IF;

  SELECT jsonb_agg(
    CASE
      WHEN elem->>'time' IS NOT NULL AND elem->>'time' <> '' THEN
        jsonb_set(elem, '{time}', to_jsonb(public._normalize_time_str(elem->>'time')))
      ELSE elem
    END
    ORDER BY ord
  )
  INTO items
  FROM jsonb_array_elements(content #> '{itinerary,items}') WITH ORDINALITY AS item(elem, ord);

  RETURN jsonb_set(content, '{itinerary,items}', COALESCE(items, '[]'::jsonb), false);
END;
$$ LANGUAGE plpgsql;

-- Normalize venue times (ceremony and reception)
CREATE OR REPLACE FUNCTION public._normalize_venue_times(content jsonb)
RETURNS jsonb AS $$
BEGIN
  IF content #> '{location,ceremony,time}' IS NOT NULL
     AND content #>> '{location,ceremony,time}' <> ''
  THEN
    content := jsonb_set(
      content,
      '{location,ceremony,time}',
      to_jsonb(public._normalize_time_str(content #>> '{location,ceremony,time}'))
    );
  END IF;

  IF content #> '{location,reception,time}' IS NOT NULL
     AND content #>> '{location,reception,time}' <> ''
  THEN
    content := jsonb_set(
      content,
      '{location,reception,time}',
      to_jsonb(public._normalize_time_str(content #>> '{location,reception,time}'))
    );
  END IF;

  RETURN content;
END;
$$ LANGUAGE plpgsql;

-- Apply normalization to published_invitation_content
UPDATE public.published_invitation_content
SET content = public._normalize_venue_times(public._normalize_itinerary_times(content)),
    updated_at = now()
WHERE content #> '{itinerary,items}' IS NOT NULL
   OR content #> '{location,ceremony,time}' IS NOT NULL
   OR content #> '{location,reception,time}' IS NOT NULL;

-- Apply normalization to invitation_content_drafts
UPDATE public.invitation_content_drafts
SET content = public._normalize_venue_times(public._normalize_itinerary_times(content)),
    updated_at = now()
WHERE content #> '{itinerary,items}' IS NOT NULL
   OR content #> '{location,ceremony,time}' IS NOT NULL
   OR content #> '{location,reception,time}' IS NOT NULL;

-- Cleanup helper functions
DROP FUNCTION IF EXISTS public._normalize_itinerary_times(jsonb);
DROP FUNCTION IF EXISTS public._normalize_venue_times(jsonb);
DROP FUNCTION IF EXISTS public._normalize_time_str(text);
DROP FUNCTION IF EXISTS public._parse_12h_time(text);
