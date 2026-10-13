begin;
select plan(30);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('11000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'access-controls@example.test', now(), now());
insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, created_by, kind)
values
  ('21000000-0000-0000-0000-000000000001', 'access-client', 'Control de acceso', 'xv', 'in_production', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, '11000000-0000-0000-0000-000000000001', 'client'),
  ('21000000-0000-0000-0000-000000000002', 'access-demo', 'Demo de acceso', 'xv', 'published', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, '11000000-0000-0000-0000-000000000001', 'demo'),
  ('21000000-0000-0000-0000-000000000003', 'access-archived', 'Archivada', 'boda', 'in_production', 'demo-wedding-classic', 'classic', '{}'::jsonb, '11000000-0000-0000-0000-000000000001', 'client');

-- Structure and privileges.
select has_table('public', 'invitation_access_controls', 'access control table exists');
select col_is_pk('public', 'invitation_access_controls', 'invitation_id', 'one access row per invitation');
select col_default_is('public', 'invitation_access_controls', 'payment_status', 'unpaid', 'new invitations start unpaid');
select col_default_is('public', 'invitation_access_controls', 'public_access', 'enabled', 'new invitations start enabled');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.invitation_access_controls'::regclass), 'row level security is enabled and forced');
select ok(not has_table_privilege('anon', 'public.invitation_access_controls', 'SELECT'), 'anon cannot read access state');
select ok(not has_table_privilege('authenticated', 'public.invitation_access_controls', 'SELECT'), 'hosts cannot read access state');
select ok(not has_table_privilege('authenticated', 'public.invitation_access_controls', 'UPDATE'), 'hosts cannot change access state');
select ok(not has_table_privilege('authenticated', 'public.invitation_access_controls', 'INSERT'), 'hosts cannot insert access state');
select ok(has_table_privilege('service_role', 'public.invitation_access_controls', 'SELECT'), 'server can read access state');
select ok(not has_table_privilege('service_role', 'public.invitation_access_controls', 'UPDATE'), 'server writes only through the RPC');
select ok(not has_function_privilege('authenticated', 'public.set_invitation_access_control(uuid,integer,uuid,text,text,text)', 'EXECUTE'), 'hosts cannot execute the access RPC');
select ok(not has_function_privilege('anon', 'public.set_invitation_access_control(uuid,integer,uuid,text,text,text)', 'EXECUTE'), 'anon cannot execute the access RPC');
select ok(has_function_privilege('service_role', 'public.set_invitation_access_control(uuid,integer,uuid,text,text,text)', 'EXECUTE'), 'server can execute the access RPC');

-- Insert trigger: every invitation has a row, new ones unpaid and enabled.
select is(
  (select count(*) from public.invitations i
   left join public.invitation_access_controls c on c.invitation_id = i.id
   where c.invitation_id is null),
  0::bigint,
  'every invitation has an access row'
);
select results_eq(
  $$ select payment_status, public_access, version from public.invitation_access_controls where invitation_id = '21000000-0000-0000-0000-000000000001' $$,
  $$ values ('unpaid'::text, 'enabled'::text, 1) $$,
  'trigger creates the new invitation unpaid, enabled, version one'
);

-- RPC: mark paid.
select results_eq(
  $$ select (r).payment_status, (r).public_access, (r).version, (r).updated_by
     from (select public.set_invitation_access_control('21000000-0000-0000-0000-000000000001', 1, '11000000-0000-0000-0000-000000000001', 'paid', null, null) as r) s $$,
  $$ values ('paid'::text, 'enabled'::text, 2, '11000000-0000-0000-0000-000000000001'::uuid) $$,
  'marking paid bumps the version and records the actor'
);
select is(
  (select count(*) from public.audit_logs
   where action = 'set_invitation_access_control'
     and target_id = '21000000-0000-0000-0000-000000000001'
     and old_data ->> 'payment_status' = 'unpaid'
     and new_data ->> 'payment_status' = 'paid'),
  1::bigint,
  'the change is audited in the same transaction'
);
select throws_ok(
  $$ select public.set_invitation_access_control('21000000-0000-0000-0000-000000000001', 1, '11000000-0000-0000-0000-000000000001', 'unpaid', null, null) $$,
  'P0001', 'invitation_access_stale', 'a stale version is rejected'
);

