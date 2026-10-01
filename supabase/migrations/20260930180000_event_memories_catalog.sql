-- Event-neutral guest memories catalog (expand phase).
-- One memory space per event; per-event window, retention and quotas live in
-- event_memory_settings and are enforced inside the reservation RPC. Objects
-- stay in private R2 under events/<event uuid>/. Legacy valentina_* objects are
-- left untouched for the separately authorized retirement migration.

begin;

-- ---------------------------------------------------------------------------
-- Settings: the aggregate root of an event memory space.
-- ---------------------------------------------------------------------------
create table public.event_memory_settings (
	event_id uuid primary key references public.events(id) on delete restrict,
	public_slug text not null unique
		check (public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(public_slug) <= 64),
	enabled boolean not null default true,
	time_zone text not null check (char_length(time_zone) between 1 and 64),
	upload_starts_at timestamptz not null,
	upload_ends_at timestamptz not null,
	retention_ends_at timestamptz not null,
	max_event_objects integer not null check (max_event_objects > 0),
	max_event_bytes bigint not null check (max_event_bytes > 0),
	max_session_files integer not null check (max_session_files > 0),
	max_session_videos integer not null check (max_session_videos >= 0),
	max_session_bytes bigint not null check (max_session_bytes > 0),
	entitlement text not null check (entitlement in ('package', 'addon', 'courtesy')),
	created_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint event_memory_settings_window_check check (upload_ends_at > upload_starts_at),
	constraint event_memory_settings_retention_check check (
		retention_ends_at >= upload_ends_at
		and retention_ends_at <= upload_starts_at + interval '150 days'
	)
);
comment on table public.event_memory_settings is
	'One guest memory space per event. public_slug is the printed QR contract and never changes.';
comment on constraint event_memory_settings_retention_check on public.event_memory_settings is
	'The 150-day bound mirrors MEMORIES_OBJECT_MAX_LIFETIME_DAYS and the R2 lifecycle rule.';

-- ---------------------------------------------------------------------------
-- Guest sessions.
-- ---------------------------------------------------------------------------
create table public.event_memory_sessions (
	id uuid primary key default gen_random_uuid(),
	event_id uuid not null references public.event_memory_settings(event_id) on delete restrict,
	token_hash text not null unique,
	recovery_code_hash text not null unique,
	display_name text not null check (char_length(trim(display_name)) between 1 and 60),
	guest_alias text not null check (guest_alias ~ '^invitado-[a-z0-9]{8}$'),
	created_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now(),
	expires_at timestamptz not null,
	revoked_at timestamptz,
	anonymized_at timestamptz,
	constraint event_memory_sessions_event_alias_key unique (event_id, guest_alias)
);
create index event_memory_sessions_active_idx
	on public.event_memory_sessions (event_id, expires_at)
	where revoked_at is null;
create index event_memory_sessions_pending_anonymization_idx
	on public.event_memory_sessions (event_id, expires_at, id)
	where anonymized_at is null;
comment on column public.event_memory_sessions.anonymized_at is
	'Set atomically with anonymization and its audit row.';

-- ---------------------------------------------------------------------------
-- Media items.
-- ---------------------------------------------------------------------------
create table public.event_memory_items (
	id uuid primary key default gen_random_uuid(),
	event_id uuid not null references public.event_memory_settings(event_id) on delete restrict,
	session_id uuid not null references public.event_memory_sessions(id) on delete restrict,
	object_key text not null unique,
	mime_type text not null,
	size_bytes bigint not null check (size_bytes > 0),
	checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
	duration_seconds numeric(10, 3),
	caption text not null default '',
	status text not null default 'uploading'
		check (status in ('uploading', 'validating', 'accepted', 'rejected', 'deleted', 'duplicate')),
	duplicate_of_id uuid references public.event_memory_items(id) on delete set null,
	idempotency_key uuid,
	cleanup_after timestamptz,
	cleanup_claimed_at timestamptz,
	cleanup_lease_id uuid,
	object_deleted_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	accepted_at timestamptz,
	rejected_at timestamptz,
	deleted_at timestamptz
);
create index event_memory_items_session_idx
	on public.event_memory_items (session_id, created_at desc);
