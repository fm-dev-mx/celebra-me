begin;

select plan(37);

-- One space followed from its open window to the purge after retention.
-- now() is the transaction start, so every instant below is relative to one clock.
insert into public.event_memory_settings (
	event_id, public_slug, time_zone, upload_starts_at, upload_ends_at, retention_ends_at,
	max_event_objects, max_event_bytes, max_session_files, max_session_videos, max_session_bytes,
	entitlement
) values (
	'e0000000-0000-0000-0000-000000000001', 'lifecycle-space', 'America/Mazatlan',
	now() - interval '1 hour', now() + interval '1 hour', now() + interval '30 days',
	5, 1000, 3, 1, 500, 'addon'
);

insert into public.event_memory_sessions (
	id, event_id, token_hash, recovery_code_hash, expires_at, display_name, guest_alias
) values
	('10000000-0000-4000-8000-00000000000a', 'e0000000-0000-0000-0000-000000000001',
		'token-a', 'recovery-a', now() + interval '30 days', 'Invitado A', 'invitado-aaaaaaaa'),
	('10000000-0000-4000-8000-00000000000b', 'e0000000-0000-0000-0000-000000000001',
		'token-b', 'recovery-b', now() + interval '30 days', 'Invitado B', 'invitado-bbbbbbbb'),
	('10000000-0000-4000-8000-00000000000c', 'e0000000-0000-0000-0000-000000000001',
		'token-c', 'recovery-c', now() + interval '30 days', 'Invitado C', 'invitado-cccccccc');

-- Reserves slot N: its object key, checksum and idempotency key all derive from N.
create function pg_temp.reserve(
	p_session uuid, p_slot integer, p_mime text, p_size bigint, p_duration numeric
) returns setof public.event_memory_items
language sql
as $function$
	select * from public.reserve_event_memory_item(
		'e0000000-0000-0000-0000-000000000001',
		p_session,
		'events/e0000000-0000-0000-0000-000000000001/20000000-0000-4000-8000-'
			|| lpad(p_slot::text, 12, '0')
			|| case when p_mime like 'video/%' then '.mp4' else '.jpg' end,
		p_mime, p_size, lpad(p_slot::text, 64, '0'), p_duration,
		('30000000-0000-4000-8000-' || lpad(p_slot::text, 12, '0'))::uuid,
		2
	);
$function$;

create function pg_temp.item_id(p_slot integer) returns uuid
language sql
as $function$
	select id from public.event_memory_items
	where idempotency_key = ('30000000-0000-4000-8000-' || lpad(p_slot::text, 12, '0'))::uuid;
$function$;

create function pg_temp.accept(p_session uuid, p_slot integer) returns text
language sql
as $function$
	select status from public.finalize_event_memory_item(
		(select id from public.claim_event_memory_validation(pg_temp.item_id(p_slot), p_session)),
		p_session, 'accepted', pg_catalog.now()
	);
$function$;

-- Open window: a video and its retry ------------------------------------------
select is(
	(select duration_seconds from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000a', 1, 'video/mp4', 100, 12.346)),
	12.346::numeric,
	'a video is reserved with its duration at the stored scale'
);
select is(
	(select id from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000a', 1, 'video/mp4', 100, 12.346)),
	pg_temp.item_id(1),
	'retrying the video with the stored duration replays the same reservation'
);
select is(
	(select count(*) from public.event_memory_items),
	1::bigint,
	'the replay creates no second row'
);
select throws_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000a', 1, 'video/mp4', 100, 12.345678)$sql$,
	'P0001', 'memories_idempotency_conflict',
	'an unrounded duration reads as another file, so the app must round before reserving'
);
select throws_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000a', 2, 'video/mp4', 100, 5)$sql$,
	'P0001', 'memories_session_video_quota',
	'the per-guest video quota is enforced'
);

-- Per-guest files and what a deletion frees ------------------------------------
select lives_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000a', 3, 'image/jpeg', 100, null)$sql$,
	'a photo is reserved next to the video'
);
select is(pg_temp.accept('10000000-0000-4000-8000-00000000000a', 1), 'accepted', 'the video is accepted');
select is(pg_temp.accept('10000000-0000-4000-8000-00000000000a', 3), 'accepted', 'the photo is accepted');

-- The guest deletes the photo: the app marks it and schedules the object for removal.
update public.event_memory_items
set status = 'deleted', deleted_at = now(), cleanup_after = now()
where id = pg_temp.item_id(3);

select lives_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000a', 4, 'image/jpeg', 100, null)$sql$,
	'a third file fits the per-guest file quota'
);
select throws_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000a', 5, 'image/jpeg', 100, null)$sql$,
	'P0001', 'memories_session_file_quota',
	'a deleted file keeps its slot until storage confirms the removal'
);

select is(
	(select count(*) from public.claim_event_memory_cleanup('40000000-0000-4000-8000-00000000000a', 25, 900)),
	1::bigint,
	'the cleanup claims the deleted photo'
);
-- The cleanup removed the object from storage and recorded it.
update public.event_memory_items
set object_deleted_at = now(), cleanup_claimed_at = null, cleanup_lease_id = null
where id = pg_temp.item_id(3);

select lives_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000a', 5, 'image/jpeg', 100, null)$sql$,
	'physical deletion frees the slot'
);
select throws_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000a', 6, 'image/jpeg', 100, null)$sql$,
	'P0001', 'memories_session_file_quota',
	'the per-guest file quota is enforced'
);

