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
} from '../../src/data/valentina-memories-upload.contract.ts';
import { DISPOSABLE_DB_URL } from './db-workflow-lib.ts';

type PsqlResult = { status: number; stdout: string; stderr: string };

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
		const child = spawn('psql', psqlArgs(sql), { stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
		child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
		child.on('error', reject);
		child.on('close', (code) =>
			resolve({ status: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() }),
		);
	});
}

function reservationSql(input: {
	sessionId: string;
	objectId: string;
	requestId: string;
	checksum: string;
}): string {
	return `select id from public.reserve_valentina_memory_item(
		'valentina', '${input.sessionId}', '${VALENTINA_MEMORIES_OBJECT_PREFIX}${input.objectId}.jpg',
		'image/jpeg', 100, '${input.checksum}', null, '${input.requestId}',
		${VALENTINA_MEMORIES_SESSION_MAX_FILES}, ${VALENTINA_MEMORIES_SESSION_MAX_BYTES},
		${VALENTINA_MEMORIES_SESSION_MAX_IN_FLIGHT}, ${VALENTINA_MEMORIES_EVENT_MAX_OBJECTS},
		${VALENTINA_MEMORIES_EVENT_MAX_BYTES}
	);`;
}

function insertSession(sessionId: string): void {
	runPsql(`insert into public.valentina_memory_sessions (
		id, event_key, token_hash, recovery_code_hash, expires_at, display_name, guest_alias
	) values (
		'${sessionId}', 'valentina', '${randomUUID()}', '${randomUUID()}', now() + interval '1 day',
		'Invitado sintetico', 'invitado-${randomUUID().replace(/-/g, '').slice(0, 8)}'
	);`);
}

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

		console.info(
			'Valentina Memories concurrency passed: idempotency, quota, deduplication, delete race, and cleanup leases.',
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
