-- Contract: drops the legacy invitation columns base_demo_id and snapshot (invitations) and
-- submission_id (invitation_content_drafts). Apply only after the Production deployment that
-- claims legacy_invitation_columns_retired_client passed smoke; that application neither reads
-- the columns nor hashes baseDemoId/snapshot into the publication public-metadata baseline.
-- publish_invitation_atomic accepts only the current baseline
-- (archivedAt, eventType, kind, slug, status, themeId, title); the legacy baseline accepted by
-- 20261014150000 is retired. save_invitation_metadata_atomic and
-- restore_invitation_from_published_atomic insert reopened drafts without submission_id.
-- Signatures, security modes, search_path, grants, lock order and replay receipts are unchanged.

begin;

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

revoke all on function public.publish_invitation_atomic(uuid,uuid,timestamptz,integer,text,text,uuid,text,text,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.publish_invitation_atomic(uuid,uuid,timestamptz,integer,text,text,uuid,text,text,boolean,jsonb) to service_role;

create or replace function public.save_invitation_metadata_atomic(
  p_operation_id uuid,
  p_invitation_id uuid,
  p_expected_invitation_updated_at timestamptz,
  p_expected_draft_updated_at timestamptz,
  p_metadata jsonb,
  p_reopen_draft boolean,
  p_draft_content jsonb,
  p_environment text,
  p_project_ref text,
  p_actor_id uuid,
  p_actor_type text,
  p_origin text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_invitation public.invitations%rowtype;
  v_draft public.invitation_content_drafts%rowtype;
  v_receipt public.invitation_mutation_operation_receipts%rowtype;
  v_invitation_locked boolean := false;
  v_fingerprint text := md5(concat_ws(chr(31), p_invitation_id::text,
    p_expected_invitation_updated_at::text, coalesce(p_expected_draft_updated_at::text, '<null>'),
    p_metadata::text, p_reopen_draft::text, coalesce(p_draft_content::text, '<null>')));
  v_result jsonb;
begin
  select * into v_invitation from public.invitations
    where id = p_invitation_id and archived_at is null for update;
  v_invitation_locked := found;

  select * into v_receipt from public.invitation_mutation_operation_receipts
    where operation_id = p_operation_id;
  if found then
    if v_receipt.command_kind <> 'save_editor_metadata'
      or v_receipt.input_hashes->>'fingerprint' <> v_fingerprint
      or v_receipt.status not in ('applied', 'replayed') then
      raise exception using errcode = 'P0001', message = 'editor_operation_id_reused';
    end if;
    return v_receipt.result || jsonb_build_object('idempotent', true);
  end if;

  if not v_invitation_locked then
    raise exception using errcode = 'P0001', message = 'editor_invitation_not_found';
  end if;

  select * into v_draft from public.invitation_content_drafts
    where invitation_project_id = p_invitation_id and deleted_at is null
    order by created_at desc limit 1 for update;

  if v_invitation.updated_at <> p_expected_invitation_updated_at then
    raise exception using errcode = 'P0001', message = 'editor_stale_invitation';
  end if;
  if p_reopen_draft and (v_draft.id is not null) <> (p_expected_draft_updated_at is not null) then
    raise exception using errcode = 'P0001', message = 'editor_stale_draft';
  end if;
  if p_reopen_draft and v_draft.id is not null and v_draft.updated_at <> p_expected_draft_updated_at then
    raise exception using errcode = 'P0001', message = 'editor_stale_draft';
  end if;

  update public.invitations set
    title = p_metadata->>'title',
    slug = nullif(p_metadata->>'slug', ''),
    status = p_metadata->>'status',
    client_name = coalesce(p_metadata->>'clientName', ''),
    client_email = coalesce(p_metadata->>'clientEmail', ''),
    client_whatsapp = coalesce(p_metadata->>'clientWhatsapp', ''),
    photos_received = coalesce((p_metadata->>'photosReceived')::boolean, false)
  where id = p_invitation_id returning * into v_invitation;

  if p_reopen_draft then
    if v_draft.id is null then
      insert into public.invitation_content_drafts
        (invitation_project_id, content, status)
      values (p_invitation_id, p_draft_content, 'draft') returning * into v_draft;
    else
      update public.invitation_content_drafts set content = p_draft_content, status = 'draft'
        where id = v_draft.id returning * into v_draft;
    end if;
  end if;

  v_result := jsonb_build_object(
    'invitationUpdatedAt', v_invitation.updated_at,
    'draftId', v_draft.id,
    'draftUpdatedAt', v_draft.updated_at,
    'draftStatus', v_draft.status,
    'idempotent', false
  );
  insert into public.invitation_mutation_operation_receipts (
    operation_id, invitation_id, environment, project_ref, actor_id, actor_type, origin,
    command_kind, input_hashes, expected_state, status, completed_steps, result
  ) values (
    p_operation_id, p_invitation_id, p_environment, p_project_ref, p_actor_id,
    p_actor_type, p_origin, 'save_editor_metadata', jsonb_build_object('fingerprint', v_fingerprint),
    jsonb_build_object('invitationUpdatedAt', p_expected_invitation_updated_at,
      'draftUpdatedAt', p_expected_draft_updated_at), 'applied',
    case when p_reopen_draft then array['invitation_metadata_saved', 'draft_reopened']
      else array['invitation_metadata_saved'] end,
    v_result
  );
  return v_result;
exception when unique_violation then
  raise exception using errcode = 'P0001', message = 'editor_slug_conflict';
end;
$function$;

create or replace function public.restore_invitation_from_published_atomic(
  p_operation_id uuid,
  p_invitation_id uuid,
  p_expected_invitation_updated_at timestamptz,
  p_expected_draft_updated_at timestamptz,
  p_expected_published_id uuid,
  p_expected_published_version integer,
  p_draft_content jsonb,
  p_environment text,
  p_project_ref text,
  p_actor_id uuid,
  p_actor_type text,
  p_origin text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_invitation public.invitations%rowtype;
  v_draft public.invitation_content_drafts%rowtype;
  v_published public.published_invitation_content%rowtype;
  v_receipt public.invitation_mutation_operation_receipts%rowtype;
  v_invitation_locked boolean := false;
  v_fingerprint text := md5(concat_ws(chr(31), p_invitation_id::text,
    p_expected_invitation_updated_at::text, coalesce(p_expected_draft_updated_at::text, '<null>'),
    p_expected_published_id::text, p_expected_published_version::text, p_draft_content::text));
  v_result jsonb;
begin
  select * into v_invitation from public.invitations
    where id = p_invitation_id and archived_at is null for update;
  v_invitation_locked := found;

  select * into v_receipt from public.invitation_mutation_operation_receipts
    where operation_id = p_operation_id;
  if found then
    if v_receipt.command_kind <> 'restore_from_published'
      or v_receipt.input_hashes->>'fingerprint' <> v_fingerprint
      or v_receipt.status not in ('applied', 'replayed') then
      raise exception using errcode = 'P0001', message = 'editor_operation_id_reused';
    end if;
    return v_receipt.result || jsonb_build_object('idempotent', true);
  end if;

  if not v_invitation_locked then
    raise exception using errcode = 'P0001', message = 'editor_invitation_not_found';
  end if;

  select * into v_draft from public.invitation_content_drafts
    where invitation_project_id = p_invitation_id and deleted_at is null
    order by created_at desc limit 1 for update;
  select * into v_published from public.published_invitation_content
    where id = p_expected_published_id and invitation_project_id = p_invitation_id
      and deleted_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'editor_stale_published'; end if;

  if v_invitation.updated_at <> p_expected_invitation_updated_at then
    raise exception using errcode = 'P0001', message = 'editor_stale_invitation';
  end if;
  if (v_draft.id is not null) <> (p_expected_draft_updated_at is not null)
    or (v_draft.id is not null and v_draft.updated_at <> p_expected_draft_updated_at) then
    raise exception using errcode = 'P0001', message = 'editor_stale_draft';
  end if;
  if v_published.version <> p_expected_published_version then
    raise exception using errcode = 'P0001', message = 'editor_stale_published';
  end if;

  update public.invitations set
    title = coalesce(v_published.content->>'title', v_invitation.title),
    slug = v_published.slug
  where id = p_invitation_id returning * into v_invitation;
  if v_draft.id is null then
    insert into public.invitation_content_drafts
      (invitation_project_id, content, status)
    values (p_invitation_id, p_draft_content, 'draft') returning * into v_draft;
  else
    update public.invitation_content_drafts set content = p_draft_content, status = 'draft'
      where id = v_draft.id returning * into v_draft;
  end if;

  v_result := jsonb_build_object(
    'invitationUpdatedAt', v_invitation.updated_at,
    'draftId', v_draft.id,
    'draftUpdatedAt', v_draft.updated_at,
    'draftStatus', v_draft.status,
    'publishedId', v_published.id,
    'publishedVersion', v_published.version,
    'idempotent', false
  );
  insert into public.invitation_mutation_operation_receipts (
    operation_id, invitation_id, environment, project_ref, actor_id, actor_type, origin,
    command_kind, input_hashes, expected_state, status, completed_steps, result
  ) values (
    p_operation_id, p_invitation_id, p_environment, p_project_ref, p_actor_id,
    p_actor_type, p_origin, 'restore_from_published', jsonb_build_object('fingerprint', v_fingerprint),
    jsonb_build_object('invitationUpdatedAt', p_expected_invitation_updated_at,
      'draftUpdatedAt', p_expected_draft_updated_at, 'publishedId', p_expected_published_id,
      'publishedVersion', p_expected_published_version), 'applied',
    array['invitation_metadata_restored', 'draft_restored'], v_result
  );
  return v_result;
end;
$function$;

revoke all on function public.save_invitation_metadata_atomic(uuid,uuid,timestamptz,timestamptz,jsonb,boolean,jsonb,text,text,uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.restore_invitation_from_published_atomic(uuid,uuid,timestamptz,timestamptz,uuid,integer,jsonb,text,text,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.save_invitation_metadata_atomic(uuid,uuid,timestamptz,timestamptz,jsonb,boolean,jsonb,text,text,uuid,text,text)
  to service_role;
grant execute on function public.restore_invitation_from_published_atomic(uuid,uuid,timestamptz,timestamptz,uuid,integer,jsonb,text,text,uuid,text,text)
  to service_role;

alter table public.invitations drop column base_demo_id, drop column snapshot;
alter table public.invitation_content_drafts drop column submission_id;

commit;
