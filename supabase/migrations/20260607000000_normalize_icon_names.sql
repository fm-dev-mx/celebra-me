-- Migration: Normalize icon names in all content tables
-- Converts legacy lowercase/hyphenated icon names to canonical PascalCase

-- ============================================================================
-- HELPER: Normalize a single icon name
-- ============================================================================

CREATE OR REPLACE FUNCTION public.normalize_icon_name(icon_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF icon_name IS NULL THEN RETURN NULL; END IF;
  CASE lower(icon_name)
    WHEN 'waltz' THEN RETURN 'Waltz';
    WHEN 'dinner' THEN RETURN 'Dinner';
    WHEN 'church' THEN RETURN 'Church';
    WHEN 'reception' THEN RETURN 'Reception';
    WHEN 'cake' THEN RETURN 'Cake';
    WHEN 'party' THEN RETURN 'Party';
    WHEN 'toast' THEN RETURN 'Toast';
    WHEN 'dresscode', 'dress-code', 'dress code' THEN RETURN 'DressCode';
    WHEN 'calendar' THEN RETURN 'Calendar';
    WHEN 'gift' THEN RETURN 'Gift';
    WHEN 'photo' THEN RETURN 'Photo';
    WHEN 'rings' THEN RETURN 'Rings';
    WHEN 'dove' THEN RETURN 'Dove';
    WHEN 'crown' THEN RETURN 'Crown';
    WHEN 'diamond' THEN RETURN 'Diamond';
    WHEN 'map', 'map-location', 'map location' THEN RETURN 'MapLocation';
    WHEN 'envelope', 'enveloped' THEN RETURN 'Enveloped';
    WHEN 'boot', 'boot-seal', 'boot seal' THEN RETURN 'BootSeal';
    WHEN 'western-hat', 'westernhat', 'western hat' THEN RETURN 'WesternHat';
    WHEN 'taco' THEN RETURN 'Taco';
    WHEN 'tuba' THEN RETURN 'Tuba';
    WHEN 'accordion' THEN RETURN 'Accordion';
    WHEN 'heel' THEN RETURN 'Heel';
    WHEN 'forbidden' THEN RETURN 'Forbidden';
    WHEN 'flower-seal', 'flowerseal', 'flower seal' THEN RETURN 'FlowerSeal';
    WHEN 'heart-seal', 'heartseal', 'heart seal' THEN RETURN 'HeartSeal';
    WHEN 'monogram-seal', 'monogramseal', 'monogram seal' THEN RETURN 'MonogramSeal';
    WHEN 'check-seal', 'checkseal', 'check seal' THEN RETURN 'CheckSeal';
    WHEN 'heartbreak' THEN RETURN 'Heartbreak';
    WHEN 'sparkles' THEN RETURN 'Sparkles';
    ELSE RETURN icon_name;
  END CASE;
END;
$$;

-- ============================================================================
-- HELPER: Normalize icon_name in a JSON array at a given path
-- ============================================================================

CREATE OR REPLACE FUNCTION public._normalize_icon_array(content jsonb, path text[])
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  arr jsonb;
BEGIN
  arr := content #> path;
  IF arr IS NULL OR jsonb_typeof(arr) <> 'array' THEN RETURN content; END IF;
  SELECT jsonb_agg(
    jsonb_set(elem, '{iconName}', to_jsonb(public.normalize_icon_name(elem->>'iconName')))
  ) INTO arr
  FROM jsonb_array_elements(arr) AS elem;
  RETURN jsonb_set(content, path, arr);
END;
$$;

-- ============================================================================
-- HELPERS: Apply normalization to a table
-- ============================================================================

CREATE OR REPLACE FUNCTION public._normalize_table_icons(tbl regclass)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %s SET content = public._normalize_icon_array(content, ''{itinerary,items}''), updated_at = now() WHERE content #> ''{itinerary,items}'' IS NOT NULL AND jsonb_typeof(content #> ''{itinerary,items}'') = ''array''',
    tbl
  );
  EXECUTE format(
    'UPDATE %s SET content = public._normalize_icon_array(content, ''{location,indications}''), updated_at = now() WHERE content #> ''{location,indications}'' IS NOT NULL AND jsonb_typeof(content #> ''{location,indications}'') = ''array''',
    tbl
  );
END;
$$;

-- ============================================================================
-- APPLY MIGRATION
-- ============================================================================

SELECT public._normalize_table_icons('public.published_invitation_content');
SELECT public._normalize_table_icons('public.invitation_content_drafts');

-- ============================================================================
-- CLEANUP helpers (keep normalize_icon_name for verification queries)
-- ============================================================================

DROP FUNCTION public._normalize_table_icons(regclass);
DROP FUNCTION public._normalize_icon_array(jsonb, text[]);

COMMENT ON FUNCTION public.normalize_icon_name IS
  'Normalizes icon names from legacy lowercase format to canonical PascalCase. Used for data migration only.';
