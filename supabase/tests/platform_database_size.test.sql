-- Platform database size: service-role only definer function returning the database size.
begin;
select plan(7);

create schema platform_size_test;

create function platform_size_test.as_role(p_role text, p_sql text)
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
  (select prosecdef from pg_proc where oid = 'public.platform_database_size()'::regprocedure),
  'the function is security definer'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.platform_database_size()'::regprocedure),
  'the function pins an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.platform_database_size()', 'EXECUTE'),
  'anon cannot execute it'
);
select ok(
  not has_function_privilege('authenticated', 'public.platform_database_size()', 'EXECUTE'),
  'authenticated cannot execute it'
);
select ok(
  has_function_privilege('service_role', 'public.platform_database_size()', 'EXECUTE'),
  'service role executes it'
);
select is(
  platform_size_test.as_role(
    'service_role',
    $sql$ select (public.platform_database_size() = pg_database_size(current_database()))::text $sql$
  ),
  'true',
  'service role reads the current database size'
);
select is(
  platform_size_test.as_role('service_role', $sql$
    insert into public.platform_usage_snapshots (collected_at, provider, ok, payload)
    values (now(), 'supabase_database', true, '{"usedBytes":1}')
    returning 'inserted'
  $sql$),
  'inserted',
  'supabase_database snapshots are accepted'
);

select * from finish();
rollback;
