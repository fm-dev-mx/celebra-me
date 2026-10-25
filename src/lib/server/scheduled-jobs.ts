/**
 * Scheduled jobs for the Workers runtime. Cloudflare delivers a cron trigger to the
 * Worker's `scheduled` handler with the cron expression that fired; this module maps
 * each expression to its job.
 * The expressions are the ones declared under `triggers.crons` in `wrangler.jsonc`.
 * Jobs listed in `PRODUCTION_ONLY_JOBS` are declared only on the Production Worker and
 * skip on any other deploy identity.
 * The engagement maintenance cron also runs the commercial analytics retention purge.
 * The platform usage cron (every 15 minutes) also sweeps the Meta conversion outbox, so the
 * Production Worker needs no extra cron trigger.
 */
import { randomUUID } from 'node:crypto';
import { runCommercialRetention } from '@/lib/commercial/commercial-retention.service';
import {
	isMetaCapiDeliveryEnabled,
	processPendingMetaConversionEvents,
} from '@/lib/commercial/meta-capi/service';
import { readBuildIdentity } from '@/lib/environment';
import {
	MEMORIES_CLEANUP_EVENT_NAME,
	createMemoriesCleanupCompletedEvidence,
	createMemoriesCleanupFailedEvidence,
	createMemoriesCleanupStartedEvidence,
} from '@/lib/memories/server/cleanup-evidence';
import { runMemoriesCleanup } from '@/lib/memories/server/cleanup.service';
import { serializeOperationalEvidenceEvent } from '@/lib/operations/operational-evidence';
import {
	PLATFORM_USAGE_SUMMARY_EVENT,
	formatQuotaAlerts,
} from '@/lib/platform/server/collector/quota-alerts';
import { runPlatformUsageCollector } from '@/lib/platform/server/collector/run-collector';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import { runEngagementMaintenance } from '@/lib/rsvp/engagement/engagement-maintenance.service';
import { readDeployEnvironment } from '@/lib/server/deploy-identity';
import { safeErr } from '@/lib/server/safe-error';

export type ScheduledJobName = 'memories_cleanup' | 'engagement_maintenance' | 'platform_usage';

export const SCHEDULED_JOB_CRONS: Readonly<Record<ScheduledJobName, string>> = {
	memories_cleanup: '17 15 * * *',
	engagement_maintenance: '43 10 * * *',
	platform_usage: '*/15 * * * *',
};

/** Jobs scheduled only on the Production Worker (no Preview counterpart). */
export const PRODUCTION_ONLY_JOBS: readonly ScheduledJobName[] = ['platform_usage'];

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
			error: safeErr(error),
		});
		return 'failed';
	}
}

async function runCommercialRetentionJob(): Promise<ScheduledJobOutcome['status']> {
	// The purge deletes rows, so an unverified deploy identity never runs it.
	if (!readDeployEnvironment()) {
		console.error(
			'[scheduled][commercial_retention] skipped: deploy identity is not declared.',
		);
		return 'skipped';
	}
	try {
		const result = await runCommercialRetention();
		(result.complete ? console.info : console.warn)(
			'[commercial][retention] completed',
			result,
		);
		return 'completed';
	} catch (error) {
		console.error('[commercial][retention] failed', {
			status: error instanceof SupabaseHttpError ? error.status : null,
			code: error instanceof SupabaseHttpError ? error.code : null,
		});
		return 'failed';
	}
}

/** Both daily analytics steps run even when the other fails; any failure fails the job. */
async function runDailyAnalyticsMaintenanceJob(): Promise<ScheduledJobOutcome['status']> {
	const engagement = await runEngagementMaintenanceJob();
	const retention = await runCommercialRetentionJob();
	return engagement === 'failed' || retention === 'failed' ? 'failed' : 'completed';
}

async function runPlatformUsageJob(): Promise<ScheduledJobOutcome['status']> {
	// Snapshots describe the shared Production account; any other identity skips.
	if (readDeployEnvironment() !== 'production') {
		console.info('[platform][collector] skipped: deploy identity is not production.');
		return 'skipped';
	}
	try {
		const result = await runPlatformUsageCollector();
		const degraded =
			!result.purged ||
			Object.values(result.datasets).some((collected) => !collected) ||
			result.quotaAlerts?.length !== 0;
		// A JSON line: Workers Logs parses it into top-level fields the daily quota monitor filters on.
		(degraded ? console.warn : console.info)(
			JSON.stringify({
				event: PLATFORM_USAGE_SUMMARY_EVENT,
				phase: 'completed',
				...result,
				quotaAlertCount: result.quotaAlerts?.length ?? null,
				quotaAlertText: result.quotaAlerts ? formatQuotaAlerts(result.quotaAlerts) : null,
			}),
		);
		return 'completed';
	} catch (error) {
		// Status and PostgREST code only: the error body could echo the inserted payload.
		console.error('[platform][collector] failed', {
			status: error instanceof SupabaseHttpError ? error.status : null,
			code: error instanceof SupabaseHttpError ? error.code : null,
		});
		return 'failed';
	}
}

async function runMetaCapiOutboxSweepJob(): Promise<ScheduledJobOutcome['status']> {
	// Only Production delivers to Meta; any other identity leaves the rows pending.
	if (readDeployEnvironment() !== 'production') {
		console.info('[meta-capi][sweep] skipped: deploy identity is not production.');
		return 'skipped';
	}
	// Disabled delivery would mark every claimed row skipped for good; keep them pending instead.
	if (!isMetaCapiDeliveryEnabled()) {
		console.info('[meta-capi][sweep] skipped: delivery mode is disabled.');
		return 'skipped';
	}
	try {
		const result = await processPendingMetaConversionEvents();
		// Failed or ambiguous rows are retried later, but this run did not deliver them.
		if (result.failed > 0 || result.ambiguous > 0) {
			console.warn('[meta-capi][sweep] failed deliveries', result);
			return 'failed';
		}
		console.info('[meta-capi][sweep] completed', result);
		return 'completed';
	} catch (error) {
		console.error('[meta-capi][sweep] failed', {
			status: error instanceof SupabaseHttpError ? error.status : null,
			code: error instanceof SupabaseHttpError ? error.code : null,
		});
		return 'failed';
	}
}

/** Both quarter-hour steps run even when the other fails; any failure fails the job. */
async function runQuarterHourJobs(): Promise<ScheduledJobOutcome['status']> {
	const platform = await runPlatformUsageJob();
	const sweep = await runMetaCapiOutboxSweepJob();
	if (platform === 'failed' || sweep === 'failed') return 'failed';
	return platform === 'skipped' && sweep === 'skipped' ? 'skipped' : 'completed';
}

const JOB_RUNNERS: Readonly<
	Record<ScheduledJobName, () => Promise<ScheduledJobOutcome['status']>>
> = {
	memories_cleanup: runMemoriesCleanupJob,
	engagement_maintenance: runDailyAnalyticsMaintenanceJob,
	platform_usage: runQuarterHourJobs,
};

/** Runs the job bound to `cron`. Never throws: the outcome is logged and returned. */
export async function runScheduledJob(cron: string): Promise<ScheduledJobOutcome> {
	const job = jobForCron(cron);
	if (!job) {
		console.error('[scheduled] no job is bound to this cron expression', { cron });
		return { job: null, status: 'unknown_cron' };
	}
	const status = await JOB_RUNNERS[job]();
	return { job, status };
}
