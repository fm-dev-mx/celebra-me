-- Database size for the super-admin platform console (expand).
--
-- The Supabase Free plan caps the database size (500 MB per project; above it the database turns
-- read-only). The Management API token cannot read that figure, so the Production collector cron
-- (src/lib/platform/server/collector/) calls this function with the service role every 15 minutes
-- and stores the result as a `supabase_database` snapshot.
--
-- security definer with an empty search_path: the function reads no table and returns only one
-- number, so it runs with the owner's database CONNECT privilege whatever role calls it. Only the
-- service role may execute it.
--
-- Statement order matters for scripts/db/migration-sql-risk.ts: every created object is
-- initialized (revoke/grant) before the first non-initialization statement of the transaction.
begin;

create function public.platform_database_size()
returns bigint
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.pg_database_size(pg_catalog.current_database());
$function$;

revoke all on function public.platform_database_size() from public, anon, authenticated, service_role;
grant execute on function public.platform_database_size() to service_role;

comment on function public.platform_database_size() is
  'Size in bytes of the current database, compared against the Supabase Free plan cap by the platform console. Service role only; reads no table.';

commit;
