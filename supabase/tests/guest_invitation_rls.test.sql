-- Dashboard guest soft-delete contract on guest_invitations.
-- Client sessions keep host-scoped RLS for edits but cannot soft-delete (the
-- SELECT policy hides deleted rows). Soft delete runs through the
-- service-role-only soft_delete_guest_invitation_v1 RPC, which re-checks the
-- actor's event access.
begin;
select plan(28);

-- Runs one statement as a role with the given JWT subject and returns the
-- affected row count, or the SQLSTATE when the statement fails.
create schema guest_rls_test;
create function guest_rls_test.run_as(p_role text, p_user uuid, p_sql text)
returns text
language plpgsql
as $$
declare
  v_rows integer;
  v_result text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', p_role)::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    v_result := v_rows::text;
  exception when others then
    v_result := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return v_result;
end;
$$;

-- Calls the soft-delete RPC as service_role; returns 'true'/'false' or the SQLSTATE.
create function guest_rls_test.soft_delete(p_guest uuid, p_actor uuid)
returns text
language plpgsql
as $$
declare
  v_result text;
begin
  set local role service_role;
  begin
    v_result := public.soft_delete_guest_invitation_v1(p_guest, p_actor)::text;
  exception when others then
    v_result := sqlstate;
  end;
  reset role;
  return v_result;
