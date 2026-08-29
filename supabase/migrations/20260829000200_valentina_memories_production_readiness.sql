-- Forward-only production-readiness contract for Valentina Memories.
-- Runtime limits are passed by the application from the canonical TypeScript
-- contract so quota values are not duplicated in SQL.

begin;

alter table public.valentina_memory_sessions
	add column if not exists display_name text,
	add column if not exists guest_alias text;

update public.valentina_memory_sessions
set display_name = coalesce(nullif(trim(display_name), ''), 'Invitado'),
	guest_alias = coalesce(
		nullif(trim(guest_alias), ''),
		'invitado-' || substr(replace(id::text, '-', ''), 1, 8)
	);

alter table public.valentina_memory_sessions
	alter column display_name set not null,
	alter column guest_alias set not null;

alter table public.valentina_memory_sessions
	drop constraint if exists valentina_memory_sessions_display_name_check,
	add constraint valentina_memory_sessions_display_name_check
		check (char_length(trim(display_name)) between 1 and 60),
	drop constraint if exists valentina_memory_sessions_guest_alias_check,
	add constraint valentina_memory_sessions_guest_alias_check
		check (guest_alias ~ '^invitado-[a-z0-9]{8}$');

create unique index if not exists idx_valentina_memory_sessions_event_alias
	on public.valentina_memory_sessions (event_key, guest_alias);

alter table public.valentina_memory_items
	add column if not exists idempotency_key uuid,
	add column if not exists cleanup_after timestamptz,
	add column if not exists cleanup_claimed_at timestamptz,
	add column if not exists cleanup_lease_id uuid,
	add column if not exists object_deleted_at timestamptz;

create unique index if not exists idx_valentina_memory_items_session_idempotency
	on public.valentina_memory_items (session_id, idempotency_key)
	where idempotency_key is not null;

create index if not exists idx_valentina_memory_items_cleanup_claim
	on public.valentina_memory_items (cleanup_after, created_at)
	where cleanup_after is not null and object_deleted_at is null;

create index if not exists idx_valentina_memory_items_session_resident
	on public.valentina_memory_items (session_id, status)
	include (size_bytes)
	where object_deleted_at is null;

revoke all on table public.valentina_memory_sessions from public, anon, authenticated, service_role;
revoke all on table public.valentina_memory_items from public, anon, authenticated, service_role;
revoke all on table public.valentina_memory_audit_events from public, anon, authenticated, service_role;
grant select, insert, update on table public.valentina_memory_sessions to service_role;
grant select, insert, update on table public.valentina_memory_items to service_role;
grant select, insert, delete on table public.valentina_memory_audit_events to service_role;

create or replace function public.reserve_valentina_memory_item(
	p_event_key text,
	p_session_id uuid,
	p_object_key text,
	p_mime_type text,
	p_size_bytes bigint,
	p_checksum_sha256 text,
	p_duration_seconds numeric,
	p_idempotency_key uuid,
	p_max_session_files integer,
	p_max_session_bytes bigint,
	p_max_session_in_flight integer,
	p_max_event_objects integer,
	p_max_event_bytes bigint
) returns setof public.valentina_memory_items
language plpgsql
security invoker
set search_path = ''
as $function$
declare
	v_existing public.valentina_memory_items%rowtype;
	v_session_files bigint;
	v_session_bytes bigint;
	v_session_in_flight bigint;
	v_event_objects bigint;
	v_event_bytes bigint;
begin
	perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_key, 0));

	perform 1 from public.valentina_memory_sessions
	where id = p_session_id and event_key = p_event_key
		and revoked_at is null and expires_at > pg_catalog.now()
	for update;
	if not found then
		raise exception using errcode = 'P0001', message = 'memories_session_unavailable';
	end if;

	select * into v_existing
	from public.valentina_memory_items
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

	select count(*), coalesce(sum(size_bytes), 0),
		count(*) filter (where status in ('uploading', 'validating'))
	into v_session_files, v_session_bytes, v_session_in_flight
	from public.valentina_memory_items
	where session_id = p_session_id and object_deleted_at is null;

	select count(*), coalesce(sum(size_bytes), 0)
	into v_event_objects, v_event_bytes
	from public.valentina_memory_items
	where event_key = p_event_key and object_deleted_at is null;

	if v_session_files >= p_max_session_files then
		raise exception using errcode = 'P0001', message = 'memories_session_file_quota';
	end if;
	if v_session_bytes + p_size_bytes > p_max_session_bytes then
		raise exception using errcode = 'P0001', message = 'memories_session_byte_quota';
	end if;
	if v_session_in_flight >= p_max_session_in_flight then
		raise exception using errcode = 'P0001', message = 'memories_session_concurrency_quota';
	end if;
	if v_event_objects >= p_max_event_objects then
		raise exception using errcode = 'P0001', message = 'memories_event_object_quota';
	end if;
	if v_event_bytes + p_size_bytes > p_max_event_bytes then
		raise exception using errcode = 'P0001', message = 'memories_event_byte_quota';
	end if;

	return query
	insert into public.valentina_memory_items (
		event_key, session_id, object_key, mime_type, size_bytes, checksum_sha256,
		duration_seconds, idempotency_key, status
	) values (
		p_event_key, p_session_id, p_object_key, p_mime_type, p_size_bytes,
		p_checksum_sha256, p_duration_seconds, p_idempotency_key, 'uploading'
	)
	returning *;