create index event_memory_items_event_status_idx
	on public.event_memory_items (event_id, status, created_at desc);
create unique index event_memory_items_session_idempotency_idx
	on public.event_memory_items (session_id, idempotency_key)
	where idempotency_key is not null;
create unique index event_memory_items_event_checksum_accepted_idx
	on public.event_memory_items (event_id, checksum_sha256)
	where status = 'accepted' and checksum_sha256 is not null;
create index event_memory_items_cleanup_claim_idx
	on public.event_memory_items (cleanup_after, created_at)
	where cleanup_after is not null and object_deleted_at is null;
create index event_memory_items_session_resident_idx
	on public.event_memory_items (session_id, status)
	include (size_bytes)
	where object_deleted_at is null;
create index event_memory_items_event_resident_idx
	on public.event_memory_items (event_id)
	include (size_bytes)
	where object_deleted_at is null;

-- ---------------------------------------------------------------------------
-- Audit (no PII: actor type, opaque actor id, action, media id, timestamps).
-- ---------------------------------------------------------------------------
create table public.event_memory_audit_events (
	id bigint generated by default as identity primary key,
	event_id uuid not null references public.event_memory_settings(event_id) on delete restrict,
	media_item_id uuid references public.event_memory_items(id) on delete set null,
	actor_type text not null check (actor_type in ('guest', 'organizer', 'admin', 'system')),
	actor_id text,
	action text not null,
	metadata jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	expires_at timestamptz not null
);
create index event_memory_audit_events_media_idx
	on public.event_memory_audit_events (event_id, media_item_id, created_at desc);
create index event_memory_audit_events_expires_idx
	on public.event_memory_audit_events (expires_at);

-- ---------------------------------------------------------------------------
-- Access: service role only, through the application server.
-- ---------------------------------------------------------------------------
alter table public.event_memory_settings enable row level security;
alter table public.event_memory_sessions enable row level security;
alter table public.event_memory_items enable row level security;
alter table public.event_memory_audit_events enable row level security;
alter table public.event_memory_settings force row level security;
alter table public.event_memory_sessions force row level security;
alter table public.event_memory_items force row level security;
alter table public.event_memory_audit_events force row level security;

revoke all on table public.event_memory_settings from public, anon, authenticated, service_role;
revoke all on table public.event_memory_sessions from public, anon, authenticated, service_role;
revoke all on table public.event_memory_items from public, anon, authenticated, service_role;
revoke all on table public.event_memory_audit_events from public, anon, authenticated, service_role;
grant select, insert, update on table public.event_memory_settings to service_role;
grant select, insert, update on table public.event_memory_sessions to service_role;
grant select, insert, update, delete on table public.event_memory_items to service_role;
grant select, insert, delete on table public.event_memory_audit_events to service_role;

create policy event_memory_settings_service_all on public.event_memory_settings
	for all to service_role using (true) with check (true);
create policy event_memory_sessions_service_all on public.event_memory_sessions
	for all to service_role using (true) with check (true);
create policy event_memory_items_service_all on public.event_memory_items
	for all to service_role using (true) with check (true);
create policy event_memory_audit_events_service_all on public.event_memory_audit_events
	for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Session resolution. Hashes travel in request bodies, never in URLs.
-- ---------------------------------------------------------------------------
create function public.resolve_event_memory_session(
	p_event_id uuid,
	p_token_hash text
) returns setof public.event_memory_sessions
language sql
security invoker
set search_path = ''
as $function$
	update public.event_memory_sessions s
	set last_seen_at = pg_catalog.now()
	from public.event_memory_settings st
	where s.event_id = p_event_id
		and st.event_id = s.event_id
		and s.token_hash = p_token_hash
		and s.revoked_at is null
		and s.expires_at > pg_catalog.now()
		and st.retention_ends_at > pg_catalog.now()
	returning s.*;
$function$;

