-- Platform usage snapshots: service-role only, typed providers, object payloads.
begin;
select plan(12);

create schema platform_snapshot_test;

create function platform_snapshot_test.as_role(p_role text, p_sql text)
returns text
language plpgsql
as $$
declare
  v_result text;
begin
  execute format('set local role %I', p_role);
  begin
    execute p_sql into v_result;
  exception when others then
    v_result := sqlstate;
  end;
  reset role;
  return v_result;
end;
$$;

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.platform_usage_snapshots'::regclass),
  'RLS is enabled and forced'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'platform_usage_snapshots'),
  0,
  'no policy grants anon or authenticated any row'
);
select ok(
  not has_table_privilege('anon', 'public.platform_usage_snapshots', 'SELECT')
  and not has_table_privilege('anon', 'public.platform_usage_snapshots', 'INSERT'),
  'anon can neither read nor write snapshots'
);
select ok(
  not has_table_privilege('authenticated', 'public.platform_usage_snapshots', 'SELECT')
  and not has_table_privilege('authenticated', 'public.platform_usage_snapshots', 'INSERT')
  and not has_table_privilege('authenticated', 'public.platform_usage_snapshots', 'DELETE'),
  'authenticated can neither read nor write snapshots'
);
select ok(
  has_table_privilege('service_role', 'public.platform_usage_snapshots', 'SELECT')
  and has_table_privilege('service_role', 'public.platform_usage_snapshots', 'INSERT')
  and has_table_privilege('service_role', 'public.platform_usage_snapshots', 'DELETE'),
  'service role reads, inserts and purges'
);
select ok(
  not has_table_privilege('service_role', 'public.platform_usage_snapshots', 'UPDATE'),
  'service role never rewrites a snapshot'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'platform_usage_snapshots'
      and indexdef like '%(collected_at)%'
  ),
  'collected_at is indexed'
);

select is(
  platform_snapshot_test.as_role('service_role', $sql$
    with inserted as (
      insert into public.platform_usage_snapshots (collected_at, provider, ok, payload) values
        (now(), 'cloudflare_workers', true, '{"totals":{"month":{"requests":10}}}'),
        (now() - interval '91 days', 'supabase_disk', false, '{"failure":"http_403"}')
      returning 1
    ) select count(*)::text from inserted
  $sql$),
  '2',
  'service role inserts snapshots'
);
select is(
  platform_snapshot_test.as_role('authenticated', 'select count(*)::text from public.platform_usage_snapshots'),
  '42501',
  'authenticated is denied reading snapshots'
);
select is(
  platform_snapshot_test.as_role('service_role', $sql$
    insert into public.platform_usage_snapshots (collected_at, provider, ok) values (now(), 'unknown_provider', true)
    returning 'inserted'
  $sql$),
  '23514',
  'an unknown provider is rejected'
);
select is(
  platform_snapshot_test.as_role('service_role', $sql$
    insert into public.platform_usage_snapshots (collected_at, provider, ok, payload) values (now(), 'cloudflare_r2', true, '[1]')
    returning 'inserted'
  $sql$),
  '23514',
  'a non-object payload is rejected'
);
select is(
  platform_snapshot_test.as_role('service_role', $sql$
    with purged as (
      delete from public.platform_usage_snapshots where collected_at < now() - interval '90 days' returning 1
    ) select count(*)::text from purged
  $sql$),
  '1',
  'the 90-day purge removes only expired rows'
);

select * from finish();
rollback;
