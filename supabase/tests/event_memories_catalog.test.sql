begin;

select plan(43);

-- Access boundary -----------------------------------------------------------
select ok(
	(select relrowsecurity from pg_catalog.pg_class where oid = 'public.event_memory_settings'::regclass),
	'settings keep RLS enabled'
);
select ok(
	(select relrowsecurity from pg_catalog.pg_class where oid = 'public.event_memory_sessions'::regclass),
	'guest sessions keep RLS enabled'
);
select ok(
	(select relrowsecurity from pg_catalog.pg_class where oid = 'public.event_memory_items'::regclass),
	'media items keep RLS enabled'
);
select ok(
	(select relrowsecurity from pg_catalog.pg_class where oid = 'public.event_memory_audit_events'::regclass),
	'audit events keep RLS enabled'
);
select ok(not has_table_privilege('anon', 'public.event_memory_settings', 'select'), 'anon cannot read settings');
select ok(not has_table_privilege('anon', 'public.event_memory_sessions', 'select'), 'anon cannot read guest sessions');
select ok(not has_table_privilege('authenticated', 'public.event_memory_items', 'select'), 'authenticated cannot read media items');
select ok(has_table_privilege('service_role', 'public.event_memory_sessions', 'select'), 'service role can read sessions');
select ok(
	has_function_privilege(
		'service_role',
		'public.reserve_event_memory_item(uuid,uuid,text,text,bigint,text,numeric,uuid,integer)',
		'execute'
	),
	'service role can execute the reservation RPC'
);
select ok(
	not has_function_privilege(
		'anon',
		'public.reserve_event_memory_item(uuid,uuid,text,text,bigint,text,numeric,uuid,integer)',
		'execute'
	),
	'anon cannot execute the reservation RPC'
);
select ok(
	not has_function_privilege('authenticated', 'public.anonymize_event_memory_session(uuid,uuid,text,text,timestamptz)', 'execute'),
	'authenticated cannot anonymize'
);

-- Two spaces on the seed events ---------------------------------------------
insert into public.event_memory_settings (
	event_id, public_slug, time_zone, upload_starts_at, upload_ends_at, retention_ends_at,
	max_event_objects, max_event_bytes, max_session_files, max_session_videos, max_session_bytes,
	entitlement
) values (
	'e0000000-0000-0000-0000-000000000001', 'space-open', 'America/Mazatlan',
	now() - interval '1 day', now() + interval '1 day', now() + interval '30 days',
	2000, 8000000000, 20, 5, 536870912, 'addon'
), (
	'e0000000-0000-0000-0000-000000000002', 'space-closed', 'America/Mexico_City',
	now() - interval '10 days', now() - interval '1 day', now() + interval '30 days',
	2000, 8000000000, 20, 5, 536870912, 'package'
);

select throws_ok($sql$
	insert into public.event_memory_settings (
		event_id, public_slug, time_zone, upload_starts_at, upload_ends_at, retention_ends_at,
		max_event_objects, max_event_bytes, max_session_files, max_session_videos, max_session_bytes,
		entitlement
	) values (
		'e0000000-0000-0000-0000-000000000001', 'Space Invalid', 'America/Mazatlan',
		now(), now() + interval '1 day', now() + interval '30 days',
		2000, 8000000000, 20, 5, 536870912, 'addon'
	)
$sql$, '23514', null, 'public slug must be lowercase kebab-case');

select throws_ok($sql$
	update public.event_memory_settings
	set retention_ends_at = upload_starts_at + interval '151 days'
	where public_slug = 'space-open'
$sql$, '23514', null, 'retention cannot exceed the object lifetime bound');

insert into public.event_memory_sessions (
	id, event_id, token_hash, recovery_code_hash, expires_at, display_name, guest_alias
) values (
	'10000000-0000-4000-8000-000000000001', 'e0000000-0000-0000-0000-000000000001',
	'open-token-hash', 'open-recovery-hash', now() + interval '30 days',
	'Invitado sintético', 'invitado-a1b2c3d4'
), (
	'10000000-0000-4000-8000-000000000002', 'e0000000-0000-0000-0000-000000000002',
	'closed-token-hash', 'closed-recovery-hash', now() + interval '30 days',
	'Invitado sintético', 'invitado-a1b2c3d4'
);

select is(
	(select count(*) from public.resolve_event_memory_session('e0000000-0000-0000-0000-000000000001', 'open-token-hash')),
	1::bigint,
	'a session resolves by token hash inside its own space'
);
select is(
	(select count(*) from public.resolve_event_memory_session('e0000000-0000-0000-0000-000000000002', 'open-token-hash')),
	0::bigint,
	'a session token never resolves in another space'
);
select is(
	(select count(*) from public.recover_event_memory_session('e0000000-0000-0000-0000-000000000001', 'open-recovery-hash', 'rotated-token-hash')),
	1::bigint,
	'recovery rotates the session token'
);
select is(
	(select token_hash from public.event_memory_sessions where id = '10000000-0000-4000-8000-000000000001'),
	'rotated-token-hash',
	'rotated token is persisted'
);

