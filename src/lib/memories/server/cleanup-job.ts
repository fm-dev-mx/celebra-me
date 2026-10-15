/**
 * Memories cleanup as an invocable job: deploy-identity gate, the cleanup itself and the
 * started/completed evidence lines. Transport-agnostic so the Vercel HTTP route today and the
 * Worker `scheduled()` handler later share one implementation.
 */
import { randomUUID } from 'node:crypto';
import { readBuildIdentity } from '@/lib/environment';
import { serializeOperationalEvidenceEvent } from '@/lib/operations/operational-evidence';
import { readDeployEnvironment, type DeployEnvironment } from '@/lib/server/deploy-identity';
import {
	MEMORIES_CLEANUP_EVENT_NAME,
	createMemoriesCleanupCompletedEvidence,
	createMemoriesCleanupFailedEvidence,
	createMemoriesCleanupStartedEvidence,
	type MemoriesCleanupEvidence,
} from './cleanup-evidence';
import { runMemoriesCleanup, type MemoriesCleanupResult } from './cleanup.service';

export const MEMORIES_CLEANUP_SCHEDULED_SOURCE = 'scheduled_cron';

export interface MemoriesCleanupJobDeps {
	/** Evidence `source` code (lowercase, digits, underscores), e.g. `scheduled_cron`. */
	source?: string;
	cleanup?: () => Promise<MemoriesCleanupResult>;
	readDeployEnvironment?: () => DeployEnvironment | null;
	readCommitSha?: () => string | null;
	now?: () => Date;
	createRunId?: () => string;
	log?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export type MemoriesCleanupJobOutcome =
	/** Cleanup mutates data, so an unverified deploy identity never runs it. */
	| { kind: 'identity_missing' }
	| { kind: 'completed'; result: MemoriesCleanupResult; evidence: MemoriesCleanupEvidence }
	/** The counts broke the invariant; the evidence is FAILED and the result is not trusted. */
	| { kind: 'inconsistent'; result: MemoriesCleanupResult; evidence: MemoriesCleanupEvidence }
	/** The cleanup threw; the evidence line carries no error text by design. */
	| { kind: 'exception'; evidence: MemoriesCleanupEvidence };

export async function runMemoriesCleanupJob(
	deps: MemoriesCleanupJobDeps = {},
): Promise<MemoriesCleanupJobOutcome> {
	const source = deps.source ?? MEMORIES_CLEANUP_SCHEDULED_SOURCE;
	const cleanup = deps.cleanup ?? runMemoriesCleanup;
	const now = deps.now ?? (() => new Date());
	const log = deps.log ?? console;
	const environment = (deps.readDeployEnvironment ?? readDeployEnvironment)();
	if (!environment) return { kind: 'identity_missing' };

	const context = {
		environment,
		source,
		runId: (deps.createRunId ?? randomUUID)(),
		startedAt: now().toISOString(),
		commitSha: (deps.readCommitSha ?? (() => readBuildIdentity().commitSha))(),
	};
	log.info(
		serializeOperationalEvidenceEvent(
			MEMORIES_CLEANUP_EVENT_NAME,
			'started',
			createMemoriesCleanupStartedEvidence({ ...context, completedAt: null }),
		),
	);
	try {
		const result = await cleanup();
		const evidence = createMemoriesCleanupCompletedEvidence(
			{ ...context, completedAt: now().toISOString() },
			result,
		);
		const serialized = serializeOperationalEvidenceEvent(
			MEMORIES_CLEANUP_EVENT_NAME,
			'completed',
			evidence,
		);
		if (evidence.status === 'FAILED') {
			log.error(serialized);
			return { kind: 'inconsistent', result, evidence };
		}
		if (evidence.status === 'WARNING') log.warn(serialized);
		else log.info(serialized);
		return { kind: 'completed', result, evidence };
	} catch {
		const evidence = createMemoriesCleanupFailedEvidence({
			...context,
			completedAt: now().toISOString(),
		});
		log.error(
			serializeOperationalEvidenceEvent(MEMORIES_CLEANUP_EVENT_NAME, 'completed', evidence),
		);
		return { kind: 'exception', evidence };
	}
}
