begin;

-- A durable receipt makes the one-time legacy adoption replay-safe at the
-- database boundary. It is intentionally separate from normal publications.
create table if not exists public.managed_invitation_legacy_adoption_receipts (
  adoption_identity text primary key,
  invitation_id uuid not null references public.invitations(id) on delete restrict,
  slug text not null,
  package_hash text not null check (package_hash ~ '^[a-f0-9]{64}$'),
  manifest_hash text not null check (manifest_hash ~ '^[a-f0-9]{64}$'),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  result jsonb not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create index if not exists managed_invitation_legacy_adoption_receipts_invitation_idx
  on public.managed_invitation_legacy_adoption_receipts (invitation_id, created_at desc);

alter table public.managed_invitation_legacy_adoption_receipts enable row level security;
revoke all on table public.managed_invitation_legacy_adoption_receipts
  from public, anon, authenticated, service_role;
grant select, insert on table public.managed_invitation_legacy_adoption_receipts to service_role;

alter table public.managed_invitation_release_provenance
  add column if not exists adoption_manifest_hash text,
  add column if not exists adoption_identity text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'managed_release_prov_adopt_manifest_chk'
      and conrelid = 'public.managed_invitation_release_provenance'::regclass
  ) then
    alter table public.managed_invitation_release_provenance
      add constraint managed_release_prov_adopt_manifest_chk
      check (adoption_manifest_hash is null or adoption_manifest_hash ~ '^[a-f0-9]{64}$');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'managed_release_prov_adopt_identity_chk'
      and conrelid = 'public.managed_invitation_release_provenance'::regclass
  ) then
    alter table public.managed_invitation_release_provenance
      add constraint managed_release_prov_adopt_identity_chk
      check (adoption_identity is null or adoption_identity ~ '^[a-f0-9]{64}$');
  end if;
end;
$$;

