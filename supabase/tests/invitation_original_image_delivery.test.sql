begin;
select plan(8);

-- Exercise the installed constraint without creating or altering invitation records.
create temporary table original_image_contract (
  validation_version integer, mime_type text, width integer, height integer,
  file_size integer, original_mime_type text, original_file_size integer
);
do $$
declare constraint_definition text;
begin
  select pg_get_constraintdef(oid) into strict constraint_definition
  from pg_constraint
  where conrelid = 'public.invitation_assets'::regclass
    and conname = 'invitation_assets_validated_metadata_complete';
  execute 'alter table original_image_contract add constraint delivery_metadata ' || constraint_definition;
end;
$$;

select lives_ok($$insert into original_image_contract values (1, 'image/webp', 1200, 800, 50000, 'image/jpeg', 90000)$$, 'normalized WebP remains valid');
select lives_ok($$insert into original_image_contract values (3, 'image/jpeg', 1200, 800, 50000, 'image/jpeg', 50000)$$, 'validated original JPEG is accepted');
select lives_ok($$insert into original_image_contract values (4, 'image/png', 1200, 800, 50000, 'image/png', 50000)$$, 'role-validated original PNG is accepted');
select throws_ok($$insert into original_image_contract values (1, 'image/jpeg', 1200, 800, 50000, 'image/jpeg', 50000)$$, '23514', null, 'legacy policy cannot claim original JPEG validation');
select throws_ok($$insert into original_image_contract values (3, 'image/gif', 1200, 800, 50000, 'image/gif', 50000)$$, '23514', null, 'unsupported original MIME is rejected');
select throws_ok($$insert into original_image_contract values (3, 'image/jpeg', null, 800, 50000, 'image/jpeg', 50000)$$, '23514', null, 'original metadata remains required');
select throws_ok($$insert into original_image_contract values (3, 'image/jpeg', 1200, 800, 50000, 'image/jpeg', 40000)$$, '23514', null, 'original byte length must be preserved');
select throws_ok($$insert into original_image_contract values (3, 'image/jpeg', 1200, 800, 50000, 'image/png', 50000)$$, '23514', null, 'original MIME must be preserved');

select * from finish();
rollback;
