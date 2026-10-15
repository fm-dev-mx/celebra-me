begin;
select plan(8);

-- Exercise the installed provider constraints without creating or altering invitation records.
create temporary table provider_contract (
  provider text, provider_public_id text, secure_url text
);
do $$
declare
  constraint_name text;
  constraint_definition text;
begin
  foreach constraint_name in array array[
    'invitation_assets_provider_valid',
    'invitation_assets_cloudinary_fields_complete'
  ] loop
    select pg_get_constraintdef(oid) into strict constraint_definition
    from pg_constraint
    where conrelid = 'public.invitation_assets'::regclass
      and conname = constraint_name;
    execute format('alter table provider_contract add constraint %I ', constraint_name)
      || replace(constraint_definition, ' NOT VALID', '');
  end loop;
end;
$$;

select lives_ok($$insert into provider_contract values ('supabase', null, null)$$, 'Supabase rows need no remote identity');
select lives_ok($$insert into provider_contract values ('cloudinary', 'celebra/a', 'https://res.cloudinary.com/a.webp')$$, 'complete Cloudinary rows remain valid');
select lives_ok($$insert into provider_contract values ('r2', 'boda/a.webp', 'https://media.example.com/boda/a.webp')$$, 'complete R2 rows are accepted');
select throws_ok($$insert into provider_contract values ('r2', null, 'https://media.example.com/boda/a.webp')$$, '23514', null, 'R2 rows require an object key');
select throws_ok($$insert into provider_contract values ('r2', 'boda/a.webp', null)$$, '23514', null, 'R2 rows require a secure URL');
select throws_ok($$insert into provider_contract values ('cloudinary', null, 'https://res.cloudinary.com/a.webp')$$, '23514', null, 'Cloudinary rows still require a public ID');
select throws_ok($$insert into provider_contract values ('s3', 'boda/a.webp', 'https://media.example.com/boda/a.webp')$$, '23514', null, 'unknown providers are rejected');
select is(
  (select count(*)::integer from public.invitation_assets where provider not in ('supabase', 'cloudinary', 'r2')),
  0,
  'existing rows satisfy the widened provider set'
);

select * from finish();
rollback;