create or replace function public.adopt_managed_invitation_legacy_atomic(
  p_slug text,
  p_invitation_id uuid,
  p_owner_user_id uuid,
  p_draft_id uuid,
  p_expected_draft_updated_at timestamptz,
  p_expected_published_version integer,
  p_expected_draft_hash text,
  p_expected_published_hash text,
  p_source_hash text,
  p_package_hash text,
  p_metadata_hash text,
  p_release_projection_hash text,
  p_provenance_projection_hash text,
  p_asset_manifest_hash text,
  p_manifest_hash text,
  p_adoption_identity text,
  p_request_hash text,
  p_materialized_content_hash text,
  p_content jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_invitation public.invitations%rowtype;
  v_draft public.invitation_content_drafts%rowtype;
  v_published public.published_invitation_content%rowtype;
  v_event public.events%rowtype;
  v_receipt public.managed_invitation_legacy_adoption_receipts%rowtype;
  v_result jsonb;
  v_expected_identity text;
begin
  if p_slug <> 'romina-rios-chaparro' then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_slug_not_allowed';
  end if;
  if p_expected_published_version is null or p_expected_published_version < 1 then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_invalid_expected_version';
  end if;
  if p_source_hash !~ '^[a-f0-9]{64}$'
    or p_package_hash !~ '^[a-f0-9]{64}$'
    or p_metadata_hash !~ '^[a-f0-9]{64}$'
    or p_asset_manifest_hash !~ '^[a-f0-9]{64}$'
    or p_manifest_hash !~ '^[a-f0-9]{64}$'
    or p_adoption_identity !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or p_materialized_content_hash !~ '^[a-f0-9]{32}$'
    or p_expected_draft_hash !~ '^[a-f0-9]{32}$'
    or p_expected_published_hash !~ '^[a-f0-9]{32}$'
    or p_release_projection_hash !~ '^[a-f0-9]{32}$'
    or p_provenance_projection_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_invalid_hash';
  end if;
  v_expected_identity := encode(digest(
    p_invitation_id::text || chr(31) || 'legacy-production-adoption' || chr(31) ||
    p_package_hash || chr(31) || p_manifest_hash,
    'sha256'
  ), 'hex');
  if p_adoption_identity <> v_expected_identity then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_identity_mismatch';
  end if;

  select * into v_receipt
  from public.managed_invitation_legacy_adoption_receipts
  where adoption_identity = p_adoption_identity
  for update;
  if found then
    if v_receipt.request_hash <> p_request_hash
      or v_receipt.invitation_id <> p_invitation_id
      or v_receipt.package_hash <> p_package_hash
      or v_receipt.manifest_hash <> p_manifest_hash then
      raise exception using errcode = 'P0001', message = 'legacy_adoption_identity_reused';
    end if;
    return v_receipt.result || jsonb_build_object('idempotent', true, 'writes', 0);
  end if;

  select * into v_invitation
  from public.invitations
  where slug = p_slug and archived_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_invitation_not_found';
  end if;
  if exists (
    select 1 from public.invitations
    where slug = p_slug and archived_at is null and id <> v_invitation.id
  ) then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_duplicate_active_slug';
  end if;
  if v_invitation.id <> p_invitation_id or v_invitation.kind <> 'client'
    or v_invitation.created_by is null or v_invitation.created_by <> p_owner_user_id then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_invitation_contract_mismatch';
  end if;
  if not exists (select 1 from auth.users where id = p_owner_user_id) then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_owner_not_found';
  end if;
  select * into v_event
  from public.events
  where invitation_project_id = v_invitation.id and deleted_at is null
  for update;
  if not found or v_event.owner_user_id <> p_owner_user_id then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_event_owner_mismatch';
  end if;

  select * into v_draft
  from public.invitation_content_drafts
  where id = p_draft_id and invitation_project_id = v_invitation.id and deleted_at is null
  for update;
  if not found or v_draft.status <> 'draft'
    or v_draft.updated_at <> p_expected_draft_updated_at
    or md5(v_draft.content::text) <> p_expected_draft_hash then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_stale_draft';
  end if;
  select * into v_published
  from public.published_invitation_content
  where invitation_project_id = v_invitation.id and deleted_at is null
  order by created_at desc limit 1
  for update;
  if not found or v_published.version <> p_expected_published_version
    or md5(v_published.content::text) <> p_expected_published_hash then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_stale_published';
  end if;
  if md5(p_content::text) <> p_materialized_content_hash then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_materialized_content_mismatch';
  end if;
  if exists (
    select 1 from public.managed_invitation_release_provenance
    where invitation_id = v_invitation.id
  ) then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_provenance_already_exists';
  end if;

  -- Re-read the receipt after row locks so a concurrent equivalent caller replays.
  select * into v_receipt
  from public.managed_invitation_legacy_adoption_receipts
  where adoption_identity = p_adoption_identity
  for update;
  if found then
    if v_receipt.request_hash <> p_request_hash then
      raise exception using errcode = 'P0001', message = 'legacy_adoption_identity_reused';
    end if;
    return v_receipt.result || jsonb_build_object('idempotent', true, 'writes', 0);
  end if;

  update public.invitation_content_drafts
  set content = p_content, status = 'approved'
  where id = v_draft.id;
  update public.published_invitation_content
  set content = p_content, version = v_published.version + 1, published_at = now()
  where id = v_published.id
  returning * into v_published;
  insert into public.managed_invitation_release_provenance (
    invitation_id, definition_slug, release_schema_version, source_hash, package_hash,
    metadata_hash, projection_hash, asset_manifest_hash, adoption_manifest_hash,
    adoption_identity, applied_at
  ) values (
    v_invitation.id, p_slug, '2.0.0', p_source_hash, p_package_hash,
    p_metadata_hash, p_provenance_projection_hash, p_asset_manifest_hash, p_manifest_hash,
    p_adoption_identity, now()
  );
  v_result := jsonb_build_object(
    'invitationId', v_invitation.id,
    'slug', p_slug,
    'ownerUserId', p_owner_user_id,
    'publishedVersion', v_published.version,
    'packageHash', p_package_hash,
    'manifestHash', p_manifest_hash,
    'idempotent', false,
    'writes', 4
  );
  insert into public.managed_invitation_legacy_adoption_receipts (
    adoption_identity, invitation_id, slug, package_hash, manifest_hash, request_hash, result
  ) values (
    p_adoption_identity, v_invitation.id, p_slug, p_package_hash, p_manifest_hash,
    p_request_hash, v_result
  );
  return v_result;
end;
$function$;

revoke all on function public.adopt_managed_invitation_legacy_atomic(
  text, uuid, uuid, uuid, timestamptz, integer, text, text, text, text, text,
  text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.adopt_managed_invitation_legacy_atomic(
  text, uuid, uuid, uuid, timestamptz, integer, text, text, text, text, text,
  text, text, text, text, text, text, text, jsonb
) to service_role;

comment on function public.adopt_managed_invitation_legacy_atomic(
  text, uuid, uuid, uuid, timestamptz, integer, text, text, text, text, text,
  text, text, text, text, text, text, text, jsonb
) is 'Production-only Romina legacy adoption. Atomically writes managed draft, public version, provenance, and durable idempotency receipt.';

commit;
