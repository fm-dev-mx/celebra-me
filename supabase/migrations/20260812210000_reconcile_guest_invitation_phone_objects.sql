-- Reconcile guest_invitations phone index name and pair CHECK.
--
-- Supported starting states:
--   Local / Preview: idx_guest_invitations_phone btree(phone) present, CHECK absent
--   Production:      idx_guest_invitations_phone_e164 btree(phone) present, CHECK present
-- Already canonical: no-op.
-- Missing both btree(phone) indexes: PHONE_RECONCILE_UNSUPPORTED.
-- Does not modify supabase_migrations history rows.

DO $reconciliation$
DECLARE
  table_oid oid;
  canonical_idx pg_catalog.pg_index%ROWTYPE;
  legacy_idx pg_catalog.pg_index%ROWTYPE;
  canonical_relname text;
  legacy_relname text;
  unexpected_name text;
  constraint_oid oid;
  constraint_def text;
  constraint_fp text;
  expected_fp constant text := 'checkphoneisnullandcountry_codeisnullorphoneisnotnullandcountry_codeisnotnull';
BEGIN
  SELECT c.oid
    INTO table_oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'guest_invitations'
    AND c.relkind = 'r';

  IF table_oid IS NULL THEN
    RAISE EXCEPTION 'PHONE_RECONCILE_UNSUPPORTED: public.guest_invitations is missing';
  END IF;

  SELECT i.relname
    INTO unexpected_name
  FROM pg_index x
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_am am ON am.oid = i.relam
  WHERE x.indrelid = table_oid
    AND x.indisunique = false
    AND x.indpred IS NULL
    AND x.indisvalid
    AND am.amname = 'btree'
    AND x.indnkeyatts = 1
    AND x.indnatts = 1
    AND (
      SELECT a.attname
      FROM pg_attribute a
      WHERE a.attrelid = table_oid AND a.attnum = x.indkey[0]
    ) = 'phone'
    AND i.relname NOT IN ('idx_guest_invitations_phone', 'idx_guest_invitations_phone_e164')
  LIMIT 1;

  IF unexpected_name IS NOT NULL THEN
    RAISE EXCEPTION 'PHONE_RECONCILE_UNSUPPORTED: unexpected btree(phone) index %', unexpected_name;
  END IF;

  SELECT x.*
    INTO canonical_idx
  FROM pg_index x
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE x.indrelid = table_oid
    AND i.relname = 'idx_guest_invitations_phone';

  IF FOUND THEN
    SELECT i.relname INTO canonical_relname FROM pg_class i WHERE i.oid = canonical_idx.indexrelid;
    IF NOT (
      canonical_idx.indisvalid
      AND NOT canonical_idx.indisunique
      AND canonical_idx.indpred IS NULL
      AND canonical_idx.indnkeyatts = 1
      AND canonical_idx.indnatts = 1
      AND (
        SELECT am.amname
        FROM pg_class idx
        JOIN pg_am am ON am.oid = idx.relam
        WHERE idx.oid = canonical_idx.indexrelid
      ) = 'btree'
      AND (
        SELECT a.attname
        FROM pg_attribute a
        WHERE a.attrelid = table_oid AND a.attnum = canonical_idx.indkey[0]
      ) = 'phone'
    ) THEN
      RAISE EXCEPTION 'PHONE_INDEX_INCOMPATIBLE: idx_guest_invitations_phone exists with an incompatible definition (%)',
        pg_get_indexdef(canonical_idx.indexrelid);
    END IF;
  ELSE
    canonical_relname := NULL;
  END IF;

  SELECT x.*
    INTO legacy_idx
  FROM pg_index x
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE x.indrelid = table_oid
    AND i.relname = 'idx_guest_invitations_phone_e164';

  IF FOUND THEN
    SELECT i.relname INTO legacy_relname FROM pg_class i WHERE i.oid = legacy_idx.indexrelid;
    IF NOT (
      legacy_idx.indisvalid
      AND NOT legacy_idx.indisunique
      AND legacy_idx.indpred IS NULL
      AND legacy_idx.indnkeyatts = 1
      AND legacy_idx.indnatts = 1
      AND (
        SELECT am.amname
        FROM pg_class idx
        JOIN pg_am am ON am.oid = idx.relam
        WHERE idx.oid = legacy_idx.indexrelid
      ) = 'btree'
      AND (
        SELECT a.attname
        FROM pg_attribute a
        WHERE a.attrelid = table_oid AND a.attnum = legacy_idx.indkey[0]
      ) = 'phone'
    ) THEN
      RAISE EXCEPTION 'PHONE_INDEX_INCOMPATIBLE: idx_guest_invitations_phone_e164 exists with an incompatible definition (%)',
        pg_get_indexdef(legacy_idx.indexrelid);
    END IF;
  ELSE
    legacy_relname := NULL;
  END IF;

  IF canonical_relname IS NOT NULL AND legacy_relname IS NOT NULL THEN
    EXECUTE 'DROP INDEX public.idx_guest_invitations_phone_e164';
  ELSIF canonical_relname IS NULL AND legacy_relname IS NOT NULL THEN
    EXECUTE 'ALTER INDEX public.idx_guest_invitations_phone_e164 RENAME TO idx_guest_invitations_phone';
  ELSIF canonical_relname IS NULL AND legacy_relname IS NULL THEN
    RAISE EXCEPTION 'PHONE_RECONCILE_UNSUPPORTED: no btree(phone) index on public.guest_invitations';
  END IF;

  SELECT c.oid, pg_get_constraintdef(c.oid)
    INTO constraint_oid, constraint_def
  FROM pg_constraint c
  WHERE c.conrelid = table_oid
    AND c.conname = 'guest_invitations_phone_country_code_pair_check';

  IF constraint_oid IS NOT NULL THEN
    constraint_fp := regexp_replace(
      regexp_replace(lower(constraint_def), '::[a-z0-9_]+', '', 'g'),
      '[()\s]',
      '',
      'g'
    );
    IF constraint_fp <> expected_fp THEN
      RAISE EXCEPTION 'PHONE_CHECK_INCOMPATIBLE: guest_invitations_phone_country_code_pair_check exists with an incompatible expression (%)',
        constraint_def;
    END IF;
  ELSE
    EXECUTE $sql$
      ALTER TABLE public.guest_invitations
      ADD CONSTRAINT guest_invitations_phone_country_code_pair_check
      CHECK (
        ((phone IS NULL) AND (country_code IS NULL))
        OR ((phone IS NOT NULL) AND (country_code IS NOT NULL))
      )
    $sql$;
  END IF;
END
$reconciliation$;
