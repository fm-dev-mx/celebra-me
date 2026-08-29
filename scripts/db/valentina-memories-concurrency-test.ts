/** Exercises Valentina Memories transaction and race invariants on disposable-test only. */
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {
	VALENTINA_MEMORIES_EVENT_MAX_BYTES,
	VALENTINA_MEMORIES_EVENT_MAX_OBJECTS,
	VALENTINA_MEMORIES_OBJECT_PREFIX,
	VALENTINA_MEMORIES_SESSION_MAX_BYTES,
	VALENTINA_MEMORIES_SESSION_MAX_FILES,
	VALENTINA_MEMORIES_SESSION_MAX_IN_FLIGHT,
	VALENTINA_MEMORIES_SESSION_MAX_VIDEOS,
} from '../../src/data/valentina-memories-upload.contract.ts';
import { DISPOSABLE_DB_URL } from './db-workflow-lib.ts';

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
	maxSessionFiles?: number;
}): string {
	const mimeType = input.mimeType ?? 'image/jpeg';
	const extension = mimeType === 'video/mp4' ? 'mp4' : 'jpg';
	const duration = mimeType === 'video/mp4' ? '10' : 'null';
	return `select id from public.reserve_valentina_memory_item(
		'valentina', '${input.sessionId}', '${VALENTINA_MEMORIES_OBJECT_PREFIX}${input.objectId}.${extension}',
		'${mimeType}', 100, '${input.checksum}', ${duration}, '${input.requestId}',
		${input.maxSessionFiles ?? VALENTINA_MEMORIES_SESSION_MAX_FILES}, ${VALENTINA_MEMORIES_SESSION_MAX_VIDEOS}, ${VALENTINA_MEMORIES_SESSION_MAX_BYTES},
		${VALENTINA_MEMORIES_SESSION_MAX_IN_FLIGHT}, ${VALENTINA_MEMORIES_EVENT_MAX_OBJECTS},
		${VALENTINA_MEMORIES_EVENT_MAX_BYTES}
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

function insertSession(sessionId: string): void {
	runPsql(`insert into public.valentina_memory_sessions (
		id, event_key, token_hash, recovery_code_hash, expires_at, display_name, guest_alias
	) values (
		'${sessionId}', 'valentina', '${randomUUID()}', '${randomUUID()}', now() + interval '1 day',
		'Invitado sintetico', 'invitado-${randomUUID().replace(/-/g, '').slice(0, 8)}'
	);`);
}

// eslint-disable-next-line complexity -- This disposable harness verifies independent SQL invariants sequentially.
async function main(): Promise<void> {
	const createdSessions: string[] = [];
	try {
		const idempotencySession = randomUUID();
		createdSessions.push(idempotencySession);
		insertSession(idempotencySession);
		const idempotencyKey = randomUUID();
		const replayChecksum = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
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

		const recoverySession = randomUUID();
		createdSessions.push(recoverySession);
		insertSession(recoverySession);
		const recoveryRequestId = randomUUID();
		const recoveryChecksum = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
		const recoveryId = runPsql(
			reservationSql({
				sessionId: recoverySession,
				objectId: randomUUID(),
				requestId: recoveryRequestId,
				checksum: recoveryChecksum,
				maxSessionFiles: 1,
			}),
		);
		const recoveryReplayId = runPsql(
			reservationSql({
				sessionId: recoverySession,
				objectId: randomUUID(),
				requestId: recoveryRequestId,
				checksum: recoveryChecksum,
				maxSessionFiles: 1,
			}),
		);
		if (recoveryReplayId !== recoveryId)
			throw new Error('Signer-failure retry did not replay the original reservation.');
		runPsql(
			`update public.valentina_memory_items set created_at = now() - interval '20 minutes' where id = '${recoveryId}';`,
		);
		const expired = Number(
			runPsql(
				`select public.expire_valentina_memory_reservations(now() - interval '10 minutes', now() - interval '30 days');`,
			),
		);
		if (expired < 1)
			throw new Error('Expired signer-failure reservation was not scheduled for cleanup.');
		const residentDeletedState = runPsql(
			`select status || ':' || (object_deleted_at is null)::text from public.valentina_memory_items where id = '${recoveryId}';`,
		);
		if (residentDeletedState !== 'deleted:true')
			throw new Error('Expired reservation did not remain resident until physical cleanup.');
		const heldQuota = await runConcurrentPsql(
			reservationSql({
				sessionId: recoverySession,
				objectId: randomUUID(),
				requestId: randomUUID(),
				checksum: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
				maxSessionFiles: 1,
			}),
		);
		if (heldQuota.status === 0 || !heldQuota.stderr.includes('memories_session_file_quota'))
			throw new Error('Logical cleanup incorrectly released resident reservation quota.');
		runPsql(
			`update public.valentina_memory_items set object_deleted_at = now() where id = '${recoveryId}';`,
		);
		const recoveredQuota = await runConcurrentPsql(
			reservationSql({
				sessionId: recoverySession,
				objectId: randomUUID(),
				requestId: randomUUID(),
				checksum: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
				maxSessionFiles: 1,
			}),
		);
		if (recoveredQuota.status !== 0)
			throw new Error('Physical cleanup did not release the expired reservation quota.');

		const quotaSession = randomUUID();
		createdSessions.push(quotaSession);
		insertSession(quotaSession);
		const quotaResults = await Promise.all(
			Array.from({ length: VALENTINA_MEMORIES_SESSION_MAX_IN_FLIGHT + 1 }, (_, index) =>
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
			quotaSuccesses.length !== VALENTINA_MEMORIES_SESSION_MAX_IN_FLIGHT ||
			quotaFailures.length !== 1 ||
			!quotaFailures[0].stderr.includes('memories_session_concurrency_quota')
		) {
			throw new Error('Concurrent session quota did not serialize deterministically.');
		}

		const videoQuotaSession = randomUUID();
		createdSessions.push(videoQuotaSession);
		insertSession(videoQuotaSession);
		for (let index = 0; index < VALENTINA_MEMORIES_SESSION_MAX_VIDEOS; index += 1) {
			runPsql(`insert into public.valentina_memory_items (
				event_key, session_id, object_key, mime_type, size_bytes, checksum_sha256,
				duration_seconds, status, accepted_at
			) values (
				'valentina', '${videoQuotaSession}', '${VALENTINA_MEMORIES_OBJECT_PREFIX}${randomUUID()}.mp4',
				'video/mp4', 100, '${String(index + 1).padStart(64, '0')}', 10, 'accepted', now()
			);`);
		}
		const videoQuotaResult = await runConcurrentPsql(
			reservationSql({
				sessionId: videoQuotaSession,
				objectId: randomUUID(),
				requestId: randomUUID(),
				checksum: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
				mimeType: 'video/mp4',
			}),
		);
		if (
			videoQuotaResult.status === 0 ||
			!videoQuotaResult.stderr.includes('memories_session_video_quota')
		) {
			throw new Error('Per-session video quota was not enforced.');
		}

		const dedupSession = randomUUID();
		createdSessions.push(dedupSession);
		insertSession(dedupSession);
		const dedupChecksum = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
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
			`select * from public.claim_valentina_memory_validation('${firstId}', '${dedupSession}');`,
		);
		runPsql(
			`select * from public.claim_valentina_memory_validation('${secondId}', '${dedupSession}');`,
		);
		const finalize = (itemId: string) =>
			runConcurrentPsql(
				`select status from public.finalize_valentina_memory_item('${itemId}', '${dedupSession}', 'accepted', now());`,
			);
		const finalizeResults = await Promise.all([finalize(firstId), finalize(secondId)]);
		if (finalizeResults.some((result) => result.status !== 0))
			throw new Error('Concurrent checksum finalization failed.');
		const dedupState = runPsql(
			`select count(*) filter (where status = 'accepted') || ':' || count(*) filter (where status = 'duplicate') from public.valentina_memory_items where id in ('${firstId}', '${secondId}');`,
		);
		if (dedupState !== '1:1')
			throw new Error(`Unexpected concurrent dedup state: ${dedupState}`);

		const raceSession = randomUUID();
		createdSessions.push(raceSession);
		insertSession(raceSession);
		const raceId = runPsql(
			reservationSql({
				sessionId: raceSession,
				objectId: randomUUID(),
				requestId: randomUUID(),
				checksum: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
			}),
		);
		runPsql(
			`select * from public.claim_valentina_memory_validation('${raceId}', '${raceSession}');`,
		);
		const raceResults = await Promise.all([
			runConcurrentPsql(
				`select status from public.finalize_valentina_memory_item('${raceId}', '${raceSession}', 'accepted', now());`,
			),
			runConcurrentPsql(
				`update public.valentina_memory_items set status = 'deleted', deleted_at = now(), cleanup_after = now() where id = '${raceId}' returning status;`,
			),
		]);
		if (raceResults.some((result) => result.status !== 0))
			throw new Error('Delete/finalize race failed to complete.');
		if (
			runPsql(`select status from public.valentina_memory_items where id = '${raceId}';`) !==
			'deleted'
		)
			throw new Error('Delete/finalize race made the item available again.');

		const leaseResults = await Promise.all([
			runConcurrentPsql(
				`select id from public.claim_valentina_memory_cleanup('${randomUUID()}', 1, 900);`,
			),
			runConcurrentPsql(
				`select id from public.claim_valentina_memory_cleanup('${randomUUID()}', 1, 900);`,
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
		const contentionLatencies = contentionResults.map((result) => result.elapsedMs);
		const contentionEvidence = {
			reservations: contentionResults.length,
			wallMs: Math.round((performance.now() - contentionStartedAt) * 100) / 100,
			p50Ms: percentile(contentionLatencies, 50),
			p95Ms: percentile(contentionLatencies, 95),
			p99Ms: percentile(contentionLatencies, 99),
			maxMs: Math.round(Math.max(...contentionLatencies) * 100) / 100,
		};

		console.info(
			JSON.stringify({
				status: 'passed',
				coverage: [
					'idempotency',
					'quota',
					'signer_failure_recovery',
					'deduplication',
					'delete_race',
					'cleanup_leases',
					'event_reservation_contention',
				],
				contention: contentionEvidence,
			}),
		);
	} finally {
		if (createdSessions.length > 0) {
			runPsql(
				`delete from public.valentina_memory_sessions where id in (${createdSessions.map((id) => `'${id}'`).join(',')});`,
			);
		}
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