-- Per-guest storage, then the event capacity ----------------------------------
select lives_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000b', 7, 'image/jpeg', 500, null)$sql$,
	'a guest may fill the per-guest storage exactly'
);
select throws_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000b', 8, 'image/jpeg', 1, null)$sql$,
	'P0001', 'memories_session_byte_quota',
	'the per-guest storage quota is enforced'
);
-- Resident so far: the video and two photos of guest A, one photo of guest B (800 bytes).
select throws_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000c', 9, 'image/jpeg', 201, null)$sql$,
	'P0001', 'memories_event_byte_quota',
	'the event storage quota is enforced across guests'
);
select lives_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000c', 9, 'image/jpeg', 100, null)$sql$,
	'a file that fits the event storage is reserved'
);
select throws_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000c', 10, 'image/jpeg', 10, null)$sql$,
	'P0001', 'memories_event_object_quota',
	'the event file quota is enforced across guests'
);

-- Closing the window ------------------------------------------------------------
update public.event_memory_settings
set upload_ends_at = now() - interval '1 second'
where public_slug = 'lifecycle-space';

select throws_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000c', 11, 'image/jpeg', 10, null)$sql$,
	'P0001', 'memories_upload_window_closed',
	'a closed window rejects new reservations'
);
select is(
	pg_temp.accept('10000000-0000-4000-8000-00000000000a', 4),
	'accepted',
	'a file reserved before the close is still confirmed after it'
);
select is(
	(select count(*) from public.resolve_event_memory_session('e0000000-0000-0000-0000-000000000001', 'token-a')),
	1::bigint,
	'guests keep their session after the close to see what they shared'
);
select is(
	(select count(*) from public.event_memory_items
		where event_id = 'e0000000-0000-0000-0000-000000000001' and status = 'accepted'),
	2::bigint,
	'the host has the accepted files to download after the close'
);

-- Retention end -----------------------------------------------------------------
update public.event_memory_settings
set retention_ends_at = now() - interval '1 second'
where public_slug = 'lifecycle-space';

select throws_ok(
	$sql$select * from pg_temp.reserve(
		'10000000-0000-4000-8000-00000000000c', 12, 'image/jpeg', 10, null)$sql$,
	'P0001', 'memories_space_unavailable',
	'an expired space rejects reservations as unavailable'
);
select is(
	(select count(*) from public.resolve_event_memory_session('e0000000-0000-0000-0000-000000000001', 'token-a')),
	0::bigint,
	'guest sessions stop resolving at retention end'
);
select is(
	(select count(*) from public.recover_event_memory_session(
		'e0000000-0000-0000-0000-000000000001', 'recovery-a', 'token-a-rotated')),
	0::bigint,
	'recovery codes stop working at retention end'
);
-- Still resident: two accepted files and three uploads nobody confirmed.
select is(
	public.expire_event_memory_content(now()),
	5::bigint,
	'retention expiry schedules every resident object, confirmed or not'
);
select is(
	(select count(*) from public.event_memory_items
		where event_id = 'e0000000-0000-0000-0000-000000000001' and status <> 'deleted'),
	0::bigint,
	'nothing of an expired space stays visible'
);
select is(
	public.expire_event_memory_content(now()),
	0::bigint,
	'a second expiry pass finds nothing left to schedule'
);

-- Purge ---------------------------------------------------------------------------
select ok(
	not public.anonymize_event_memory_session(
		'e0000000-0000-0000-0000-000000000001', '10000000-0000-4000-8000-00000000000a',
		'anon-token-a', 'anon-recovery-a', now() + interval '1 day'
	),
	'a guest is not anonymized while objects remain in storage'
);
select is(
	(select count(*) from public.claim_event_memory_cleanup('40000000-0000-4000-8000-00000000000b', 2, 900)),
	2::bigint,
	'the cleanup claims no more than its batch size'
);
select is(
	(select count(*) from public.claim_event_memory_cleanup('40000000-0000-4000-8000-00000000000c', 25, 900)),
	3::bigint,
	'a later batch claims the rest without overlapping the first lease'
);
-- Both batches removed their objects from storage and recorded it.
update public.event_memory_items
set object_deleted_at = now(), caption = '', cleanup_claimed_at = null, cleanup_lease_id = null
where event_id = 'e0000000-0000-0000-0000-000000000001' and object_deleted_at is null;

select is(
	(select count(*) from public.claim_event_memory_cleanup('40000000-0000-4000-8000-00000000000d', 25, 900)),
	0::bigint,
	'nothing is left to delete once every object is gone'
);
select is(
	(select count(*) from public.event_memory_items
		where event_id = 'e0000000-0000-0000-0000-000000000001' and object_deleted_at is null),
	0::bigint,
	'no object of the event remains in storage'
);
select ok(
	public.anonymize_event_memory_session(
		'e0000000-0000-0000-0000-000000000001', '10000000-0000-4000-8000-00000000000a',
		'anon-token-a', 'anon-recovery-a', now() + interval '1 day'
	),
	'the guest is anonymized after the purge'
);
select is(
	(select display_name from public.event_memory_sessions
		where id = '10000000-0000-4000-8000-00000000000a'),
	'Invitado retirado',
	'the display name is removed'
);
select is(
	(select count(*) from public.event_memory_items
		where event_id = 'e0000000-0000-0000-0000-000000000001'),
	6::bigint,
	'catalog rows are kept as the record that the files existed and were deleted'
);
select is(
	(select count(*) from public.event_memory_audit_events
		where event_id = 'e0000000-0000-0000-0000-000000000001' and action = 'guest_session_anonymized'),
	1::bigint,
	'the anonymization is audited without naming the guest'
);

select * from finish();
rollback;
