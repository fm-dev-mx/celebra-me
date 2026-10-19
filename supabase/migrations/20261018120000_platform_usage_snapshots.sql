-- Platform usage snapshots (expand). Written every 15 minutes by the Production Worker cron
-- (src/lib/platform/server/collector/) and read by the super-admin platform console.
--
-- One row per provider dataset per collector run. Payloads hold account-wide aggregates only
-- (request counts, CPU quantiles, object counts, storage bytes, 404 paths); never guest data,
-- secrets or raw provider bodies. A failed dataset is a row with ok = false and a typed failure
-- code. The same cron deletes rows older than 90 days.
--
-- RLS is forced and no policy exists: anon and authenticated have no access; only the service
-- role reads, inserts and purges.
--
-- Statement order matters for scripts/db/migration-sql-risk.ts: every created object is
-- initialized (revoke/grant) before the first non-initialization statement of the transaction.
begin;

create table public.platform_usage_snapshots (
  id bigint generated always as identity primary key,
  collected_at timestamptz not null,
  provider text not null,
  ok boolean not null,
  payload jsonb not null default '{}'::jsonb,
  constraint platform_usage_snapshots_provider_valid check (
    provider in (
      'cloudflare_workers',
      'cloudflare_durable_objects',
      'cloudflare_r2',
      'cloudflare_zone',
      'supabase_disk',
      'supabase_database'
    )
  ),
  constraint platform_usage_snapshots_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint platform_usage_snapshots_payload_size check (pg_column_size(payload) <= 65536)
);

revoke all on table public.platform_usage_snapshots from public, anon, authenticated, service_role;
alter table public.platform_usage_snapshots enable row level security;
alter table public.platform_usage_snapshots force row level security;
grant select, insert, delete on table public.platform_usage_snapshots to service_role;

create index platform_usage_snapshots_collected_at_idx
  on public.platform_usage_snapshots (collected_at);

comment on table public.platform_usage_snapshots is
  'Platform usage snapshots per provider dataset, collected every 15 minutes by the Production Worker and kept 90 days (aggregates only, no guest data or secrets). Service role only.';

commit;