-- Reservation ----------------------------------------------------------------
select throws_ok($sql$
	select * from public.reserve_event_memory_item(
		'e0000000-0000-0000-0000-000000000002',
		'10000000-0000-4000-8000-000000000002',
		'events/e0000000-0000-0000-0000-000000000002/20000000-0000-4000-8000-000000000001.jpg',
		'image/jpeg', 100,
		'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		null, '30000000-0000-4000-8000-000000000001', 2
	)
$sql$, 'P0001', 'memories_upload_window_closed', 'a closed window rejects reservations');

select throws_ok($sql$
	select * from public.reserve_event_memory_item(
		'e0000000-0000-0000-0000-000000000001',
		'10000000-0000-4000-8000-000000000002',
		'events/e0000000-0000-0000-0000-000000000001/20000000-0000-4000-8000-000000000001.jpg',
		'image/jpeg', 100,
		'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		null, '30000000-0000-4000-8000-000000000001', 2
	)
$sql$, 'P0001', 'memories_session_unavailable', 'a session cannot reserve in another space');

select lives_ok($sql$
	select * from public.reserve_event_memory_item(
		'e0000000-0000-0000-0000-000000000001',
		'10000000-0000-4000-8000-000000000001',
		'events/e0000000-0000-0000-0000-000000000001/20000000-0000-4000-8000-000000000001.jpg',
		'image/jpeg', 100,
		'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		null, '30000000-0000-4000-8000-000000000001', 2
	)
$sql$, 'first reservation succeeds');
select is((select count(*) from public.event_memory_items), 1::bigint, 'first reservation creates one row');

select lives_ok($sql$
	select * from public.reserve_event_memory_item(
		'e0000000-0000-0000-0000-000000000001',
		'10000000-0000-4000-8000-000000000001',
		'events/e0000000-0000-0000-0000-000000000001/20000000-0000-4000-8000-000000000099.jpg',
		'image/jpeg', 100,
		'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		null, '30000000-0000-4000-8000-000000000001', 2
	)
$sql$, 'same idempotency key returns the original reservation');
select is((select count(*) from public.event_memory_items), 1::bigint, 'idempotent replay creates no row');

select lives_ok($sql$
	select * from public.reserve_event_memory_item(
		'e0000000-0000-0000-0000-000000000001',
		'10000000-0000-4000-8000-000000000001',
		'events/e0000000-0000-0000-0000-000000000001/20000000-0000-4000-8000-000000000002.jpg',
		'image/jpeg', 100,
		'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		null, '30000000-0000-4000-8000-000000000002', 2
	)
$sql$, 'second concurrent reservation succeeds');
select throws_ok($sql$
	select * from public.reserve_event_memory_item(
		'e0000000-0000-0000-0000-000000000001',
		'10000000-0000-4000-8000-000000000001',
		'events/e0000000-0000-0000-0000-000000000001/20000000-0000-4000-8000-000000000003.jpg',
		'image/jpeg', 100,
		'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
		null, '30000000-0000-4000-8000-000000000003', 2
	)
$sql$, 'P0001', 'memories_session_concurrency_quota', 'third in-flight reservation is rejected');

-- Validation and deduplication ----------------------------------------------
select lives_ok($sql$
	select * from public.claim_event_memory_validation(
		(select id from public.event_memory_items order by created_at, id limit 1),
		'10000000-0000-4000-8000-000000000001'
	)
$sql$, 'first item enters validation');
select lives_ok($sql$
	select * from public.finalize_event_memory_item(
		(select id from public.event_memory_items order by created_at, id limit 1),
		'10000000-0000-4000-8000-000000000001', 'accepted', now()
	)
$sql$, 'first checksum finalizes');
select is(
	(select status from public.event_memory_items order by created_at, id limit 1),
	'accepted',
	'first checksum becomes accepted'
);
select lives_ok($sql$
	select * from public.claim_event_memory_validation(
		(select id from public.event_memory_items order by created_at, id offset 1 limit 1),
		'10000000-0000-4000-8000-000000000001'
	)
$sql$, 'second item enters validation');
select lives_ok($sql$
	select * from public.finalize_event_memory_item(
		(select id from public.event_memory_items order by created_at, id offset 1 limit 1),
		'10000000-0000-4000-8000-000000000001', 'accepted', now() - interval '1 second'
	)
$sql$, 'duplicate checksum finalizes atomically');
select is(
	(select status from public.event_memory_items order by created_at, id offset 1 limit 1),
	'duplicate',
	'exactly one checksum winner remains accepted'
);

