begin;
select plan(7);

-- Rehearsal of the column contract that follows the legacy-columns release: inside this
-- transaction the three legacy columns are dropped and publish_invitation_atomic is redefined
-- with only the current public-metadata baseline, then a test invitation publishes. No contract
-- migration file exists yet; the redefinition below is the draft of its publication function.
-- Everything rolls back.

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname <> 'publish_invitation_atomic'
      and p.prosrc ~ '\m(base_demo_id|submission_id)\M'),
  array['restore_invitation_from_published_atomic', 'save_invitation_metadata_atomic'],
  'besides publication, only the editor save and restore routines still write submission_id'
);

alter table public.invitations drop column base_demo_id, drop column snapshot;
alter table public.invitation_content_drafts drop column submission_id;

create or replace function public.publish_invitation_atomic(
  p_invitation_id uuid,
  p_draft_id uuid,
  p_expected_draft_updated_at timestamptz,
  p_expected_published_version integer,
  p_public_metadata_hash text,
  p_projection_hash text,
  p_idempotency_key uuid,
  p_slug text,
  p_event_type text,
  p_is_demo boolean,
  p_content jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_invitation public.invitations%rowtype;
  v_draft public.invitation_content_drafts%rowtype;
  v_published public.published_invitation_content%rowtype;
  v_linked_event public.events%rowtype;
  v_slug_event public.events%rowtype;
  v_existing public.invitation_publication_idempotency%rowtype;
  v_fingerprint text := md5(concat_ws(chr(31), p_invitation_id::text, p_draft_id::text,
    p_expected_draft_updated_at::text, coalesce(p_expected_published_version::text, '<null>'),
    p_public_metadata_hash, p_projection_hash, p_slug,
    p_event_type, p_is_demo::text, p_content::text));
  v_metadata_hash text;
  v_expected_published_content_hash text;
  v_result jsonb;
begin
  -- This lookup is deliberately before draft-status validation. A receipt is the
  -- sole authority for a retry after a lost successful response.
  select * into v_existing from public.invitation_publication_idempotency
    where idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint or v_existing.result is null then
      raise exception using errcode = 'P0001', message = 'publish_idempotency_key_reused';
    end if;
    return v_existing.result;
  end if;

  -- Lock in one order for all writers: invitation, draft, published content,
  -- then existing RSVP event rows. The idempotency insert is unique and is
  -- handled below for a simultaneous request using the same key.
  select * into v_invitation from public.invitations
    where id = p_invitation_id and archived_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'publish_invitation_not_found'; end if;
  select * into v_draft from public.invitation_content_drafts
    where id = p_draft_id and invitation_project_id = p_invitation_id and deleted_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'publish_draft_not_found'; end if;
  select * into v_published from public.published_invitation_content
    where invitation_project_id = p_invitation_id and deleted_at is null order by created_at desc limit 1 for update;

  -- A simultaneous caller can have checked the key before the first caller
  -- committed, then waited on these row locks. Re-read the receipt before any
  -- mutable-state guard so that contender replays instead of rejecting the
  -- draft that the first caller just approved.
  select * into v_existing from public.invitation_publication_idempotency
    where idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint or v_existing.result is null then
      raise exception using errcode = 'P0001', message = 'publish_idempotency_key_reused';
    end if;
    return v_existing.result;
  end if;

  -- jsonb::text has deterministic key ordering and matches the application-side
  -- PostgreSQL-jsonb formatter used to create the reviewed baseline.
  v_metadata_hash := md5(jsonb_build_object(
    'archivedAt', v_invitation.archived_at, 'eventType', v_invitation.event_type,
    'kind', v_invitation.kind, 'slug', v_invitation.slug, 'status', v_invitation.status,
    'themeId', v_invitation.theme_id, 'title', v_invitation.title
  )::text);
  v_expected_published_content_hash := md5(coalesce(v_published.content, '{}'::jsonb)::text);
  if v_draft.status <> 'draft' then raise exception using errcode = 'P0001', message = 'publish_invalid_draft_status'; end if;
  if v_draft.updated_at <> p_expected_draft_updated_at then raise exception using errcode = 'P0001', message = 'publish_stale_draft'; end if;
  if p_public_metadata_hash is distinct from md5(v_metadata_hash || chr(31) || v_expected_published_content_hash) then raise exception using errcode = 'P0001', message = 'publish_stale_public_metadata'; end if;
  if coalesce(v_published.version, -1) <> coalesce(p_expected_published_version, -1)
    or md5(coalesce(v_published.content, '{}'::jsonb)::text) <> v_expected_published_content_hash then
    raise exception using errcode = 'P0001', message = 'publish_stale_published';
  end if;
  if v_invitation.event_type <> p_event_type or (v_invitation.kind = 'demo') <> p_is_demo then
    raise exception using errcode = 'P0001', message = 'publish_public_contract_mismatch';
  end if;

  insert into public.invitation_publication_idempotency (
    idempotency_key, invitation_id, draft_id, draft_updated_at, expected_published_version,
    public_metadata_hash, projection_hash, expected_published_content_hash, slug, event_type,
    is_demo, content_hash, request_fingerprint
  ) values (
    p_idempotency_key, p_invitation_id, p_draft_id, p_expected_draft_updated_at,
    p_expected_published_version, p_public_metadata_hash, p_projection_hash,
    v_expected_published_content_hash, p_slug, p_event_type, p_is_demo, md5(p_content::text), v_fingerprint
  ) on conflict (idempotency_key) do nothing;
  if not found then
    select * into v_existing from public.invitation_publication_idempotency
      where idempotency_key = p_idempotency_key for update;
    if v_existing.request_fingerprint <> v_fingerprint or v_existing.result is null then
      raise exception using errcode = 'P0001', message = 'publish_idempotency_key_reused';
    end if;
    return v_existing.result;
  end if;

  if exists (select 1 from public.published_invitation_content where slug = p_slug and event_type = p_event_type and invitation_project_id is distinct from p_invitation_id and deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'publish_slug_conflict';
  end if;
  if not p_is_demo and v_invitation.created_by is null then raise exception using errcode = 'P0001', message = 'publish_owner_required'; end if;
  if not p_is_demo then
    select * into v_linked_event from public.events where invitation_project_id = p_invitation_id and deleted_at is null for update;
    select * into v_slug_event from public.events where slug = p_slug and deleted_at is null for update;
    if v_linked_event.id is not null and v_slug_event.id is not null and v_linked_event.id <> v_slug_event.id then raise exception using errcode = 'P0001', message = 'publish_event_slug_conflict'; end if;
    if coalesce(v_linked_event.event_type, v_slug_event.event_type) is not null and coalesce(v_linked_event.event_type, v_slug_event.event_type) <> p_event_type then raise exception using errcode = 'P0001', message = 'publish_event_type_conflict'; end if;
    if coalesce(v_linked_event.id, v_slug_event.id) is not null then
      -- An event whose RSVP was disabled (archived) stays archived: publishing content must not
      -- reopen guest confirmations. Every other status becomes published as before.
      update public.events set title = v_invitation.title, slug = p_slug,
        status = case when status = 'archived' then 'archived' else 'published' end,
        published_at = case when status = 'archived' then published_at else now() end,
        invitation_project_id = p_invitation_id
        where id = coalesce(v_linked_event.id, v_slug_event.id);
    else
      insert into public.events (owner_user_id, slug, event_type, title, status, published_at, invitation_project_id) values (v_invitation.created_by, p_slug, p_event_type, v_invitation.title, 'published', now(), p_invitation_id);
    end if;
  end if;
  if v_published.id is null then
    insert into public.published_invitation_content (invitation_project_id, slug, event_type, is_demo, content, version, published_at) values (p_invitation_id, p_slug, p_event_type, p_is_demo, p_content, 1, now()) returning * into v_published;
  else
    update public.published_invitation_content set slug = p_slug, event_type = p_event_type, is_demo = p_is_demo, content = p_content, version = v_published.version + 1, published_at = now() where id = v_published.id returning * into v_published;
  end if;
  update public.invitations set status = 'published' where id = p_invitation_id;
  update public.invitation_content_drafts set status = 'approved' where id = p_draft_id returning * into v_draft;
  v_result := jsonb_build_object(
    'draft', jsonb_build_object('id', v_draft.id, 'invitationId', v_draft.invitation_project_id, 'content', v_draft.content, 'status', v_draft.status, 'createdAt', v_draft.created_at, 'updatedAt', v_draft.updated_at),
    'publishedContent', jsonb_build_object('id', v_published.id, 'slug', v_published.slug, 'eventType', v_published.event_type, 'version', v_published.version, 'publishedAt', v_published.published_at),
    'idempotent', false
  );
  update public.invitation_publication_idempotency set result = v_result, completed_at = now() where idempotency_key = p_idempotency_key;
  return v_result;
exception when unique_violation then
  raise exception using errcode = 'P0001', message = 'publish_slug_conflict';
end;
$function$;

select hasnt_column('public', 'invitations', 'base_demo_id', 'invitations.base_demo_id is dropped');
select hasnt_column('public', 'invitations', 'snapshot', 'invitations.snapshot is dropped');
select hasnt_column('public', 'invitation_content_drafts', 'submission_id', 'invitation_content_drafts.submission_id is dropped');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('10000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'column-contract@example.test', now(), now());
insert into public.invitations (id, slug, title, event_type, status, theme_id, created_by, kind)
values ('20000000-0000-0000-0000-0000000000c1', 'column-contract', 'Contrato de columnas', 'xv', 'in_production', 'jewelry-box', '10000000-0000-0000-0000-0000000000c1', 'client');
insert into public.invitation_content_drafts (id, invitation_project_id, content, status)
values ('30000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', '{"title":"Contrato de columnas"}'::jsonb, 'draft');

select lives_ok(
  $$select public.publish_invitation_atomic(
      i.id, d.id, d.updated_at, null,
      md5(md5(jsonb_build_object('archivedAt', i.archived_at, 'eventType', i.event_type, 'kind', i.kind, 'slug', i.slug, 'status', i.status, 'themeId', i.theme_id, 'title', i.title)::text) || chr(31) || md5('{}'::jsonb::text)),
      md5(d.content::text), '40000000-0000-0000-0000-0000000000c1', i.slug, i.event_type, false, d.content)
    from public.invitations i
    join public.invitation_content_drafts d on d.invitation_project_id = i.id
    where i.id = '20000000-0000-0000-0000-0000000000c1'$$,
  'an invitation publishes with the current baseline after the columns are dropped'
);
select ok(
  exists (select 1 from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-0000000000c1' and deleted_at is null),
  'the published content is live'
);
select is(
  (select status from public.invitation_content_drafts where id = '30000000-0000-0000-0000-0000000000c1'),
  'approved',
  'the published draft is approved'
);

select * from finish();
rollback;