end;
$$;

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('e1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-owner@example.test', now(), now()),
  ('e1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-member@example.test', now(), now()),
  ('e1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'rls-ex-member@example.test', now(), now()),
  ('e1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'rls-outsider@example.test', now(), now()),
  ('e1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'rls-admin@example.test', now(), now());

insert into public.app_user_roles (user_id, role)
values ('e1000000-0000-4000-8000-000000000005', 'super_admin');

insert into public.events (id, owner_user_id, slug, event_type, title, status, deleted_at) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'rls-owner-event', 'xv', 'RLS owner event', 'published', null),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000004', 'rls-foreign-event', 'boda', 'RLS foreign event', 'published', null),
  ('e2000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001', 'rls-deleted-event', 'xv', 'RLS deleted event', 'published', now());

insert into public.event_memberships (event_id, user_id, membership_role, deleted_at) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'manager', null),
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003', 'manager', now());

insert into public.guest_invitations (id, event_id, full_name, max_allowed_attendees) values
  ('e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'Invitado editable', 2),
  ('e3000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'Invitado del anfitrión', 2),
  ('e3000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000001', 'Invitado del colaborador', 2),
  ('e3000000-0000-4000-8000-000000000004', 'e2000000-0000-4000-8000-000000000001', 'Invitado del administrador', 2),
  ('e3000000-0000-4000-8000-000000000005', 'e2000000-0000-4000-8000-000000000001', 'Invitado protegido', 2),
  ('e3000000-0000-4000-8000-000000000007', 'e2000000-0000-4000-8000-000000000003', 'Invitado de evento eliminado', 2);

-- Privilege boundary of the RPC.
select ok(has_function_privilege('service_role', 'public.soft_delete_guest_invitation_v1(uuid,uuid)', 'EXECUTE'),
  'service role can execute the soft-delete RPC');
select ok(not has_function_privilege('authenticated', 'public.soft_delete_guest_invitation_v1(uuid,uuid)', 'EXECUTE'),
  'authenticated cannot execute the soft-delete RPC');
select ok(not has_function_privilege('anon', 'public.soft_delete_guest_invitation_v1(uuid,uuid)', 'EXECUTE'),
  'anon cannot execute the soft-delete RPC');
select ok((select prosecdef from pg_proc where oid = 'public.soft_delete_guest_invitation_v1(uuid,uuid)'::regprocedure),
  'soft-delete RPC is security definer');
select ok(not has_table_privilege('service_role', 'public.guest_invitations', 'UPDATE'),
  'service role still has no direct guest UPDATE');

-- Ordinary host edits keep working through RLS.
select is(
  guest_rls_test.run_as('authenticated', 'e1000000-0000-4000-8000-000000000001',
    $q$update public.guest_invitations set full_name = 'Invitado editado' where id = 'e3000000-0000-4000-8000-000000000001' and deleted_at is null$q$),
  '1', 'owner updates an active guest through RLS');
select is((select full_name from public.guest_invitations where id = 'e3000000-0000-4000-8000-000000000001'),
  'Invitado editado', 'owner edit is persisted');
select is(
  guest_rls_test.run_as('authenticated', 'e1000000-0000-4000-8000-000000000001',
    $q$update public.guest_invitations set event_id = 'e2000000-0000-4000-8000-000000000002' where id = 'e3000000-0000-4000-8000-000000000001'$q$),
  '42501', 'owner cannot move a guest into a foreign event');

-- Direct client soft delete stays blocked: the new row would violate the
-- SELECT policy. This documents why the application uses the RPC.
select is(
  guest_rls_test.run_as('authenticated', 'e1000000-0000-4000-8000-000000000001',
    $q$update public.guest_invitations set deleted_at = now() where id = 'e3000000-0000-4000-8000-000000000005' and deleted_at is null$q$),
  '42501', 'client session cannot soft-delete through PostgREST');
select is(
  guest_rls_test.run_as('anon', null,
    $q$update public.guest_invitations set deleted_at = now() where id = 'e3000000-0000-4000-8000-000000000005'$q$),
  '42501', 'anon has no guest update privilege');

-- Authorized actors soft-delete through the RPC.
select is(guest_rls_test.soft_delete('e3000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001'),
  'true', 'owner soft-deletes a guest');
select ok((select deleted_at is not null from public.guest_invitations where id = 'e3000000-0000-4000-8000-000000000002'),
  'owner soft delete is persisted');
select is(guest_rls_test.soft_delete('e3000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000002'),
  'true', 'active member soft-deletes a guest');
select is(guest_rls_test.soft_delete('e3000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000005'),
  'true', 'super admin soft-deletes a guest');
select is((select count(*) from public.guest_invitation_audit where guest_invitation_id = 'e3000000-0000-4000-8000-000000000002'),
  (select count(*) from public.guest_invitation_audit where guest_invitation_id = 'e3000000-0000-4000-8000-000000000005'),
  'soft delete keeps the guest audit trail unchanged');

-- Repeated and missing deletes are reported, not errors.
select is(guest_rls_test.soft_delete('e3000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001'),
  'false', 'repeating a soft delete returns false');
select is(guest_rls_test.soft_delete('e3000000-0000-4000-8000-0000000000ff', 'e1000000-0000-4000-8000-000000000001'),
  'false', 'unknown guest returns false');
select is(guest_rls_test.soft_delete(null, 'e1000000-0000-4000-8000-000000000001'),
  'P0001', 'missing guest id is rejected');
select is(guest_rls_test.soft_delete('e3000000-0000-4000-8000-000000000005', null),
  'P0001', 'missing actor is rejected');

-- The RPC enforces event access itself, independently of the BFF.
select is(guest_rls_test.soft_delete('e3000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000004'),
  '42501', 'outsider cannot soft-delete another host guest');
select is(guest_rls_test.soft_delete('e3000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000003'),
  '42501', 'removed member cannot soft-delete');
select is(guest_rls_test.soft_delete('e3000000-0000-4000-8000-000000000007', 'e1000000-0000-4000-8000-000000000001'),
  '42501', 'guests of a soft-deleted event cannot be deleted');
select ok((select deleted_at is null from public.guest_invitations where id = 'e3000000-0000-4000-8000-000000000005'),
  'denied soft deletes leave the guest active');
select ok((select deleted_at is null from public.guest_invitations where id = 'e3000000-0000-4000-8000-000000000007'),
  'guest of a soft-deleted event stays untouched');

-- Soft-deleted guests are hidden and frozen for client sessions.
select is(
  guest_rls_test.run_as('authenticated', 'e1000000-0000-4000-8000-000000000001',
    $q$select 1 from public.guest_invitations where id = 'e3000000-0000-4000-8000-000000000002'$q$),
  '0', 'soft-deleted guest is invisible to the owner');
select is(
  guest_rls_test.run_as('authenticated', 'e1000000-0000-4000-8000-000000000005',
    $q$select 1 from public.guest_invitations where id = 'e3000000-0000-4000-8000-000000000004'$q$),
  '0', 'soft-deleted guest is invisible to a super admin session');
select is(
  guest_rls_test.run_as('authenticated', 'e1000000-0000-4000-8000-000000000001',
    $q$update public.guest_invitations set deleted_at = null where id = 'e3000000-0000-4000-8000-000000000002'$q$),
  '0', 'owner cannot restore a soft-deleted guest');
select is(
  guest_rls_test.run_as('authenticated', 'e1000000-0000-4000-8000-000000000001',
    $q$update public.guest_invitations set full_name = 'Revivido' where id = 'e3000000-0000-4000-8000-000000000002'$q$),
  '0', 'owner cannot edit a soft-deleted guest');

select * from finish();
rollback;
