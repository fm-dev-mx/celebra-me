begin;
select plan(9);

-- publish_invitation_atomic accepts the current public-metadata baseline (without baseDemoId and
-- snapshot) and, until the column contract, the legacy baseline the deployed application sends.
-- Either baseline still rejects a metadata edit made after it was computed, and the result no
-- longer carries the draft submissionId.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('10000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'metadata-hash@example.test', now(), now());

insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, created_by, kind)
values
  ('20000000-0000-0000-0000-0000000000b1', 'hash-current', 'Hash actual', 'xv', 'in_production', 'demo-xv-jewelry-box', 'jewelry-box', '{"previewSlug":"legacy"}'::jsonb, '10000000-0000-0000-0000-0000000000b1', 'client'),
  ('20000000-0000-0000-0000-0000000000b2', 'hash-legacy', 'Hash anterior', 'xv', 'in_production', 'demo-xv-jewelry-box', 'jewelry-box', '{"previewSlug":"legacy"}'::jsonb, '10000000-0000-0000-0000-0000000000b1', 'client'),
  ('20000000-0000-0000-0000-0000000000b3', 'hash-stale', 'Hash vencido', 'xv', 'in_production', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, '10000000-0000-0000-0000-0000000000b1', 'client');

insert into public.invitation_content_drafts (id, invitation_project_id, content, status)
values
  ('30000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-0000000000b1', '{"title":"Hash actual"}'::jsonb, 'draft'),
  ('30000000-0000-0000-0000-0000000000b2', '20000000-0000-0000-0000-0000000000b2', '{"title":"Hash anterior"}'::jsonb, 'draft'),
  ('30000000-0000-0000-0000-0000000000b3', '20000000-0000-0000-0000-0000000000b3', '{"title":"Hash vencido"}'::jsonb, 'draft');

create function pg_temp.current_metadata_hash(p_invitation_id uuid)
returns text
language sql
as $$
  select md5(md5(jsonb_build_object('archivedAt', i.archived_at, 'eventType', i.event_type, 'kind', i.kind, 'slug', i.slug, 'status', i.status, 'themeId', i.theme_id, 'title', i.title)::text) || chr(31) || md5('{}'::jsonb::text))
  from public.invitations i where i.id = p_invitation_id;
$$;

create function pg_temp.legacy_metadata_hash(p_invitation_id uuid)
returns text
language sql
as $$
  select md5(md5(jsonb_build_object('archivedAt', i.archived_at, 'baseDemoId', i.base_demo_id, 'eventType', i.event_type, 'kind', i.kind, 'slug', i.slug, 'snapshot', i.snapshot, 'status', i.status, 'themeId', i.theme_id, 'title', i.title)::text) || chr(31) || md5('{}'::jsonb::text))
  from public.invitations i where i.id = p_invitation_id;
$$;

-- First publication of an invitation with an explicit public-metadata baseline.
create function pg_temp.publish_with_hash(p_invitation_id uuid, p_metadata_hash text, p_idempotency_key uuid)
returns jsonb
language sql
as $$
  select public.publish_invitation_atomic(
    i.id, d.id, d.updated_at, null, p_metadata_hash, md5(d.content::text),
    p_idempotency_key, i.slug, i.event_type, false, d.content
  )
  from public.invitations i
  join public.invitation_content_drafts d on d.invitation_project_id = i.id
  where i.id = p_invitation_id;
$$;

select isnt(
  pg_temp.current_metadata_hash('20000000-0000-0000-0000-0000000000b1'),
  pg_temp.legacy_metadata_hash('20000000-0000-0000-0000-0000000000b1'),
  'the current and legacy baselines differ for the same invitation'
);

select lives_ok(
  $$select pg_temp.publish_with_hash('20000000-0000-0000-0000-0000000000b1', pg_temp.current_metadata_hash('20000000-0000-0000-0000-0000000000b1'), '40000000-0000-0000-0000-0000000000b1')$$,
  'publication accepts the current baseline without baseDemoId and snapshot'
);
select is(
  (select result -> 'draft' ? 'submissionId' from public.invitation_publication_idempotency where idempotency_key = '40000000-0000-0000-0000-0000000000b1'),
  false,
  'the publication result no longer includes submissionId'
);
select ok(
  exists (select 1 from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-0000000000b1' and deleted_at is null),
  'content published with the current baseline is live'
);

select lives_ok(
  $$select pg_temp.publish_with_hash('20000000-0000-0000-0000-0000000000b2', pg_temp.legacy_metadata_hash('20000000-0000-0000-0000-0000000000b2'), '40000000-0000-0000-0000-0000000000b2')$$,
  'publication still accepts the legacy baseline sent by the deployed application'
);
select ok(
  exists (select 1 from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-0000000000b2' and deleted_at is null),
  'content published with the legacy baseline is live'
);

-- Both baselines are computed first, then a public field changes before the publication.
create temporary table stale_hashes on commit drop as
  select pg_temp.current_metadata_hash('20000000-0000-0000-0000-0000000000b3') as current_hash,
         pg_temp.legacy_metadata_hash('20000000-0000-0000-0000-0000000000b3') as legacy_hash;
update public.invitations set title = 'Título cambiado' where id = '20000000-0000-0000-0000-0000000000b3';

select throws_ok(
  $$select pg_temp.publish_with_hash('20000000-0000-0000-0000-0000000000b3', (select current_hash from stale_hashes), '40000000-0000-0000-0000-0000000000b3')$$,
  'P0001', 'publish_stale_public_metadata',
  'a stale current baseline is rejected'
);
select throws_ok(
  $$select pg_temp.publish_with_hash('20000000-0000-0000-0000-0000000000b3', (select legacy_hash from stale_hashes), '40000000-0000-0000-0000-0000000000b4')$$,
  'P0001', 'publish_stale_public_metadata',
  'a stale legacy baseline is rejected'
);
select throws_ok(
  $$select pg_temp.publish_with_hash('20000000-0000-0000-0000-0000000000b3', md5('not a baseline'), '40000000-0000-0000-0000-0000000000b5')$$,
  'P0001', 'publish_stale_public_metadata',
  'an unrelated hash is rejected'
);

select * from finish();
rollback;
