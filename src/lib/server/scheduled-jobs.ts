/**
 * Scheduled jobs for the Workers runtime. Cloudflare delivers a cron trigger to the
 * Worker's `scheduled` handler with the cron expression that fired; this module maps
 * each expression to the job the `/api/cron/*` routes run for Vercel's scheduler.
 * The expressions are the ones declared under `triggers.crons` in `wrangler.jsonc`.
 */
import { randomUUID } from 'node:crypto';
import { readBuildIdentity } from '@/lib/environment';
import {
	MEMORIES_CLEANUP_EVENT_NAME,
	createMemoriesCleanupCompletedEvidence,
	createMemoriesCleanupFailedEvidence,
	createMemoriesCleanupStartedEvidence,
} from '@/lib/memories/server/cleanup-evidence';
import { runMemoriesCleanup } from '@/lib/memories/server/cleanup.service';
import { serializeOperationalEvidenceEvent } from '@/lib/operations/operational-evidence';
import { runEngagementMaintenance } from '@/lib/rsvp/engagement/engagement-maintenance.service';
import { readDeployEnvironment } from '@/lib/server/deploy-identity';

export type ScheduledJobName = 'memories_cleanup' | 'engagement_maintenance';

export const SCHEDULED_JOB_CRONS: Readonly<Record<ScheduledJobName, string>> = {
	memories_cleanup: '17 15 * * *',
	engagement_maintenance: '43 10 * * *',
};

export interface ScheduledJobOutcome {
	job: ScheduledJobName | null;
	status: 'completed' | 'failed' | 'skipped' | 'unknown_cron';
}

function jobForCron(cron: string): ScheduledJobName | null {
	const match = Object.entries(SCHEDULED_JOB_CRONS).find(([, value]) => value === cron.trim());
	return match ? (match[0] as ScheduledJobName) : null;
}

async function runMemoriesCleanupJob(): Promise<ScheduledJobOutcome['status']> {
	// Cleanup mutates data, so an unverified deploy identity never runs it.
	const environment = readDeployEnvironment();
	if (!environment) {
		console.error('[scheduled][memories_cleanup] skipped: deploy identity is not declared.');
		return 'skipped';
	}
	const context = {
		environment,
		runId: randomUUID(),
		startedAt: new Date().toISOString(),
		commitSha: readBuildIdentity().commitSha,
	};
	console.info(
		serializeOperationalEvidenceEvent(
			MEMORIES_CLEANUP_EVENT_NAME,
			'started',
			createMemoriesCleanupStartedEvidence({ ...context, completedAt: null }),
		),
	);
	try {
		const result = await runMemoriesCleanup();
		const evidence = createMemoriesCleanupCompletedEvidence(
			{ ...context, completedAt: new Date().toISOString() },
			result,
		);
		const serialized = serializeOperationalEvidenceEvent(
			MEMORIES_CLEANUP_EVENT_NAME,
			'completed',
			evidence,
		);
		if (evidence.status === 'FAILED') console.error(serialized);
		else if (evidence.status === 'WARNING') console.warn(serialized);
		else console.info(serialized);
		return evidence.status === 'FAILED' ? 'failed' : 'completed';
	} catch {
		console.error(
			serializeOperationalEvidenceEvent(
				MEMORIES_CLEANUP_EVENT_NAME,
				'completed',
				createMemoriesCleanupFailedEvidence({
					...context,
					completedAt: new Date().toISOString(),
				}),
			),
		);
		return 'failed';
	}
}

async function runEngagementMaintenanceJob(): Promise<ScheduledJobOutcome['status']> {
	try {
		const result = await runEngagementMaintenance();
		const log = result.snapshotsFailed > 0 ? console.warn : console.info;
		log('[engagement][maintenance] completed', result);
		return 'completed';
	} catch (error) {
		console.error('[engagement][maintenance] failed', {
			error: error instanceof Error ? error.message : String(error),
		});
		return 'failed';
	}
}

/** Runs the job bound to `cron`. Never throws: the outcome is logged and returned. */
export async function runScheduledJob(cron: string): Promise<ScheduledJobOutcome> {
	const job = jobForCron(cron);
	if (!job) {
		console.error('[scheduled] no job is bound to this cron expression', { cron });
		return { job: null, status: 'unknown_cron' };
	}
	const status =
		job === 'memories_cleanup'
			? await runMemoriesCleanupJob()
			: await runEngagementMaintenanceJob();
	return { job, status };
}