create function public.recover_event_memory_session(
	p_event_id uuid,
	p_recovery_code_hash text,
	p_token_hash text
) returns setof public.event_memory_sessions
language sql
security invoker
set search_path = ''
as $function$
	update public.event_memory_sessions s
	set token_hash = p_token_hash, last_seen_at = pg_catalog.now()
	from public.event_memory_settings st
	where s.event_id = p_event_id
		and st.event_id = s.event_id
		and s.recovery_code_hash = p_recovery_code_hash
		and s.revoked_at is null
		and s.expires_at > pg_catalog.now()
		and st.retention_ends_at > pg_catalog.now()
	returning s.*;
$function$;

-- ---------------------------------------------------------------------------
-- Reservation: window, availability and every quota decided under one lock.
-- ---------------------------------------------------------------------------
create function public.reserve_event_memory_item(
	p_event_id uuid,
	p_session_id uuid,
	p_object_key text,
	p_mime_type text,
	p_size_bytes bigint,
	p_checksum_sha256 text,
	p_duration_seconds numeric,
	p_idempotency_key uuid,
	p_max_session_in_flight integer
) returns setof public.event_memory_items
language plpgsql
security invoker
set search_path = ''
as $function$
declare
	v_settings public.event_memory_settings%rowtype;
	v_existing public.event_memory_items%rowtype;
	v_now timestamptz := pg_catalog.now();
	v_session_files bigint;
	v_session_videos bigint;
	v_session_bytes bigint;
	v_session_in_flight bigint;
	v_event_objects bigint;
	v_event_bytes bigint;
begin
	perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id::text, 0));

	select * into v_settings from public.event_memory_settings
	where event_id = p_event_id
	for share;
	if not found or not v_settings.enabled or v_settings.retention_ends_at <= v_now then
		raise exception using errcode = 'P0001', message = 'memories_space_unavailable';
	end if;
	if v_now < v_settings.upload_starts_at or v_now >= v_settings.upload_ends_at then
		raise exception using errcode = 'P0001', message = 'memories_upload_window_closed';
	end if;

	perform 1 from public.event_memory_sessions
	where id = p_session_id and event_id = p_event_id
		and revoked_at is null and expires_at > v_now
	for update;
	if not found then
		raise exception using errcode = 'P0001', message = 'memories_session_unavailable';
	end if;

	select * into v_existing
	from public.event_memory_items
	where session_id = p_session_id and idempotency_key = p_idempotency_key;
	if found then
		if v_existing.mime_type is distinct from p_mime_type
			or v_existing.size_bytes is distinct from p_size_bytes
			or v_existing.checksum_sha256 is distinct from p_checksum_sha256
			or v_existing.duration_seconds is distinct from p_duration_seconds then
			raise exception using errcode = 'P0001', message = 'memories_idempotency_conflict';
		end if;
		return next v_existing;
		return;
	end if;

	select count(*),
		count(*) filter (where mime_type like 'video/%'),
		coalesce(sum(size_bytes), 0),
		count(*) filter (where status in ('uploading', 'validating'))
	into v_session_files, v_session_videos, v_session_bytes, v_session_in_flight
	from public.event_memory_items
	where session_id = p_session_id and object_deleted_at is null;

	select count(*), coalesce(sum(size_bytes), 0)
	into v_event_objects, v_event_bytes
	from public.event_memory_items
	where event_id = p_event_id and object_deleted_at is null;

	if v_session_files >= v_settings.max_session_files then
		raise exception using errcode = 'P0001', message = 'memories_session_file_quota';
	end if;
	if p_mime_type like 'video/%' and v_session_videos >= v_settings.max_session_videos then
		raise exception using errcode = 'P0001', message = 'memories_session_video_quota';
	end if;
	if v_session_bytes + p_size_bytes > v_settings.max_session_bytes then
		raise exception using errcode = 'P0001', message = 'memories_session_byte_quota';
	end if;
	if v_session_in_flight >= p_max_session_in_flight then
		raise exception using errcode = 'P0001', message = 'memories_session_concurrency_quota';
	end if;
	if v_event_objects >= v_settings.max_event_objects then
		raise exception using errcode = 'P0001', message = 'memories_event_object_quota';
	end if;
	if v_event_bytes + p_size_bytes > v_settings.max_event_bytes then
		raise exception using errcode = 'P0001', message = 'memories_event_byte_quota';
	end if;

	return query
	insert into public.event_memory_items (
		event_id, session_id, object_key, mime_type, size_bytes, checksum_sha256,
		duration_seconds, idempotency_key, status
	) values (
		p_event_id, p_session_id, p_object_key, p_mime_type, p_size_bytes,
		p_checksum_sha256, p_duration_seconds, p_idempotency_key, 'uploading'
	)
	returning *;
