-- Read-only verification that event_memory_items object keys follow the key contract in
-- src/lib/memories/contract/object-key.ts: originals are events/<uuid>/<uuid>.<ext> with the
-- extension the MIME policy assigns, thumbnails are events/<uuid>/thumbs/<uuid>.webp, both
-- case-insensitive. Rows whose object was deleted are skipped. Prints totals only; never keys.
BEGIN TRANSACTION READ ONLY;

WITH mime_extension(mime_type, extension) AS (
  VALUES ('image/jpeg', 'jpg'), ('image/png', 'png'), ('image/webp', 'webp'),
    ('image/heic', 'heic'), ('image/heif', 'heif'), ('video/mp4', 'mp4'),
    ('video/quicktime', 'mov')
), uuid_pattern(value) AS (
  VALUES ('[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}')
), items AS (
  SELECT i.event_id, i.object_key, i.thumbnail_object_key, m.extension
  FROM public.event_memory_items i
  LEFT JOIN mime_extension m ON m.mime_type = lower(btrim(i.mime_type))
  WHERE i.object_deleted_at IS NULL
), totals AS (
  SELECT
    count(*) AS checked_items,
    count(*) FILTER (WHERE extension IS NULL) AS unsupported_mime,
    count(*) FILTER (WHERE
      extension IS NULL
      OR object_key !~* ('^events/' || u.value || '/' || u.value || '\.' || extension || '$')
    ) AS invalid_original_keys,
    count(*) FILTER (WHERE
      thumbnail_object_key IS NOT NULL
      AND thumbnail_object_key !~* ('^events/' || u.value || '/thumbs/' || u.value || '\.webp$')
    ) AS invalid_thumbnail_keys,
    -- Informational: keys whose event segment differs from the row's event_id.
    count(*) FILTER (WHERE
      lower(split_part(object_key, '/', 2)) IS DISTINCT FROM lower(event_id::text)
    ) AS event_id_mismatch
  FROM items CROSS JOIN uuid_pattern u
)
SELECT *, invalid_original_keys = 0 AND invalid_thumbnail_keys = 0 AS ok FROM totals;

ROLLBACK;
