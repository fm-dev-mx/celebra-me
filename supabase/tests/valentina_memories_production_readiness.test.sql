begin;

select plan(31);

select ok(
	(select relrowsecurity from pg_catalog.pg_class where oid = 'public.valentina_memory_sessions'::regclass),
	'guest sessions keep RLS enabled'
);
select ok(
	(select relrowsecurity from pg_catalog.pg_class where oid = 'public.valentina_memory_items'::regclass),
	'media items keep RLS enabled'
);
select ok(
	(select relrowsecurity from pg_catalog.pg_class where oid = 'public.valentina_memory_audit_events'::regclass),
	'audit events keep RLS enabled'
);
select ok(not has_table_privilege('anon', 'public.valentina_memory_sessions', 'select'), 'anon cannot read guest sessions');
select ok(not has_table_privilege('authenticated', 'public.valentina_memory_items', 'select'), 'authenticated cannot read media items');
select ok(has_table_privilege('service_role', 'public.valentina_memory_sessions', 'select'), 'service role can read sessions');
select ok(
	has_function_privilege(
		'service_role',
		'public.reserve_valentina_memory_item(text,uuid,text,text,bigint,text,numeric,uuid,integer,integer,bigint,integer,integer,bigint)',
		'execute'
	),
	'service role can execute the reservation RPC'
);
select ok(
	not has_function_privilege(
		'anon',
		'public.reserve_valentina_memory_item(text,uuid,text,text,bigint,text,numeric,uuid,integer,integer,bigint,integer,integer,bigint)',
		'execute'
	),
	'anon cannot execute the reservation RPC'
);

insert into public.valentina_memory_sessions (
	id, event_key, token_hash, recovery_code_hash, expires_at, display_name, guest_alias
) values (
	'10000000-0000-4000-8000-000000000001',
	'valentina',
	'readiness-token-hash',
	'readiness-recovery-hash',
	now() + interval '1 day',
	'Invitado sintético',
	'invitado-a1b2c3d4'
);

select lives_ok($sql$
	select * from public.reserve_valentina_memory_item(
		'valentina',
		'10000000-0000-4000-8000-000000000001',
		'events/valentina/20000000-0000-4000-8000-000000000001.jpg',
		'image/jpeg', 100,
		'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		null,
		'30000000-0000-4000-8000-000000000001',
		20, 5, 536870912, 2, 2000, 8000000000
	)
$sql$, 'first reservation succeeds');
select is((select count(*) from public.valentina_memory_items), 1::bigint, 'first reservation creates one row');

select lives_ok($sql$
	select * from public.reserve_valentina_memory_item(
		'valentina',
		'10000000-0000-4000-8000-000000000001',
		'events/valentina/20000000-0000-4000-8000-000000000099.jpg',
		'image/jpeg', 100,
		'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		null,
		'30000000-0000-4000-8000-000000000001',
		20, 5, 536870912, 2, 2000, 8000000000
	)
$sql$, 'same idempotency key returns the original reservation');
select is((select count(*) from public.valentina_memory_items), 1::bigint, 'idempotent replay creates no row');

select lives_ok($sql$
	select * from public.reserve_valentina_memory_item(
		'valentina',
		'10000000-0000-4000-8000-000000000001',
		'events/valentina/20000000-0000-4000-8000-000000000002.jpg',
		'image/jpeg', 100,
		'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		null,
		'30000000-0000-4000-8000-000000000002',
		20, 5, 536870912, 2, 2000, 8000000000
	)
$sql$, 'second concurrent reservation succeeds');
select throws_ok($sql$
	select * from public.reserve_valentina_memory_item(
		'valentina',
		'10000000-0000-4000-8000-000000000001',
		'events/valentina/20000000-0000-4000-8000-000000000003.jpg',
		'image/jpeg', 100,
		'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
		null,
		'30000000-0000-4000-8000-000000000003',
		20, 5, 536870912, 2, 2000, 8000000000
	)
$sql$, 'P0001', 'memories_session_concurrency_quota', 'third in-flight reservation is rejected');