-- RPC: disable with an internal note; payment changes keep the note.
select results_eq(
  $$ select (r).payment_status, (r).public_access, (r).internal_note, (r).version
     from (select public.set_invitation_access_control('21000000-0000-0000-0000-000000000001', 2, '11000000-0000-0000-0000-000000000001', null, 'disabled', 'Cliente pidió ocultarla') as r) s $$,
  $$ values ('paid'::text, 'disabled'::text, 'Cliente pidió ocultarla'::text, 3) $$,
  'disabling keeps the payment status and stores the internal note'
);
select results_eq(
  $$ select (r).payment_status, (r).public_access, (r).internal_note
     from (select public.set_invitation_access_control('21000000-0000-0000-0000-000000000001', 3, '11000000-0000-0000-0000-000000000001', 'unpaid', null, null) as r) s $$,
  $$ values ('unpaid'::text, 'disabled'::text, 'Cliente pidió ocultarla'::text) $$,
  'a payment change keeps public access and its note'
);
select results_eq(
  $$ select (r).payment_status, (r).public_access, (r).internal_note
     from (select public.set_invitation_access_control('21000000-0000-0000-0000-000000000001', 4, '11000000-0000-0000-0000-000000000001', null, 'enabled', null) as r) s $$,
  $$ values ('unpaid'::text, 'enabled'::text, null::text) $$,
  're-enabling restores the previous state and clears the note'
);

-- RPC: rejected inputs.
select throws_ok(
  $$ select public.set_invitation_access_control('21000000-0000-0000-0000-000000000001', 5, '11000000-0000-0000-0000-000000000001', null, null, null) $$,
  'P0001', 'invitation_access_no_change', 'a call without changes is rejected'
);
select throws_ok(
  $$ select public.set_invitation_access_control('21000000-0000-0000-0000-000000000001', 5, '11000000-0000-0000-0000-000000000001', 'free', null, null) $$,
  '22023', 'invitation_access_invalid_payment_status', 'an unknown payment status is rejected'
);
select throws_ok(
  $$ select public.set_invitation_access_control('21000000-0000-0000-0000-000000000001', 5, '11000000-0000-0000-0000-000000000001', null, 'hidden', null) $$,
  '22023', 'invitation_access_invalid_public_access', 'an unknown public access value is rejected'
);
select throws_ok(
  $$ select public.set_invitation_access_control('21000000-0000-0000-0000-000000000001', 5, '11000000-0000-0000-0000-000000000001', null, 'disabled', repeat('x', 281)) $$,
  '22023', 'invitation_access_note_too_long', 'an oversized internal note is rejected'
);
select throws_ok(
  $$ select public.set_invitation_access_control('21000000-0000-0000-0000-000000000002', 1, '11000000-0000-0000-0000-000000000001', 'paid', null, null) $$,
  'P0001', 'invitation_access_not_found', 'demo invitations have no commercial access state'
);

update public.invitations set archived_at = now() where id = '21000000-0000-0000-0000-000000000003';
select throws_ok(
  $$ select public.set_invitation_access_control('21000000-0000-0000-0000-000000000003', 1, '11000000-0000-0000-0000-000000000001', 'paid', null, null) $$,
  'P0001', 'invitation_access_not_found', 'archived invitations cannot be changed'
);
select is(
  (select payment_status from public.invitation_access_controls where invitation_id = '21000000-0000-0000-0000-000000000003'),
  'unpaid',
  'archiving keeps the access row for a later restore'
);

-- Permanent invitation deletion removes its access row.
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.invitation_access_controls'::regclass
    and confrelid = 'public.invitations'::regclass
    and contype = 'f'
    and confdeltype = 'c'
), 'access rows cascade with permanent invitation deletion');

select * from finish();
rollback;
