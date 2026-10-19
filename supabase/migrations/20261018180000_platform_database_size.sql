-- Database size for the super-admin platform console.
-- The Supabase Free plan caps the database size (500 MB per project; above it
-- the database turns read-only). The Management API token cannot read that
-- figure without SQL access to every table, so this function returns only the
-- size of the current database, for the service role only.
-- security invoker: pg_database_size needs CONNECT, which service_role holds.

begin;

create or replace function public.platform_database_size()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.pg_database_size(pg_catalog.current_database());
$$;

revoke execute on function public.platform_database_size() from public, anon, authenticated;
grant execute on function public.platform_database_size() to service_role;

comment on function public.platform_database_size() is
  'Size in bytes of the current database, compared against the Supabase Free plan cap by the platform console. Service role only; reads no table.';

commit;
