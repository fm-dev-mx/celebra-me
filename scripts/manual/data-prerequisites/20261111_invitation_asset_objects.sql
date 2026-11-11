-- Read-only verification that every live Supabase-hosted invitation_assets row has its object in
-- storage.objects (bucket_id = bucket, name = storage_path). R2 rows are out of scope: a
-- storage.objects join cannot see them. Prints totals only; never paths or URLs.
BEGIN TRANSACTION READ ONLY;

WITH live_assets AS (
  SELECT a.bucket, a.storage_path
  FROM public.invitation_assets a
  WHERE a.deleted_at IS NULL
    AND lower(coalesce(a.provider, 'supabase')) = 'supabase'
), totals AS (
  SELECT
    count(*) AS checked_assets,
    count(*) FILTER (WHERE bucket IS DISTINCT FROM 'invitation-assets') AS unexpected_bucket,
    count(*) FILTER (WHERE storage_path IS NULL OR btrim(storage_path) = '') AS missing_storage_path,
    count(*) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = live_assets.bucket AND o.name = live_assets.storage_path
    )) AS missing_objects
  FROM live_assets
)
SELECT *, missing_storage_path = 0 AND missing_objects = 0 AS ok FROM totals;

ROLLBACK;
