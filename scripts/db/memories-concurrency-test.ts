/** Exercises event memories transaction and race invariants on disposable-test only. */
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {
	MEMORIES_LIMIT_PROFILES,
	MEMORIES_SESSION_MAX_IN_FLIGHT,
} from '../../src/lib/memories/contract/limits.ts';
import { buildMemoriesObjectKey } from '../../src/lib/memories/contract/object-key.ts';
import { DISPOSABLE_DB_URL } from './db-workflow-lib.ts';

/** Seed event from supabase/test/seed-test-data.sql. */
const SEED_EVENT_ID = 'e0000000-0000-0000-0000-000000000002';
const LIMITS = MEMORIES_LIMIT_PROFILES.standard;

type PsqlResult = { status: number; stdout: string; stderr: string; elapsedMs: number };

function psqlArgs(sql: string): string[] {
	return [
		'--set',
		'ON_ERROR_STOP=1',
		'--tuples-only',
		'--no-align',
		'--dbname',
		DISPOSABLE_DB_URL,
		'--command',
		sql,
	];
}

function runPsql(sql: string): string {
	const result = spawnSync('psql', psqlArgs(sql), { encoding: 'utf8' });
	if (result.status !== 0) throw new Error(result.stderr || result.stdout);
	return result.stdout.trim();
}