end;
$function$;

create or replace function public.claim_valentina_memory_validation(
	p_item_id uuid,
	p_session_id uuid
) returns setof public.valentina_memory_items
language sql
security invoker
set search_path = ''
as $function$
	update public.valentina_memory_items
	set status = 'validating', updated_at = pg_catalog.now()
	where id = p_item_id and session_id = p_session_id and status = 'uploading'
	returning *;
$function$;

create or replace function public.finalize_valentina_memory_item(
	p_item_id uuid,
	p_session_id uuid,
	p_outcome text,
	p_cleanup_after timestamptz
) returns setof public.valentina_memory_items
language plpgsql
security invoker
set search_path = ''
as $function$
declare
	v_item public.valentina_memory_items%rowtype;
	v_winner_id uuid;
begin
	select * into v_item from public.valentina_memory_items
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
		update public.valentina_memory_items set
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
		update public.valentina_memory_items set
			status = 'accepted', accepted_at = pg_catalog.now(), updated_at = pg_catalog.now()
		where id = v_item.id returning * into v_item;
	exception when unique_violation then
		select id into v_winner_id from public.valentina_memory_items
		where event_key = v_item.event_key and checksum_sha256 = v_item.checksum_sha256
			and status = 'accepted' and id <> v_item.id
		order by accepted_at, id limit 1;
		if v_winner_id is null then raise; end if;
		update public.valentina_memory_items set
			status = 'duplicate', duplicate_of_id = v_winner_id,
			updated_at = pg_catalog.now(), cleanup_after = p_cleanup_after
		where id = v_item.id returning * into v_item;
	end;
	return next v_item;
end;
$function$;

create or replace function public.claim_valentina_memory_cleanup(
	p_lease_id uuid,
	p_batch_size integer,
	p_lease_seconds integer
) returns setof public.valentina_memory_items
language sql
security invoker
set search_path = ''
as $function$
	with candidates as (
		select id from public.valentina_memory_items
		where cleanup_after <= pg_catalog.now()
			and object_deleted_at is null
			and (cleanup_claimed_at is null or cleanup_claimed_at < pg_catalog.now() - pg_catalog.make_interval(secs => p_lease_seconds))
		order by cleanup_after, created_at
		limit p_batch_size
		for update skip locked
	)
	update public.valentina_memory_items item
	set cleanup_claimed_at = pg_catalog.now(), cleanup_lease_id = p_lease_id
	from candidates
	where item.id = candidates.id
	returning item.*;
$function$;

create or replace function public.expire_valentina_memory_reservations(
	p_upload_cutoff timestamptz,
	p_validation_cutoff timestamptz
) returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
	v_count bigint;
begin
	update public.valentina_memory_items
	set status = 'deleted', deleted_at = pg_catalog.now(), updated_at = pg_catalog.now(),
		cleanup_after = pg_catalog.now()
	where object_deleted_at is null and (
		(status = 'uploading' and created_at < p_upload_cutoff)
		or (status = 'validating' and created_at < p_validation_cutoff)
	);
	get diagnostics v_count = row_count;
	return v_count;
end;
$function$;

create or replace function public.purge_valentina_memory_audit(
	p_cutoff timestamptz
) returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
	v_count bigint;
begin
	delete from public.valentina_memory_audit_events where expires_at <= p_cutoff;
	get diagnostics v_count = row_count;
	return v_count;
end;
$function$;

revoke all on function public.reserve_valentina_memory_item(text, uuid, text, text, bigint, text, numeric, uuid, integer, bigint, integer, integer, bigint) from public, anon, authenticated;
revoke all on function public.claim_valentina_memory_validation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finalize_valentina_memory_item(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_valentina_memory_cleanup(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.expire_valentina_memory_reservations(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.purge_valentina_memory_audit(timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_valentina_memory_item(text, uuid, text, text, bigint, text, numeric, uuid, integer, bigint, integer, integer, bigint) to service_role;
grant execute on function public.claim_valentina_memory_validation(uuid, uuid) to service_role;
grant execute on function public.finalize_valentina_memory_item(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.claim_valentina_memory_cleanup(uuid, integer, integer) to service_role;
grant execute on function public.expire_valentina_memory_reservations(timestamptz, timestamptz) to service_role;
grant execute on function public.purge_valentina_memory_audit(timestamptz) to service_role;

commit;
