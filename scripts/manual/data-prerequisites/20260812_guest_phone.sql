-- Verify the resulting objects, not just the history of migration 20260812210000.
BEGIN TRANSACTION READ ONLY;

WITH target AS (
  SELECT c.oid
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'guest_invitations' AND c.relkind = 'r'
), indexes AS (
  SELECT i.relname,
    x.indisvalid AND NOT x.indisunique AND x.indpred IS NULL
      AND am.amname = 'btree' AND x.indnkeyatts = 1 AND x.indnatts = 1
      AND a.attname = 'phone' AS compatible
  FROM target t
  JOIN pg_catalog.pg_index x ON x.indrelid = t.oid
  JOIN pg_catalog.pg_class i ON i.oid = x.indexrelid
  JOIN pg_catalog.pg_am am ON am.oid = i.relam
  LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.indkey[0]
), totals AS (
  SELECT
    (SELECT count(*) FROM target) AS target_tables,
    (SELECT count(*) FROM indexes
      WHERE relname = 'idx_guest_invitations_phone' AND compatible) AS canonical_indexes,
    (SELECT count(*) FROM indexes
      WHERE relname = 'idx_guest_invitations_phone_e164'
        OR (compatible AND relname <> 'idx_guest_invitations_phone')) AS unexpected_indexes,
    (SELECT count(*) FROM target t
      JOIN pg_catalog.pg_constraint c ON c.conrelid = t.oid
      WHERE c.conname = 'guest_invitations_phone_country_code_pair_check'
        AND c.contype = 'c' AND c.convalidated
        AND regexp_replace(
          regexp_replace(lower(pg_catalog.pg_get_constraintdef(c.oid)), '::[a-z0-9_]+', '', 'g'),
          '[()\s]', '', 'g'
        ) = 'checkphoneisnullandcountry_codeisnullorphoneisnotnullandcountry_codeisnotnull'
    ) AS validated_pair_checks
)
SELECT *, target_tables = 1 AND canonical_indexes = 1 AND unexpected_indexes = 0
  AND validated_pair_checks = 1 AS ok FROM totals;

ROLLBACK;