end;
$function$;

create function public.release_event_memory_reservation(
	p_item_id uuid,
	p_session_id uuid
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
	v_deleted integer;
begin
	delete from public.event_memory_items
	where id = p_item_id and session_id = p_session_id and status = 'uploading';
	get diagnostics v_deleted = row_count;
	return v_deleted > 0;
end;
$function$;

create function public.claim_event_memory_validation(
	p_item_id uuid,
	p_session_id uuid
) returns setof public.event_memory_items
language sql
security invoker
set search_path = ''
as $function$
	update public.event_memory_items
	set status = 'validating', updated_at = pg_catalog.now()
	where id = p_item_id and session_id = p_session_id and status = 'uploading'
	returning *;
$function$;

create function public.finalize_event_memory_item(
	p_item_id uuid,
	p_session_id uuid,
	p_outcome text,
	p_cleanup_after timestamptz
) returns setof public.event_memory_items
language plpgsql
security invoker
set search_path = ''
as $function$
declare
	v_item public.event_memory_items%rowtype;
	v_winner_id uuid;
begin
	select * into v_item from public.event_memory_items
	where id = p_item_id and session_id = p_session_id
	for update;
	if not found then return; end if;
	if v_item.status in ('accepted', 'duplicate', 'rejected', 'deleted') then
		return next v_item;
		return;
	end if;
	if v_item.status <> 'validating' then
		raise exception using errcode = 'P0001', message = 'memories_invalid_finalize_state';
	end if;

	if p_outcome = 'rejected' then
		update public.event_memory_items set
			status = 'rejected', rejected_at = pg_catalog.now(), updated_at = pg_catalog.now(),
			cleanup_after = p_cleanup_after
		where id = v_item.id returning * into v_item;
		return next v_item;
		return;
	end if;
	if p_outcome <> 'accepted' then
		raise exception using errcode = 'P0001', message = 'memories_invalid_finalize_outcome';
	end if;

	begin
		update public.event_memory_items set
			status = 'accepted', accepted_at = pg_catalog.now(), updated_at = pg_catalog.now()
		where id = v_item.id returning * into v_item;
	exception when unique_violation then
		select id into v_winner_id from public.event_memory_items
		where event_id = v_item.event_id and checksum_sha256 = v_item.checksum_sha256
			and status = 'accepted' and id <> v_item.id
		order by accepted_at, id limit 1;
		if v_winner_id is null then raise; end if;
		update public.event_memory_items set
			status = 'duplicate', duplicate_of_id = v_winner_id,
			updated_at = pg_catalog.now(), cleanup_after = p_cleanup_after
		where id = v_item.id returning * into v_item;
	end;
	return next v_item;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Lifecycle: expiry, cleanup leases, anonymization and audit purge.
-- ---------------------------------------------------------------------------
-- Every resident object of a space whose retention ended is scheduled for
-- physical deletion. The R2 lifecycle rule remains the final backstop.
create function public.expire_event_memory_content(
	p_now timestamptz
) returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
	v_count bigint;
begin
	update public.event_memory_items i
	set status = 'deleted',
		deleted_at = coalesce(i.deleted_at, p_now),
		updated_at = p_now,
		cleanup_after = p_now
	from public.event_memory_settings s
	where s.event_id = i.event_id
		and s.retention_ends_at <= p_now
		and i.object_deleted_at is null
		and i.cleanup_after is null;
	get diagnostics v_count = row_count;
	return v_count;
end;
$function$;

create function public.claim_event_memory_cleanup(
	p_lease_id uuid,
	p_batch_size integer,
	p_lease_seconds integer
) returns setof public.event_memory_items
language sql
security invoker
set search_path = ''
as $function$
	with candidates as (
		select id from public.event_memory_items
		where cleanup_after <= pg_catalog.now()
			and object_deleted_at is null
			and (cleanup_claimed_at is null
				or cleanup_claimed_at < pg_catalog.now() - pg_catalog.make_interval(secs => p_lease_seconds))
		order by cleanup_after, created_at
		limit p_batch_size
		for update skip locked
	)
	update public.event_memory_items item
	set cleanup_claimed_at = pg_catalog.now(), cleanup_lease_id = p_lease_id
	from candidates
	where item.id = candidates.id
	returning item.*;
$function$;

-- Same event lock order as reservation prevents a new object racing the empty check.
create function public.anonymize_event_memory_session(
	p_event_id uuid,
	p_session_id uuid,
	p_token_hash text,
	p_recovery_code_hash text,
	p_audit_expires_at timestamptz
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
begin
	perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id::text, 0));
	perform 1 from public.event_memory_sessions
	where id = p_session_id and event_id = p_event_id and anonymized_at is null
	for update;
	if not found then return false; end if;
	if exists (select 1 from public.event_memory_items
		where session_id = p_session_id and object_deleted_at is null) then
		return false;
	end if;
	if p_token_hash is null or p_recovery_code_hash is null
		or p_audit_expires_at is null or p_audit_expires_at <= pg_catalog.now() then
		raise exception 'Invalid anonymization parameters';
	end if;
	update public.event_memory_sessions set
		display_name = 'Invitado retirado', token_hash = p_token_hash,
		recovery_code_hash = p_recovery_code_hash,
		revoked_at = coalesce(revoked_at, pg_catalog.now()), anonymized_at = pg_catalog.now()
	where id = p_session_id;
	insert into public.event_memory_audit_events
		(event_id, actor_type, action, metadata, expires_at)
	values (p_event_id, 'system', 'guest_session_anonymized', '{}'::jsonb, p_audit_expires_at);
	return true;
