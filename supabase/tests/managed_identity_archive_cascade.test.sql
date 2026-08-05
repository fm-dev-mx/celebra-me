-- pgTAP: managed identity uniqueness + archive cascade (incl. intake_submissions)

begin;
select plan(9);

select has_column('public', 'invitations', 'managed_identity_id',
  'invitations.managed_identity_id exists');
select has_column('public', 'managed_invitation_release_provenance', 'managed_identity_id',
  'provenance.managed_identity_id exists');
select has_column('public', 'managed_invitation_release_provenance', 'previous_slugs',
  'provenance.previous_slugs exists');

insert into public.invitations (
  id, slug, title, event_type, status, base_demo_id, theme_id, kind, created_by, managed_identity_id
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
  'archive-cascade-fixture',
  'Archive Cascade Fixture',
  'boda',
  'draft',
  'demo-boda-jewelry-box-wedding',
  'jewelry-box-wedding',
  'client',
  (select id from auth.users limit 1),
  'aaaaaaaa-bbbb-4ccc-8ddd-0000000000aa'
);

insert into public.events (
  id, owner_user_id, slug, event_type, title, status, invitation_project_id
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
  (select created_by from public.invitations where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'),
  'archive-cascade-fixture',
  'boda',
  'Archive Cascade Fixture',
  'draft',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'
);

insert into public.intake_requests (
  id, invitation_project_id, token_hash, status
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
  'cascade-fixture-token-hash',
  'active'
);

insert into public.intake_submissions (
  id, intake_request_id, status, block_data
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000004',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
  'submitted',
  '{}'::jsonb
);

select public.archive_invitation('aaaaaaaa-bbbb-4ccc-8ddd-000000000001'::uuid);

select ok(
  (select archived_at is not null from public.invitations where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'),
  'archive_invitation sets archived_at'
);

select is(
  (select count(*)::int from public.events
    where invitation_project_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'
      and deleted_at is null),
  0,
  'archive cascade deactivates linked events'
);

select is(
  (select count(*)::int from public.intake_submissions
    where intake_request_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003'
      and deleted_at is null),
  0,
  'archive cascade deactivates intake_submissions'
);

select throws_like(
  $$update public.events
    set deleted_at = null, status = 'draft'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002'$$,
  '%ARCHIVED_PARENT_ACTIVE_CHILD%',
  'cannot reactivate event child of archived invitation'
);

select throws_like(
  $$update public.intake_submissions
    set deleted_at = null
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000004'$$,
  '%ARCHIVED_PARENT_ACTIVE_CHILD%',
  'cannot reactivate intake_submission of archived invitation'
);

select throws_like(
  $$update public.invitations
    set managed_identity_id = 'bbbbbbbb-bbbb-4ccc-8ddd-0000000000bb'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'$$,
  '%MANAGED_IDENTITY_IMMUTABLE%',
  'managed_identity_id is immutable once set'
);

select * from finish();
rollback;
