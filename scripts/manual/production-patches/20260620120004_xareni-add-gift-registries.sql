-- ============================================================================
-- Patch: Add grouped Amazon and Liverpool gift registries to Xareni Iyarit's
--        published invitation content.
--
-- This patch replaces the previous three-card gifts section with a two-card
-- layout that uses a single store-type gift item with two registry links plus
-- the preserved "Lluvia de sobres" cash option.
--
-- Only run this against PRODUCTION after:
--   1. Taking and verifying a production DB backup
--   2. Running the preflight script and confirming expected state
--   3. Reviewing and approving this patch
--
-- Requires: PROD_DB_URL environment variable or secret file
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PREFLIGHT
-- ============================================================================
DO $$
DECLARE
  v_pub_count integer;
  v_title text;
  v_item_count integer;
  v_item_0_type text;
BEGIN
  SELECT count(*) INTO v_pub_count
  FROM public.published_invitation_content
  WHERE slug = 'xareni-iyarit'
    AND event_type = 'xv'
    AND is_demo = false
    AND deleted_at IS NULL;

  IF v_pub_count <> 1 THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Expected 1 published row for xareni-iyarit, found %', v_pub_count;
  END IF;

  SELECT
    content #>> '{gifts,title}',
    jsonb_array_length(content -> 'gifts' -> 'items'),
    content #>> '{gifts,items,0,type}'
  INTO v_title, v_item_count, v_item_0_type
  FROM public.published_invitation_content
  WHERE slug = 'xareni-iyarit'
    AND event_type = 'xv'
    AND is_demo = false
    AND deleted_at IS NULL;

  IF v_title IS DISTINCT FROM 'Mesa de regalos' THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Expected gifts.title = "Mesa de regalos", got "%"', v_title;
  END IF;

  IF v_item_count IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Expected 3 gift items, found %', v_item_count;
  END IF;

  IF v_item_0_type IS DISTINCT FROM 'store' THEN
    RAISE EXCEPTION
      'PREFLIGHT_ABORT: Expected item[0].type = "store", got "%"', v_item_0_type;
  END IF;

  RAISE NOTICE
    'Preflight OK: 1 row, gifts.title="%", items=%, item[0].type=%',
    v_title, v_item_count, v_item_0_type;
END $$;

-- ============================================================================
-- 2. PATCH published_invitation_content
--    Replace gifts.title, gifts.subtitle, and the full gifts.items array.
-- ============================================================================
UPDATE public.published_invitation_content
SET
  content = jsonb_set(
    jsonb_set(
      jsonb_set(
        content,
        '{gifts,title}',
        '"Regalos"',
        false
      ),
      '{gifts,subtitle}',
      '"Tu presencia es mi mejor regalo. Si deseas tener un detalle conmigo, te comparto estas opciones:"',
      false
    ),
    '{gifts,items}',
    '[
      {"type":"store","title":"Mesa de regalos","description":"Puedes consultar mis listas de regalos en Amazon y Liverpool.","links":[{"label":"Amazon","url":"https://www.amazon.com.mx/registries/gl/guest-view/9ZB19QOMLJ45"},{"label":"Liverpool","url":"https://mesaderegalos.liverpool.com.mx/milistaderegalos/52015693"}]},
      {"type":"cash","title":"Lluvia de sobres","text":"También contaremos con un espacio especial durante la recepción."}
    ]'::jsonb,
    false
  ),
  version = version + 1,
  updated_at = now()
WHERE slug = 'xareni-iyarit'
  AND event_type = 'xv'
  AND is_demo = false
  AND deleted_at IS NULL;

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================
SELECT
  content -> 'gifts' ->> 'title' AS gifts_title,
  content -> 'gifts' ->> 'subtitle' AS gifts_subtitle,
  jsonb_array_length(content -> 'gifts' -> 'items') AS items_count,
  content -> 'gifts' -> 'items' -> 0 ->> 'type' AS item_0_type,
  content -> 'gifts' -> 'items' -> 0 ->> 'title' AS item_0_title,
  content -> 'gifts' -> 'items' -> 0 -> 'links' AS item_0_links,
  content -> 'gifts' -> 'items' -> 1 ->> 'type' AS item_1_type,
  content -> 'gifts' -> 'items' -> 1 ->> 'title' AS item_1_title,
  content -> 'gifts' -> 'items' -> 1 ->> 'text' AS item_1_text,
  version,
  updated_at
FROM public.published_invitation_content
WHERE slug = 'xareni-iyarit'
  AND event_type = 'xv'
  AND is_demo = false
  AND deleted_at IS NULL;

COMMIT;