end;
$function$;

create function public.purge_event_memory_audit(
	p_cutoff timestamptz
) returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
	v_count bigint;
begin
	delete from public.event_memory_audit_events where expires_at <= p_cutoff;
	get diagnostics v_count = row_count;
	return v_count;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Function privileges: service role only.
-- ---------------------------------------------------------------------------
revoke all on function public.resolve_event_memory_session(uuid, text) from public, anon, authenticated;
revoke all on function public.recover_event_memory_session(uuid, text, text) from public, anon, authenticated;
revoke all on function public.reserve_event_memory_item(uuid, uuid, text, text, bigint, text, numeric, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_event_memory_reservation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_event_memory_validation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finalize_event_memory_item(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.expire_event_memory_content(timestamptz) from public, anon, authenticated;
revoke all on function public.claim_event_memory_cleanup(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.anonymize_event_memory_session(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.purge_event_memory_audit(timestamptz) from public, anon, authenticated;

grant execute on function public.resolve_event_memory_session(uuid, text) to service_role;
grant execute on function public.recover_event_memory_session(uuid, text, text) to service_role;
grant execute on function public.reserve_event_memory_item(uuid, uuid, text, text, bigint, text, numeric, uuid, integer) to service_role;
grant execute on function public.release_event_memory_reservation(uuid, uuid) to service_role;
grant execute on function public.claim_event_memory_validation(uuid, uuid) to service_role;
grant execute on function public.finalize_event_memory_item(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.expire_event_memory_content(timestamptz) to service_role;
grant execute on function public.claim_event_memory_cleanup(uuid, integer, integer) to service_role;
grant execute on function public.anonymize_event_memory_session(uuid, uuid, text, text, timestamptz) to service_role;
grant execute on function public.purge_event_memory_audit(timestamptz) to service_role;

notify pgrst, 'reload schema';

commit;
