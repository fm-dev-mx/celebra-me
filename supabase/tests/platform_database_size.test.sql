-- Platform database size: service-role only, invoker rights, a single number.
begin;
select plan(6);

create schema platform_db_size_test;

create function platform_db_size_test.as_role(p_role text, p_sql text)
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
  not (select prosecdef from pg_proc where oid = 'public.platform_database_size()'::regprocedure),
  'runs with the caller''s rights, not as definer'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.platform_database_size()'::regprocedure),
  'pins an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.platform_database_size()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.platform_database_size()', 'EXECUTE'),
  'anon and authenticated cannot execute it'
);
select ok(
  has_function_privilege('service_role', 'public.platform_database_size()', 'EXECUTE'),
  'service role can execute it'
);
select ok(
  platform_db_size_test.as_role('service_role', 'select public.platform_database_size()::text')::bigint > 0,
  'service role reads a positive size'
);
select is(
  platform_db_size_test.as_role('authenticated', 'select public.platform_database_size()::text'),
  '42501',
  'authenticated is denied'
);

select * from finish();
rollback;
