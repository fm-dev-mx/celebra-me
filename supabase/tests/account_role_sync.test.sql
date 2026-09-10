-- Role assignment must preserve password state and never grant event membership.
begin;
select plan(5);
insert into auth.users (id, email, raw_app_meta_data)
values ('cccccccc-1111-4111-8111-000000000001', 'role-sync@example.test',
  '{"must_change_password":true,"fixture_marker":"preserved"}'::jsonb);
insert into public.app_user_roles (user_id, role)
values ('cccccccc-1111-4111-8111-000000000001', 'host_client');
select is((select raw_app_meta_data->>'role' from auth.users where id='cccccccc-1111-4111-8111-000000000001'),
  'host_client', 'inserting canonical role synchronizes Auth');
update public.app_user_roles set role='super_admin' where user_id='cccccccc-1111-4111-8111-000000000001';
select is((select raw_app_meta_data->>'role' from auth.users where id='cccccccc-1111-4111-8111-000000000001'),
  'super_admin', 'updating canonical role synchronizes Auth');
select is((select raw_app_meta_data->>'must_change_password' from auth.users where id='cccccccc-1111-4111-8111-000000000001'),
  'true', 'password change requirement survives role writes');
select is((select raw_app_meta_data->>'fixture_marker' from auth.users where id='cccccccc-1111-4111-8111-000000000001'),
  'preserved', 'unrelated metadata survives role writes');
select is((select count(*) from public.event_memberships where user_id='cccccccc-1111-4111-8111-000000000001'),
  0::bigint, 'role assignment does not create event membership');
select * from finish();
rollback;
