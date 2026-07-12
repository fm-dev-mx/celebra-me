-- Fix: replace partial unique index on idempotency_key with a full unique index.
--
-- Root cause: idx_sales_orders_idempotency_key_unique was created with
--   WHERE idempotency_key IS NOT NULL
-- PostgreSQL cannot infer partial indexes for PostgREST ON CONFLICT (col),
-- because the conflict target does not carry the matching predicate.
-- This caused error 42P10 on every order-creation attempt.
--
-- The partial index is safe to replace: PostgreSQL already allows unlimited
-- NULL values in a regular (non-partial) UNIQUE index, so existing legacy
-- orders with NULL idempotency_key remain unblocked.
--
-- Steps:
--   1. Document that non-null key uniqueness was always the intent.
--   2. Drop the partial index.
--   3. Recreate as a plain UNIQUE index on (idempotency_key).

begin;

-- 1. Safety check: verify no duplicate non-null keys exist before tightening.
--    If duplicates exist, the new unique index would fail to create.
--    SELECT here documents the check; any row returned blocks the migration.
do $$
begin
  if exists (
    select 1
    from public.sales_orders
    where idempotency_key is not null
    group by idempotency_key
    having count(*) > 1
  ) then
    raise exception
      'Duplicate non-null idempotency_key values detected. '
      'Resolve duplicates before applying this migration.';
  end if;
end;
$$;

-- 2. Drop the partial index (safe: idempotency_key column remains).
drop index if exists public.idx_sales_orders_idempotency_key_unique;

-- 3. Recreate as a non-partial unique index.
--    PostgREST ON CONFLICT (idempotency_key) can now infer this index.
--    Multiple NULLs remain allowed.
create unique index idx_sales_orders_idempotency_key_unique
  on public.sales_orders (idempotency_key);

commit;
