-- Add the canonical per-session video quota without changing an applied migration.
-- Runtime limits continue to be passed by the application contract.

begin;

revoke all on function public.reserve_valentina_memory_item(text, uuid, text, text, bigint, text, numeric, uuid, integer, bigint, integer, integer, bigint) from public, anon, authenticated, service_role;
drop function public.reserve_valentina_memory_item(text, uuid, text, text, bigint, text, numeric, uuid, integer, bigint, integer, integer, bigint);

create function public.reserve_valentina_memory_item(
	p_event_key text,
	p_session_id uuid,
	p_object_key text,
	p_mime_type text,
	p_size_bytes bigint,
	p_checksum_sha256 text,
	p_duration_seconds numeric,
	p_idempotency_key uuid,
	p_max_session_files integer,
	p_max_session_videos integer,
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
	v_session_videos bigint;
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

	select count(*),
		count(*) filter (where mime_type like 'video/%'),
		coalesce(sum(size_bytes), 0),
		count(*) filter (where status in ('uploading', 'validating'))
	into v_session_files, v_session_videos, v_session_bytes, v_session_in_flight
	from public.valentina_memory_items
	where session_id = p_session_id and object_deleted_at is null;

	select count(*), coalesce(sum(size_bytes), 0)
	into v_event_objects, v_event_bytes
	from public.valentina_memory_items
	where event_key = p_event_key and object_deleted_at is null;

	if v_session_files >= p_max_session_files then
		raise exception using errcode = 'P0001', message = 'memories_session_file_quota';
	end if;
	if p_mime_type like 'video/%' and v_session_videos >= p_max_session_videos then
		raise exception using errcode = 'P0001', message = 'memories_session_video_quota';
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

revoke all on function public.reserve_valentina_memory_item(text, uuid, text, text, bigint, text, numeric, uuid, integer, integer, bigint, integer, integer, bigint) from public, anon, authenticated;
grant execute on function public.reserve_valentina_memory_item(text, uuid, text, text, bigint, text, numeric, uuid, integer, integer, bigint, integer, integer, bigint) to service_role;

commit;