function runConcurrentPsql(sql: string): Promise<PsqlResult> {
	return new Promise((resolve, reject) => {
		const startedAt = performance.now();
		const child = spawn('psql', psqlArgs(sql), { stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
		child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
		child.on('error', reject);
		child.on('close', (code) =>
			resolve({
				status: code ?? 1,
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				elapsedMs: performance.now() - startedAt,
			}),
		);
	});
}

function reservationSql(input: {
	sessionId: string;
	objectId: string;
	requestId: string;
	checksum: string;
	mimeType?: 'image/jpeg' | 'video/mp4';
}): string {
	const mimeType = input.mimeType ?? 'image/jpeg';
	const extension = mimeType === 'video/mp4' ? 'mp4' : 'jpg';
	const duration = mimeType === 'video/mp4' ? '10' : 'null';
	return `select id from public.reserve_event_memory_item(
		'${SEED_EVENT_ID}', '${input.sessionId}', '${buildMemoriesObjectKey(SEED_EVENT_ID, input.objectId, extension)}',
		'${mimeType}', 100, '${input.checksum}', ${duration}, '${input.requestId}', ${MEMORIES_SESSION_MAX_IN_FLIGHT}
	);`;
}

function percentile(values: number[], percentileValue: number): number {
	const sorted = [...values].sort((left, right) => left - right);
	const index = Math.min(
		sorted.length - 1,
		Math.ceil((percentileValue / 100) * sorted.length) - 1,
	);
	return Math.round(sorted[index] * 100) / 100;
}

function ensureSpace(maxSessionFiles: number = LIMITS.maxSessionFiles): void {
	runPsql(`insert into public.event_memory_settings (
		event_id, public_slug, time_zone, upload_starts_at, upload_ends_at, retention_ends_at,
		max_event_objects, max_event_bytes, max_session_files, max_session_videos, max_session_bytes, entitlement
	) values (
		'${SEED_EVENT_ID}', 'concurrency-test', 'America/Mazatlan',
		now() - interval '1 day', now() + interval '1 day', now() + interval '30 days',
		${LIMITS.maxEventObjects}, ${LIMITS.maxEventBytes}, ${maxSessionFiles}, ${LIMITS.maxSessionVideos}, ${LIMITS.maxSessionBytes}, 'courtesy'
	) on conflict (event_id) do update set
		upload_starts_at = excluded.upload_starts_at, upload_ends_at = excluded.upload_ends_at,
		retention_ends_at = excluded.retention_ends_at, max_session_files = excluded.max_session_files;`);
}

function insertSession(sessionId: string): void {
	runPsql(`insert into public.event_memory_sessions (
		id, event_id, token_hash, recovery_code_hash, expires_at, display_name, guest_alias
	) values (
		'${sessionId}', '${SEED_EVENT_ID}', '${randomUUID()}', '${randomUUID()}', now() + interval '1 day',
		'Invitado sintetico', 'invitado-${randomUUID().replace(/-/g, '').slice(0, 8)}'
	);`);
}

function anonymizationSql(sessionId: string, suffix: string): string {
	return `select public.anonymize_event_memory_session('${SEED_EVENT_ID}','${sessionId}','anonymized-${sessionId}-${suffix}','recovery-${sessionId}-${suffix}',now()+interval '1 day');`;
}

// eslint-disable-next-line complexity -- This disposable harness verifies independent SQL invariants sequentially.
async function main(): Promise<void> {
	const createdSessions: string[] = [];
	ensureSpace();
	try {
		const anonymizationSession = randomUUID();
		createdSessions.push(anonymizationSession);
		insertSession(anonymizationSession);
		const auditCountBefore = Number(
			runPsql(
				"select count(*) from public.event_memory_audit_events where action='guest_session_anonymized'",
			),
		);
		const anonymizationResults = await Promise.all([
			runConcurrentPsql(anonymizationSql(anonymizationSession, 'a')),
			runConcurrentPsql(anonymizationSql(anonymizationSession, 'b')),
		]);
		if (
			anonymizationResults.some((result) => result.status !== 0) ||
			anonymizationResults
				.map((result) => result.stdout)
				.sort()
				.join(',') !== 'f,t'
		)
			throw new Error('Concurrent anonymization must have exactly one winner.');
		const auditCountAfter = Number(
			runPsql(
				"select count(*) from public.event_memory_audit_events where action='guest_session_anonymized'",
			),
		);
		if (auditCountAfter !== auditCountBefore + 1)
			throw new Error('Concurrent anonymization duplicated its audit.');
		console.info('Concurrent anonymization: one update, one audit, one no-op.');

		const raceSession = randomUUID();
		createdSessions.push(raceSession);
		insertSession(raceSession);
		const [anonymized, reserved] = await Promise.all([
			runConcurrentPsql(anonymizationSql(raceSession, 'race')),
			runConcurrentPsql(
				reservationSql({
					sessionId: raceSession,
					objectId: randomUUID(),
					requestId: randomUUID(),
					checksum: '1234567890abcdef'.repeat(4),
				}),
			),
		]);
		if (
			anonymized.status !== 0 ||
			(anonymized.stdout === 't'
				? reserved.status === 0 || !reserved.stderr.includes('memories_session_unavailable')
				: anonymized.stdout !== 'f' || reserved.status !== 0)
		)
			throw new Error('Reservation and anonymization race violated session ownership.');
		console.info('Reservation/anonymization race: only one operation succeeds.');

		const idempotencySession = randomUUID();
		createdSessions.push(idempotencySession);
		insertSession(idempotencySession);
		const idempotencyKey = randomUUID();
		const replayChecksum = 'a'.repeat(64);
		const replayResults = await Promise.all([
			runConcurrentPsql(
				reservationSql({
					sessionId: idempotencySession,
					objectId: randomUUID(),
					requestId: idempotencyKey,
					checksum: replayChecksum,
				}),
			),
			runConcurrentPsql(
				reservationSql({
					sessionId: idempotencySession,
					objectId: randomUUID(),
					requestId: idempotencyKey,
					checksum: replayChecksum,
				}),
			),
		]);
		if (replayResults.some((result) => result.status !== 0))
			throw new Error('Concurrent idempotency request failed.');
		if (new Set(replayResults.map((result) => result.stdout)).size !== 1)
			throw new Error('Concurrent idempotency returned different media rows.');

		ensureSpace(1);
		const recoverySession = randomUUID();
		createdSessions.push(recoverySession);
		insertSession(recoverySession);
		const recoveryRequestId = randomUUID();
		const recoveryChecksum = 'b'.repeat(64);
		const recoveryId = runPsql(
			reservationSql({
				sessionId: recoverySession,
				objectId: randomUUID(),
				requestId: recoveryRequestId,
				checksum: recoveryChecksum,
			}),
		);
		const recoveryReplayId = runPsql(
			reservationSql({
				sessionId: recoverySession,
				objectId: randomUUID(),
				requestId: recoveryRequestId,
				checksum: recoveryChecksum,
			}),
		);
		if (recoveryReplayId !== recoveryId)
			throw new Error('Signer-failure retry did not replay the original reservation.');
		runPsql(
			`update public.event_memory_items set created_at = now() - interval '20 minutes' where id = '${recoveryId}';`,
		);
		const expired = Number(
			runPsql(
				`select public.expire_event_memory_reservations(now() - interval '10 minutes', now() - interval '150 days');`,
			),
		);
		if (expired < 1)
			throw new Error('Expired signer-failure reservation was not scheduled for cleanup.');
		const residentState = runPsql(
			`select status || ':' || (object_deleted_at is null)::text from public.event_memory_items where id = '${recoveryId}';`,
		);
		if (residentState !== 'deleted:true')
			throw new Error('Expired reservation did not remain resident until physical cleanup.');
		const heldQuota = await runConcurrentPsql(
			reservationSql({
				sessionId: recoverySession,
				objectId: randomUUID(),
				requestId: randomUUID(),
				checksum: 'c'.repeat(64),
			}),
		);
		if (heldQuota.status === 0 || !heldQuota.stderr.includes('memories_session_file_quota'))
			throw new Error('Logical cleanup incorrectly released resident reservation quota.');
		runPsql(
			`update public.event_memory_items set object_deleted_at = now() where id = '${recoveryId}';`,
		);
		const recoveredQuota = await runConcurrentPsql(
			reservationSql({
				sessionId: recoverySession,
				objectId: randomUUID(),
				requestId: randomUUID(),
				checksum: 'd'.repeat(64),
			}),
		);
		if (recoveredQuota.status !== 0)
			throw new Error('Physical cleanup did not release the expired reservation quota.');
		ensureSpace();

		const quotaSession = randomUUID();
		createdSessions.push(quotaSession);
		insertSession(quotaSession);
		const quotaResults = await Promise.all(
			Array.from({ length: MEMORIES_SESSION_MAX_IN_FLIGHT + 1 }, (_, index) =>
				runConcurrentPsql(
					reservationSql({
						sessionId: quotaSession,
						objectId: randomUUID(),
						requestId: randomUUID(),
						checksum: `${index + 1}`.padStart(64, '0'),
					}),
				),
			),
		);
		const quotaSuccesses = quotaResults.filter((result) => result.status === 0);
		const quotaFailures = quotaResults.filter((result) => result.status !== 0);
		if (
			quotaSuccesses.length !== MEMORIES_SESSION_MAX_IN_FLIGHT ||
			quotaFailures.length !== 1 ||
			!quotaFailures[0].stderr.includes('memories_session_concurrency_quota')
		)
			throw new Error('Concurrent session quota did not serialize deterministically.');

		const videoQuotaSession = randomUUID();
		createdSessions.push(videoQuotaSession);
		insertSession(videoQuotaSession);
		for (let index = 0; index < LIMITS.maxSessionVideos; index += 1) {
			runPsql(`insert into public.event_memory_items (
				event_id, session_id, object_key, mime_type, size_bytes, checksum_sha256, duration_seconds, status, accepted_at
			) values (
				'${SEED_EVENT_ID}', '${videoQuotaSession}', '${buildMemoriesObjectKey(SEED_EVENT_ID, randomUUID(), 'mp4')}',
				'video/mp4', 100, '${String(index + 1).padStart(64, '0')}', 10, 'accepted', now()
			);`);
		}
		const videoQuotaResult = await runConcurrentPsql(
			reservationSql({
				sessionId: videoQuotaSession,
				objectId: randomUUID(),
				requestId: randomUUID(),
				checksum: 'f'.repeat(64),
				mimeType: 'video/mp4',
			}),
		);
		if (
			videoQuotaResult.status === 0 ||
			!videoQuotaResult.stderr.includes('memories_session_video_quota')
		)
			throw new Error('Per-session video quota was not enforced.');

		const dedupSession = randomUUID();
		createdSessions.push(dedupSession);
		insertSession(dedupSession);
		const dedupChecksum = 'e'.repeat(64);
		const firstId = runPsql(
			reservationSql({
				sessionId: dedupSession,
				objectId: randomUUID(),
				requestId: randomUUID(),
				checksum: dedupChecksum,
			}),
		);
		const secondId = runPsql(
			reservationSql({
				sessionId: dedupSession,
				objectId: randomUUID(),
				requestId: randomUUID(),
				checksum: dedupChecksum,
			}),
		);
		runPsql(
			`select * from public.claim_event_memory_validation('${firstId}', '${dedupSession}');`,
		);
		runPsql(
			`select * from public.claim_event_memory_validation('${secondId}', '${dedupSession}');`,
		);
		const finalize = (itemId: string) =>
			runConcurrentPsql(
				`select status from public.finalize_event_memory_item('${itemId}', '${dedupSession}', 'accepted', now());`,
			);
		const finalizeResults = await Promise.all([finalize(firstId), finalize(secondId)]);
		if (finalizeResults.some((result) => result.status !== 0))
			throw new Error('Concurrent checksum finalization failed.');
		const dedupState = runPsql(
			`select count(*) filter (where status = 'accepted') || ':' || count(*) filter (where status = 'duplicate') from public.event_memory_items where id in ('${firstId}', '${secondId}');`,
		);
		if (dedupState !== '1:1')
			throw new Error(`Unexpected concurrent dedup state: ${dedupState}`);

		const raceItemSession = randomUUID();
		createdSessions.push(raceItemSession);
		insertSession(raceItemSession);
		const raceId = runPsql(
			reservationSql({
				sessionId: raceItemSession,
				objectId: randomUUID(),
				requestId: randomUUID(),
				checksum: '9'.repeat(64),
			}),
		);
		runPsql(
			`select * from public.claim_event_memory_validation('${raceId}', '${raceItemSession}');`,
		);
		const raceResults = await Promise.all([
			runConcurrentPsql(
				`select status from public.finalize_event_memory_item('${raceId}', '${raceItemSession}', 'accepted', now());`,
			),
			runConcurrentPsql(
				`update public.event_memory_items set status = 'deleted', deleted_at = now(), cleanup_after = now() where id = '${raceId}' returning status;`,
			),
		]);
		if (raceResults.some((result) => result.status !== 0))
			throw new Error('Delete/finalize race failed to complete.');
		if (
			runPsql(`select status from public.event_memory_items where id = '${raceId}';`) !==
			'deleted'
		)
			throw new Error('Delete/finalize race made the item available again.');

		// The duplicate and the deleted race item are both due for cleanup.
		const leaseResults = await Promise.all([
			runConcurrentPsql(
				`select id from public.claim_event_memory_cleanup('${randomUUID()}', 1, 900);`,
			),
			runConcurrentPsql(
				`select id from public.claim_event_memory_cleanup('${randomUUID()}', 1, 900);`,
			),
		]);
		if (leaseResults.some((result) => result.status !== 0))
			throw new Error('Concurrent cleanup claim failed.');
		const claimedIds = leaseResults.map((result) => result.stdout).filter(Boolean);
		if (claimedIds.length !== 2 || new Set(claimedIds).size !== 2)
			throw new Error('Concurrent cleanup leases claimed overlapping work.');

		const contentionSessions = Array.from({ length: 100 }, () => randomUUID());
		for (const sessionId of contentionSessions) {
			createdSessions.push(sessionId);
			insertSession(sessionId);
		}
		const contentionStartedAt = performance.now();
		const contentionResults = await Promise.all(
			contentionSessions.map((sessionId, index) =>
				runConcurrentPsql(
					reservationSql({
						sessionId,
						objectId: randomUUID(),
						requestId: randomUUID(),
						checksum: String(index + 1).padStart(64, '0'),
					}),
				),
			),
		);
		if (contentionResults.some((result) => result.status !== 0))
			throw new Error(
				'The 100-reservation contention measurement did not complete correctly.',
			);
		const latencies = contentionResults.map((result) => result.elapsedMs);
		console.info(
			JSON.stringify({
				status: 'passed',
				coverage: [
					'anonymization_idempotency',
					'anonymization_reservation_race',
					'idempotency',
					'quota',
					'signer_failure_recovery',
					'deduplication',
					'delete_race',
					'cleanup_leases',
					'event_reservation_contention',
				],
				contention: {
					reservations: contentionResults.length,
					wallMs: Math.round((performance.now() - contentionStartedAt) * 100) / 100,
					p50Ms: percentile(latencies, 50),
					p95Ms: percentile(latencies, 95),
					p99Ms: percentile(latencies, 99),
					maxMs: Math.round(Math.max(...latencies) * 100) / 100,
				},
			}),
		);
	} finally {
		if (createdSessions.length > 0) {
			const ids = createdSessions.map((id) => `'${id}'`).join(',');
			runPsql(
				`delete from public.event_memory_audit_events where media_item_id in (select id from public.event_memory_items where session_id in (${ids}));`,
			);
			runPsql(`delete from public.event_memory_items where session_id in (${ids});`);
			runPsql(`delete from public.event_memory_sessions where id in (${ids});`);
		}
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