select lives_ok($sql$
	select * from public.claim_valentina_memory_validation(
		(select id from public.valentina_memory_items order by created_at, id limit 1),
		'10000000-0000-4000-8000-000000000001'
	)
$sql$, 'first item enters validation');
select lives_ok($sql$
	select * from public.finalize_valentina_memory_item(
		(select id from public.valentina_memory_items order by created_at, id limit 1),
		'10000000-0000-4000-8000-000000000001', 'accepted', now()
	)
$sql$, 'first checksum finalizes');
select is(
	(select status from public.valentina_memory_items order by created_at, id limit 1),
	'accepted',
	'first checksum becomes accepted'
);
select lives_ok($sql$
	select * from public.claim_valentina_memory_validation(
		(select id from public.valentina_memory_items order by created_at, id offset 1 limit 1),
		'10000000-0000-4000-8000-000000000001'
	)
$sql$, 'second item enters validation');
select lives_ok($sql$
	select * from public.finalize_valentina_memory_item(
		(select id from public.valentina_memory_items order by created_at, id offset 1 limit 1),
		'10000000-0000-4000-8000-000000000001', 'accepted', now() - interval '1 second'
	)
$sql$, 'duplicate checksum finalizes atomically');
select is(
	(select status from public.valentina_memory_items order by created_at, id offset 1 limit 1),
	'duplicate',
	'exactly one checksum winner remains accepted'
);

select is(
	(select count(*) from public.claim_valentina_memory_cleanup(
		'40000000-0000-4000-8000-000000000001', 25, 900
	)),
	1::bigint,
	'due cleanup row is claimed once'
);
select is(
	(select count(*) from public.claim_valentina_memory_cleanup(
		'40000000-0000-4000-8000-000000000002', 25, 900
	)),
	0::bigint,
	'active cleanup lease prevents a second claim'
);

insert into public.valentina_memory_items (
	event_key, session_id, object_key, mime_type, size_bytes, checksum_sha256,
	duration_seconds, status, accepted_at
)
select
	'valentina',
	'10000000-0000-4000-8000-000000000001',
	'events/valentina/50000000-0000-4000-8000-' || lpad(value::text, 12, '0') || '.mp4',
	'video/mp4', 100, lpad(value::text, 64, '0'), 10, 'accepted', now()
from generate_series(1, 5) as value;
select throws_ok($sql$
	select * from public.reserve_valentina_memory_item(
		'valentina',
		'10000000-0000-4000-8000-000000000001',
		'events/valentina/50000000-0000-4000-8000-000000000006.mp4',
		'video/mp4', 100,
		'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
		10,
		'30000000-0000-4000-8000-000000000006',
		20, 5, 536870912, 2, 2000, 8000000000
	)
$sql$, 'P0001', 'memories_session_video_quota', 'sixth resident video is rejected');

insert into public.valentina_memory_items (
	id, event_key, session_id, object_key, mime_type, size_bytes, checksum_sha256,
	status, created_at, updated_at
) values (
	'20000000-0000-4000-8000-000000000010',
	'valentina',
	'10000000-0000-4000-8000-000000000001',
	'events/valentina/20000000-0000-4000-8000-000000000010.jpg',
	'image/jpeg', 10,
	'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
	'uploading', now() - interval '1 hour', now() - interval '1 hour'
);
select is(
	public.expire_valentina_memory_reservations(now() - interval '10 minutes', now() - interval '30 days'),
	1::bigint,
	'expired upload reservation is scheduled for cleanup'
);
select is(
	(select status from public.valentina_memory_items where id = '20000000-0000-4000-8000-000000000010'),
	'deleted',
	'expired reservation becomes unavailable immediately'
);

insert into public.valentina_memory_audit_events (
	event_key, actor_type, action, expires_at
) values ('valentina', 'system', 'synthetic_expired', now() - interval '1 second');
select is(public.purge_valentina_memory_audit(now()), 1::bigint, 'expired audit row is purged');
select is((select count(*) from public.valentina_memory_audit_events), 0::bigint, 'audit purge leaves no expired row');

select ok(
	(select duplicate_of_id is not null from public.valentina_memory_items where status = 'duplicate'),
	'duplicate keeps only its private winner relation in the catalog'
);
select is(
	(select count(*) from public.valentina_memory_items
		where status = 'accepted'
			and checksum_sha256 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
	1::bigint,
	'deduplication leaves exactly one accepted object'
);
select is(
	(select count(*) from public.valentina_memory_items where object_deleted_at is null),
	8::bigint,
	'reserved objects continue consuming quota until physical deletion is recorded'
);
select ok(
	has_function_privilege(
		'service_role',
		'public.claim_valentina_memory_cleanup(uuid,integer,integer)',
		'execute'
	),
	'service role can claim cleanup work'
);

select * from finish();
rollback;
