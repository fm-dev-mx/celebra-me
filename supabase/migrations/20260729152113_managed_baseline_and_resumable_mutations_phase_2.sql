begin;

alter table public.managed_invitation_release_provenance
  add column applied_operation_id uuid,
  add column applied_published_version integer,
  add column applied_published_projection_hash text;

alter table public.managed_invitation_release_provenance
  add constraint managed_provenance_applied_version_positive
    check (applied_published_version is null or applied_published_version > 0),
  add constraint managed_provenance_published_hash_shape
    check (
      applied_published_projection_hash is null
      or applied_published_projection_hash ~ '^[a-f0-9]{32}$'
    );

create unique index managed_provenance_applied_operation_unique
  on public.managed_invitation_release_provenance (applied_operation_id)
  where applied_operation_id is not null;

comment on column public.managed_invitation_release_provenance.applied_operation_id is
  'Operation receipt identity that durably proves the managed ancestor was fully applied.';
comment on column public.managed_invitation_release_provenance.applied_published_version is
  'Published version verified by the managed operation; mismatch fails baseline verification closed.';
comment on column public.managed_invitation_release_provenance.applied_published_projection_hash is
  'Canonical publication projection hash verified by the managed operation.';

alter table public.invitation_assets
  add column managed_by_definition_slug text,
  add column managed_source_key text,
  add column managed_sha256 text,
  add column managed_operation_id uuid;

alter table public.invitation_assets
  add constraint invitation_assets_managed_fields_coherent check (
    (managed_by_definition_slug is null and managed_source_key is null and managed_sha256 is null and managed_operation_id is null)
    or
    (
      managed_by_definition_slug is not null
      and managed_source_key is not null
      and managed_sha256 ~ '^[a-f0-9]{64}$'
      and managed_operation_id is not null
    )
  );

create unique index invitation_assets_managed_source_key_unique
  on public.invitation_assets (invitation_id, managed_by_definition_slug, managed_source_key)
  where deleted_at is null and managed_by_definition_slug is not null;

comment on column public.invitation_assets.managed_by_definition_slug is
  'Explicit managed ownership marker; null means target-owned/unmanaged and cannot be pruned by package absence.';
comment on column public.invitation_assets.managed_source_key is
  'Stable semantic asset key within the owning invitation definition.';
comment on column public.invitation_assets.managed_operation_id is
  'Managed operation that most recently verified the binary and metadata identity.';

-- Atomic editor commands deliberately touch only invitation metadata, editable
-- draft state, and the append-only receipt table. RSVP tables are out of scope.
create function public.save_invitation_metadata_atomic(
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
  v_fingerprint text := md5(concat_ws(chr(31), p_invitation_id::text,
    p_expected_invitation_updated_at::text, coalesce(p_expected_draft_updated_at::text, '<null>'),
    p_metadata::text, p_reopen_draft::text, coalesce(p_draft_content::text, '<null>')));
  v_result jsonb;
begin
  select * into v_receipt from public.invitation_mutation_operation_receipts
    where operation_id = p_operation_id for share;
  if found then
    if v_receipt.command_kind <> 'save_editor_metadata'
      or v_receipt.input_hashes->>'fingerprint' <> v_fingerprint
      or v_receipt.status not in ('applied', 'replayed') then
      raise exception using errcode = 'P0001', message = 'editor_operation_id_reused';
    end if;
    return v_receipt.result || jsonb_build_object('idempotent', true);
  end if;

  select * into v_invitation from public.invitations
    where id = p_invitation_id and archived_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'editor_invitation_not_found'; end if;

  select * into v_draft from public.invitation_content_drafts
    where invitation_project_id = p_invitation_id and deleted_at is null
    order by created_at desc limit 1 for update;

  -- A contender can have waited on the invitation lock after its first receipt lookup.
  select * into v_receipt from public.invitation_mutation_operation_receipts
    where operation_id = p_operation_id for share;
  if found then
    if v_receipt.command_kind <> 'save_editor_metadata'
      or v_receipt.input_hashes->>'fingerprint' <> v_fingerprint
      or v_receipt.status not in ('applied', 'replayed') then
      raise exception using errcode = 'P0001', message = 'editor_operation_id_reused';
    end if;
    return v_receipt.result || jsonb_build_object('idempotent', true);
  end if;

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
        (invitation_project_id, submission_id, content, status)
      values (p_invitation_id, null, p_draft_content, 'draft') returning * into v_draft;
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

create function public.restore_invitation_from_published_atomic(
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
  v_fingerprint text := md5(concat_ws(chr(31), p_invitation_id::text,
    p_expected_invitation_updated_at::text, coalesce(p_expected_draft_updated_at::text, '<null>'),
    p_expected_published_id::text, p_expected_published_version::text, p_draft_content::text));
  v_result jsonb;
begin
  select * into v_receipt from public.invitation_mutation_operation_receipts
    where operation_id = p_operation_id for share;
  if found then
    if v_receipt.command_kind <> 'restore_from_published'
      or v_receipt.input_hashes->>'fingerprint' <> v_fingerprint
      or v_receipt.status not in ('applied', 'replayed') then
      raise exception using errcode = 'P0001', message = 'editor_operation_id_reused';
    end if;
    return v_receipt.result || jsonb_build_object('idempotent', true);
  end if;

  select * into v_invitation from public.invitations
    where id = p_invitation_id and archived_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'editor_invitation_not_found'; end if;
  select * into v_draft from public.invitation_content_drafts
    where invitation_project_id = p_invitation_id and deleted_at is null
    order by created_at desc limit 1 for update;
  select * into v_published from public.published_invitation_content
    where id = p_expected_published_id and invitation_project_id = p_invitation_id
      and deleted_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'editor_stale_published'; end if;

  select * into v_receipt from public.invitation_mutation_operation_receipts
    where operation_id = p_operation_id for share;
  if found then
    if v_receipt.command_kind <> 'restore_from_published'
      or v_receipt.input_hashes->>'fingerprint' <> v_fingerprint
      or v_receipt.status not in ('applied', 'replayed') then
      raise exception using errcode = 'P0001', message = 'editor_operation_id_reused';
    end if;
    return v_receipt.result || jsonb_build_object('idempotent', true);
  end if;

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
      (invitation_project_id, submission_id, content, status)
    values (p_invitation_id, null, p_draft_content, 'draft') returning * into v_draft;
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

commit;