select is(
	(select count(*) from public.claim_event_memory_cleanup('40000000-0000-4000-8000-000000000001', 25, 900)),
	1::bigint,
	'due cleanup row is claimed once'
);
select is(
	(select count(*) from public.claim_event_memory_cleanup('40000000-0000-4000-8000-000000000002', 25, 900)),
	0::bigint,
	'active cleanup lease prevents a second claim'
);

-- Per-session video quota comes from the space row ---------------------------
insert into public.event_memory_items (
	event_id, session_id, object_key, mime_type, size_bytes, checksum_sha256,
	duration_seconds, status, accepted_at
)
select
	'e0000000-0000-0000-0000-000000000001',
	'10000000-0000-4000-8000-000000000001',
	'events/e0000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-' || lpad(value::text, 12, '0') || '.mp4',
	'video/mp4', 100, lpad(value::text, 64, '0'), 10, 'accepted', now()
from generate_series(1, 5) as value;
select throws_ok($sql$
	select * from public.reserve_event_memory_item(
		'e0000000-0000-0000-0000-000000000001',
		'10000000-0000-4000-8000-000000000001',
		'events/e0000000-0000-0000-0000-000000000001/50000000-0000-4000-8000-000000000006.mp4',
		'video/mp4', 100,
		'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
		10, '30000000-0000-4000-8000-000000000006', 2
	)
$sql$, 'P0001', 'memories_session_video_quota', 'sixth resident video is rejected');

-- Reservation expiry -----------------------------------------------------------
insert into public.event_memory_items (
	id, event_id, session_id, object_key, mime_type, size_bytes, checksum_sha256,
	status, created_at, updated_at
) values (
	'20000000-0000-4000-8000-000000000010',
	'e0000000-0000-0000-0000-000000000001',
	'10000000-0000-4000-8000-000000000001',
	'events/e0000000-0000-0000-0000-000000000001/20000000-0000-4000-8000-000000000010.jpg',
	'image/jpeg', 10,
	'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
	'uploading', now() - interval '1 hour', now() - interval '1 hour'
);
select is(
	public.expire_event_memory_reservations(now() - interval '10 minutes', now() - interval '30 days'),
	1::bigint,
	'expired upload reservation is scheduled for cleanup'
);
select is(
	(select status from public.event_memory_items where id = '20000000-0000-4000-8000-000000000010'),
	'deleted',
	'expired reservation becomes unavailable immediately'
);

-- Retention expiry schedules every resident object of the space ---------------
update public.event_memory_settings
set retention_ends_at = now() - interval '1 second', upload_ends_at = now() - interval '1 minute'
where public_slug = 'space-open';
-- Resident and unscheduled at this point: the accepted winner plus five videos.
select is(
	public.expire_event_memory_content(now()),
	6::bigint,
	'retention expiry schedules the resident objects that were not yet scheduled'
);
select is(
	(select count(*) from public.event_memory_items
		where event_id = 'e0000000-0000-0000-0000-000000000001' and cleanup_after is null),
	0::bigint,
	'no resident object of an expired space stays unscheduled'
);
select is(
	(select count(*) from public.resolve_event_memory_session('e0000000-0000-0000-0000-000000000001', 'rotated-token-hash')),
	0::bigint,
	'sessions stop resolving once the space retention ended'
);

-- Anonymization waits for physical deletion -----------------------------------
select ok(
	not public.anonymize_event_memory_session(
		'e0000000-0000-0000-0000-000000000001', '10000000-0000-4000-8000-000000000001',
		'anon-token', 'anon-recovery', now() + interval '1 day'
	),
	'resident objects prevent anonymization'
);
update public.event_memory_items set object_deleted_at = now()
where event_id = 'e0000000-0000-0000-0000-000000000001';
select ok(
	public.anonymize_event_memory_session(
		'e0000000-0000-0000-0000-000000000001', '10000000-0000-4000-8000-000000000001',
		'anon-token', 'anon-recovery', now() + interval '1 day'
	),
	'physical deletion enables anonymization'
);
select is(
	(select count(*) from public.event_memory_audit_events
		where event_id = 'e0000000-0000-0000-0000-000000000001' and action = 'guest_session_anonymized'),
	1::bigint,
	'anonymization writes one audit row'
);

insert into public.event_memory_audit_events (event_id, actor_type, action, expires_at)
values ('e0000000-0000-0000-0000-000000000001', 'system', 'synthetic_expired', now() - interval '1 second');
select is(public.purge_event_memory_audit(now()), 1::bigint, 'expired audit row is purged');

select * from finish();
rollback;
