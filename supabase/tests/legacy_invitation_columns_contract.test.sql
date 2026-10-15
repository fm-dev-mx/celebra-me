begin;
select plan(9);

-- After the column contract, invitations no longer carry base_demo_id or snapshot and drafts no
-- longer carry submission_id. No public routine names them, and publication, the metadata reopen
-- and the restore from published content still create and publish drafts without them.

select hasnt_column('public', 'invitations', 'base_demo_id', 'invitations.base_demo_id is dropped');
select hasnt_column('public', 'invitations', 'snapshot', 'invitations.snapshot is dropped');
select hasnt_column('public', 'invitation_content_drafts', 'submission_id', 'invitation_content_drafts.submission_id is dropped');
select is(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc ~ '\m(base_demo_id|submission_id|baseDemoId|submissionId)\M'),
  0::bigint,
  'no public routine names the dropped columns'
);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('10000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'column-contract@example.test', now(), now());
insert into public.invitations (id, slug, title, event_type, status, theme_id, created_by, kind)
values
  ('20000000-0000-0000-0000-0000000000c1', 'column-contract', 'Contrato de columnas', 'xv', 'in_production', 'jewelry-box', '10000000-0000-0000-0000-0000000000c1', 'client'),
  ('20000000-0000-0000-0000-0000000000c2', 'column-contract-reopen', 'Reapertura', 'xv', 'published', 'jewelry-box', '10000000-0000-0000-0000-0000000000c1', 'client'),
  ('20000000-0000-0000-0000-0000000000c3', 'column-contract-restore', 'Restauración', 'xv', 'published', 'jewelry-box', '10000000-0000-0000-0000-0000000000c1', 'client');
insert into public.invitation_content_drafts (id, invitation_project_id, content, status)
values ('30000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', '{"title":"Contrato de columnas"}'::jsonb, 'draft');

select lives_ok(
  $$select public.publish_invitation_atomic(
      i.id, d.id, d.updated_at, null,
      md5(md5(jsonb_build_object('archivedAt', i.archived_at, 'eventType', i.event_type, 'kind', i.kind, 'slug', i.slug, 'status', i.status, 'themeId', i.theme_id, 'title', i.title)::text) || chr(31) || md5('{}'::jsonb::text)),
      md5(d.content::text), '40000000-0000-0000-0000-0000000000c1', i.slug, i.event_type, false, d.content
    )
    from public.invitations i
    join public.invitation_content_drafts d on d.invitation_project_id = i.id
    where i.id = '20000000-0000-0000-0000-0000000000c1'$$,
  'a test invitation publishes with the current baseline after the columns are dropped'
);
select ok(
  exists (select 1 from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-0000000000c1' and deleted_at is null),
  'the published content is live'
);

-- An invitation without a draft: the metadata reopen inserts a new draft.
select lives_ok(
  $$select public.save_invitation_metadata_atomic(
      '60000000-0000-0000-0000-0000000000c2', i.id, i.updated_at, null,
      '{"title":"Reapertura editada","slug":"column-contract-reopen","status":"published","clientName":"","clientEmail":"","clientWhatsapp":"","photosReceived":false}'::jsonb,
      true, '{"title":"Reapertura editada"}'::jsonb, 'local', 'local-test',
      '10000000-0000-0000-0000-0000000000c1', 'admin', 'editor'
    )
    from public.invitations i where i.id = '20000000-0000-0000-0000-0000000000c2'$$,
  'the metadata reopen inserts a draft without submission_id'
);

-- A published invitation without a draft: the restore inserts a new draft.
insert into public.published_invitation_content (id, invitation_project_id, slug, event_type, is_demo, content, version, published_at)
values ('50000000-0000-0000-0000-0000000000c3', '20000000-0000-0000-0000-0000000000c3', 'column-contract-restore', 'xv', false, '{"title":"Restauración"}'::jsonb, 1, now());
select lives_ok(
  $$select public.restore_invitation_from_published_atomic(
      '70000000-0000-0000-0000-0000000000c1', i.id, i.updated_at, null, p.id, p.version,
      p.content, 'local', 'local-test', '10000000-0000-0000-0000-0000000000c1', 'admin', 'editor'
    )
    from public.invitations i
    join public.published_invitation_content p on p.invitation_project_id = i.id and p.deleted_at is null
    where i.id = '20000000-0000-0000-0000-0000000000c3'$$,
  'the restore from published content inserts a draft without submission_id'
);
select is(
  (select count(*) from public.invitation_content_drafts
    where invitation_project_id in ('20000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c3')
      and deleted_at is null and status = 'draft'),
  2::bigint,
  'both inserted drafts are live'
);

select * from finish();
rollback;
