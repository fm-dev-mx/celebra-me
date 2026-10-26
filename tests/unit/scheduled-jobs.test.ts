jest.mock('@/lib/memories/server/cleanup.service', () => ({
	runMemoriesCleanup: jest.fn(),
}));
jest.mock('@/lib/rsvp/engagement/engagement-maintenance.service', () => ({
	runEngagementMaintenance: jest.fn(),
}));
jest.mock('@/lib/commercial/commercial-retention.service', () => ({
	runCommercialRetention: jest.fn(),
}));
jest.mock('@/lib/platform/server/collector/run-collector', () => ({
	runPlatformUsageCollector: jest.fn(),
}));
jest.mock('@/lib/commercial/meta-capi/retention.service', () => ({
	runMetaConversionRetention: jest.fn(),
}));
jest.mock('@/lib/commercial/meta-capi/service', () => ({
	isMetaCapiDeliveryEnabled: jest.fn(() => false),
	processPendingMetaConversionEvents: jest.fn(),
}));
jest.mock('@/lib/meta/insights-collector', () => ({
	runMetaInsightsCollector: jest.fn(),
}));
jest.mock('@/lib/commercial/meta-capi/estimated-lead-value', () => ({
	runMetaEstimatedLeadValueRecalculation: jest.fn(),
}));
jest.mock('@/lib/server/deploy-identity', () => ({
	readDeployEnvironment: jest.fn(() => 'preview'),
}));

import { runCommercialRetention } from '@/lib/commercial/commercial-retention.service';
import { runMetaConversionRetention } from '@/lib/commercial/meta-capi/retention.service';
import {
	isMetaCapiDeliveryEnabled,
	processPendingMetaConversionEvents,
} from '@/lib/commercial/meta-capi/service';
import { runMemoriesCleanup } from '@/lib/memories/server/cleanup.service';
import { runMetaInsightsCollector } from '@/lib/meta/insights-collector';
import { runPlatformUsageCollector } from '@/lib/platform/server/collector/run-collector';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import { runEngagementMaintenance } from '@/lib/rsvp/engagement/engagement-maintenance.service';
import { runMetaEstimatedLeadValueRecalculation } from '@/lib/commercial/meta-capi/estimated-lead-value';
import { readDeployEnvironment } from '@/lib/server/deploy-identity';
import { SCHEDULED_JOB_CRONS, runScheduledJob } from '@/lib/server/scheduled-jobs';

const cleanup = runMemoriesCleanup as jest.MockedFunction<typeof runMemoriesCleanup>;
const maintenance = runEngagementMaintenance as jest.MockedFunction<
	typeof runEngagementMaintenance
>;
const retention = runCommercialRetention as jest.MockedFunction<typeof runCommercialRetention>;
const metaRetention = runMetaConversionRetention as jest.MockedFunction<
	typeof runMetaConversionRetention
>;
const collector = runPlatformUsageCollector as jest.MockedFunction<
	typeof runPlatformUsageCollector
>;
const deliveryEnabled = isMetaCapiDeliveryEnabled as jest.MockedFunction<
	typeof isMetaCapiDeliveryEnabled
>;
const sweep = processPendingMetaConversionEvents as jest.MockedFunction<
	typeof processPendingMetaConversionEvents
>;
const metaInsights = runMetaInsightsCollector as jest.MockedFunction<
	typeof runMetaInsightsCollector
>;
const metaLeadValue = runMetaEstimatedLeadValueRecalculation as jest.MockedFunction<
	typeof runMetaEstimatedLeadValueRecalculation
>;
const deployEnvironment = readDeployEnvironment as jest.MockedFunction<
	typeof readDeployEnvironment
>;

const cleanResult = {
	validationSettled: 0,
	validationRejected: 0,
	uploadsRescued: 0,
	uploadsReleased: 0,
	inFlightPending: 0,
	settleComplete: true,
	expiredContent: 0,
	claimed: 2,
	deleted: 2,
	failed: 0,
	anonymized: 0,
	auditPurged: 0,
};

const retentionResult = {
	trackingEventsDeleted: 7,
	visitorSessionsDeleted: 2,
	batches: 1,
	complete: true,
};

const metaRetentionResult = {
	conversionEventsDeleted: 4,
	consentWithdrawalsDeleted: 1,
	batches: 1,
	complete: true,
};

const maintenanceResult = {
	snapshotsWritten: 0,
	snapshotsUnchanged: 0,
	snapshotsFailed: 0,
	anonymizedEvents: 0,
	anonymizationComplete: true,
};

describe('runScheduledJob', () => {
	let info: jest.SpyInstance;
	let warn: jest.SpyInstance;
	let error: jest.SpyInstance;

	beforeEach(() => {
		jest.clearAllMocks();
		deployEnvironment.mockReturnValue('preview');
		retention.mockResolvedValue(retentionResult);
		metaRetention.mockResolvedValue(metaRetentionResult);
		metaLeadValue.mockResolvedValue('completed');
		deliveryEnabled.mockReturnValue(false);
		info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
		warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		info.mockRestore();
		warn.mockRestore();
		error.mockRestore();
	});

	it('rejects a cron expression that is not declared', async () => {
		await expect(runScheduledJob('0 0 * * *')).resolves.toEqual({
			job: null,
			status: 'unknown_cron',
		});
		expect(cleanup).not.toHaveBeenCalled();
		expect(maintenance).not.toHaveBeenCalled();
	});

	it('runs the memories cleanup with start and completion evidence', async () => {
		cleanup.mockResolvedValue(cleanResult);
		await expect(runScheduledJob(SCHEDULED_JOB_CRONS.memories_cleanup)).resolves.toEqual({
			job: 'memories_cleanup',
			status: 'completed',
		});
		expect(cleanup).toHaveBeenCalledTimes(1);
		const events = info.mock.calls.map((call) => JSON.parse(String(call[0])));
		expect(events.map((event) => event.phase)).toEqual(['started', 'completed']);
		expect(events[1].evidence.status).toBe('VERIFIED');
		expect(events[1].evidence.source).toBe('scheduled_cron');
	});

	it('never runs the cleanup without a declared deploy identity', async () => {
		deployEnvironment.mockReturnValue(null);
		await expect(runScheduledJob(SCHEDULED_JOB_CRONS.memories_cleanup)).resolves.toEqual({
			job: 'memories_cleanup',
			status: 'skipped',
		});
		expect(cleanup).not.toHaveBeenCalled();
	});

	it('reports a cleanup that throws as failed without rethrowing', async () => {
		cleanup.mockRejectedValue(new Error('storage down'));
		await expect(runScheduledJob(SCHEDULED_JOB_CRONS.memories_cleanup)).resolves.toEqual({
			job: 'memories_cleanup',
			status: 'failed',
		});
		expect(error).toHaveBeenCalledTimes(1);
		expect(String(error.mock.calls[0][0])).not.toContain('storage down');
	});

	it('runs the engagement maintenance and logs its result', async () => {
		maintenance.mockResolvedValue({
			snapshotsWritten: 3,
			snapshotsUnchanged: 1,
			snapshotsFailed: 0,
			anonymizedEvents: 0,
			anonymizationComplete: true,
		});
		await expect(runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance)).resolves.toEqual({
			job: 'engagement_maintenance',
			status: 'completed',
		});
		expect(info).toHaveBeenCalledWith(
			'[engagement][maintenance] completed',
			expect.objectContaining({ snapshotsWritten: 3 }),
		);
	});

	it('runs the commercial retention purge on the engagement maintenance cron', async () => {
		maintenance.mockResolvedValue(maintenanceResult);
		await expect(runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance)).resolves.toEqual({
			job: 'engagement_maintenance',
			status: 'completed',
		});
		expect(retention).toHaveBeenCalledTimes(1);
		expect(info).toHaveBeenCalledWith('[commercial][retention] completed', retentionResult);

		retention.mockResolvedValueOnce({ ...retentionResult, batches: 20, complete: false });
		await runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance);
		expect(warn).toHaveBeenCalledWith(
			'[commercial][retention] completed',
			expect.objectContaining({ complete: false }),
		);
	});

	it('never purges commercial analytics without a declared deploy identity', async () => {
		deployEnvironment.mockReturnValue(null);
		maintenance.mockResolvedValue(maintenanceResult);
		await expect(runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance)).resolves.toEqual({
			job: 'engagement_maintenance',
			status: 'completed',
		});
		expect(maintenance).toHaveBeenCalledTimes(1);
		expect(retention).not.toHaveBeenCalled();
	});

	it('fails the job when either daily analytics step fails, after running both', async () => {
		maintenance.mockResolvedValue(maintenanceResult);
		retention.mockRejectedValueOnce(new SupabaseHttpError(500, '{"row":"echo"}', 'XX000'));
		await expect(runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance)).resolves.toEqual({
			job: 'engagement_maintenance',
			status: 'failed',
		});
		expect(error).toHaveBeenCalledWith('[commercial][retention] failed', {
			status: 500,
			code: 'XX000',
		});

		maintenance.mockRejectedValueOnce(new Error('rpc down'));
		await expect(runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance)).resolves.toEqual({
			job: 'engagement_maintenance',
			status: 'failed',
		});
		expect(retention).toHaveBeenCalledTimes(2);
	});

	describe('Meta Insights collector (daily analytics cron)', () => {
		const skippedSource = { status: 'skipped', reason: 'missing_config' } as const;
		beforeEach(() => {
			maintenance.mockResolvedValue(maintenanceResult);
			retention.mockResolvedValue(retentionResult);
		});

		it('never calls Meta outside Production', async () => {
			deployEnvironment.mockReturnValue('preview');
			await expect(
				runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance),
			).resolves.toEqual({
				job: 'engagement_maintenance',
				status: 'completed',
			});
			expect(metaInsights).not.toHaveBeenCalled();
		});

		it('treats missing secrets as a skip, not a failure', async () => {
			deployEnvironment.mockReturnValue('production');
			metaInsights.mockResolvedValueOnce({
				status: 'skipped',
				date: '2026-10-24',
				sources: { ads: skippedSource, page: skippedSource, instagram: skippedSource },
				missingConfig: ['META_GRAPH_ACCESS_TOKEN', 'META_PAGE_ID'],
			});
			await expect(
				runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance),
			).resolves.toEqual({
				job: 'engagement_maintenance',
				status: 'completed',
			});
			expect(metaInsights).toHaveBeenCalledTimes(1);
			expect(info).toHaveBeenCalledWith(
				'[meta-insights][collector] skipped',
				expect.any(Object),
			);
			expect(warn).toHaveBeenCalledWith(
				'[meta-insights][collector] skipping unconfigured sources; unset: ' +
					'META_GRAPH_ACCESS_TOKEN, META_PAGE_ID',
			);
		});

		it('fails the job on a failed source or a throw, after the other steps ran', async () => {
			deployEnvironment.mockReturnValue('production');
			metaInsights.mockResolvedValueOnce({
				status: 'failed',
				date: '2026-10-24',
				sources: {
					ads: {
						status: 'failed',
						kind: 'rate_limit',
						httpStatus: 429,
						code: null,
						retryAfterMs: 60_000,
					},
					page: { status: 'completed', rows: 1 },
					instagram: { status: 'completed', rows: 1 },
				},
				missingConfig: [],
			});
			await expect(
				runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance),
			).resolves.toEqual({
				job: 'engagement_maintenance',
				status: 'failed',
			});
			expect(warn).toHaveBeenCalledWith(
				'[meta-insights][collector] failed',
				expect.any(Object),
			);

			metaInsights.mockRejectedValueOnce(new Error('secret-bearing message'));
			await expect(
				runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance),
			).resolves.toEqual({
				job: 'engagement_maintenance',
				status: 'failed',
			});
			expect(error).toHaveBeenCalledWith('[meta-insights][collector] failed');
			expect(maintenance).toHaveBeenCalledTimes(2);
			expect(retention).toHaveBeenCalledTimes(2);
		});
	});

	describe('Meta estimated lead value recalculation (daily analytics cron)', () => {
		beforeEach(() => {
			maintenance.mockResolvedValue(maintenanceResult);
			retention.mockResolvedValue(retentionResult);
		});

		it('runs the monthly recalculation as part of the daily analytics maintenance job', async () => {
			await expect(
				runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance),
			).resolves.toEqual({
				job: 'engagement_maintenance',
				status: 'completed',
			});
			expect(metaLeadValue).toHaveBeenCalledTimes(1);
		});

		it('fails the job when recalculation returns failed', async () => {
			metaLeadValue.mockResolvedValueOnce('failed');
			await expect(
				runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance),
			).resolves.toEqual({
				job: 'engagement_maintenance',
				status: 'failed',
			});
		});

		it('fails the job when recalculation throws', async () => {
			metaLeadValue.mockRejectedValueOnce(new SupabaseHttpError(500, 'db error', 'XX000'));
			await expect(
				runScheduledJob(SCHEDULED_JOB_CRONS.engagement_maintenance),
			).resolves.toEqual({
				job: 'engagement_maintenance',
				status: 'failed',
			});
			expect(error).toHaveBeenCalledWith(
				'[meta-lead-value][recalculation] failed',
				expect.objectContaining({ status: 500, code: 'XX000' }),
			);
		});
	});

	const collected = {
		datasets: {
			cloudflare_workers: true,
			cloudflare_durable_objects: true,
			cloudflare_r2: true,
			cloudflare_zone: true,
			supabase_disk: true,
			supabase_database: true,
		},
		missingPermissions: [],
		purged: true,
		quotaAlerts: [],
	};
	const summary = (line: unknown) => JSON.parse(String(line)) as unknown;

	it('runs the platform usage collector only on the Production identity', async () => {
		collector.mockResolvedValue(collected);
		for (const environment of ['preview', null] as const) {
			deployEnvironment.mockReturnValue(environment);
			await expect(runScheduledJob(SCHEDULED_JOB_CRONS.platform_usage)).resolves.toEqual({
				job: 'platform_usage',
				status: 'skipped',
			});
		}
		expect(collector).not.toHaveBeenCalled();

		deployEnvironment.mockReturnValue('production');
		await expect(runScheduledJob('*/15 * * * *')).resolves.toEqual({
			job: 'platform_usage',
			status: 'completed',
		});
		expect(collector).toHaveBeenCalledTimes(1);
		const summaryLine = info.mock.calls.find((call) =>
			String(call[0]).includes('platform_usage_summary'),
		);
		expect(summary(summaryLine?.[0])).toEqual({
			event: 'platform_usage_summary',
			phase: 'completed',
			...collected,
			quotaAlertCount: 0,
			quotaAlertText: '',
		});
	});

	it('warns when a dataset failed and logs only status and code when the insert fails', async () => {
		deployEnvironment.mockReturnValue('production');
		collector.mockResolvedValueOnce({
			...collected,
			datasets: { ...collected.datasets, supabase_disk: false },
			missingPermissions: ['Disk Config Read'],
		});
		await expect(runScheduledJob(SCHEDULED_JOB_CRONS.platform_usage)).resolves.toMatchObject({
			status: 'completed',
		});
		expect(summary(warn.mock.calls.at(-1)?.[0])).toMatchObject({
			missingPermissions: ['Disk Config Read'],
		});

		collector.mockResolvedValueOnce({
			...collected,
			quotaAlerts: [{ id: 'cfR2ClassA', percent: 83 }],
		});
		await runScheduledJob(SCHEDULED_JOB_CRONS.platform_usage);
		expect(summary(warn.mock.calls.at(-1)?.[0])).toMatchObject({
			quotaAlertCount: 1,
			quotaAlertText: 'cfR2ClassA 83%',
		});

		collector.mockRejectedValueOnce(
			new SupabaseHttpError(404, '{"payload":"echo"}', 'PGRST205'),
		);
		await expect(runScheduledJob(SCHEDULED_JOB_CRONS.platform_usage)).resolves.toMatchObject({
			status: 'failed',
		});
		expect(error).toHaveBeenCalledWith('[platform][collector] failed', {
			status: 404,
			code: 'PGRST205',
		});
	});

	describe('Meta conversion outbox sweep (quarter-hour cron)', () => {
		const sweepResult = { processed: 2, failed: 0, skipped: 1, ambiguous: 0 };

		beforeEach(() => {
			collector.mockResolvedValue(collected);
			sweep.mockResolvedValue(sweepResult);
		});

		it('processes the outbox on Production when delivery is enabled', async () => {
			deployEnvironment.mockReturnValue('production');
			deliveryEnabled.mockReturnValue(true);
			await expect(runScheduledJob('*/15 * * * *')).resolves.toEqual({
				job: 'platform_usage',
				status: 'completed',
			});
			expect(sweep).toHaveBeenCalledTimes(1);
			expect(info).toHaveBeenCalledWith('[meta-capi][sweep] completed', sweepResult);
		});

		it('leaves rows pending outside Production and while delivery is disabled', async () => {
			deployEnvironment.mockReturnValue('preview');
			deliveryEnabled.mockReturnValue(true);
			await expect(runScheduledJob('*/15 * * * *')).resolves.toEqual({
				job: 'platform_usage',
				status: 'skipped',
			});

			deployEnvironment.mockReturnValue('production');
			deliveryEnabled.mockReturnValue(false);
			await expect(runScheduledJob('*/15 * * * *')).resolves.toEqual({
				job: 'platform_usage',
				status: 'completed',
			});
			expect(sweep).not.toHaveBeenCalled();
		});

		it.each([
			{ processed: 0, failed: 1, skipped: 0, ambiguous: 0 },
			{ processed: 3, failed: 0, skipped: 0, ambiguous: 1 },
		])('fails the job when the batch returns undelivered rows: %o', async (batch) => {
			deployEnvironment.mockReturnValue('production');
			deliveryEnabled.mockReturnValue(true);
			sweep.mockResolvedValueOnce(batch);
			await expect(runScheduledJob('*/15 * * * *')).resolves.toEqual({
				job: 'platform_usage',
				status: 'failed',
			});
			expect(warn).toHaveBeenCalledWith('[meta-capi][sweep] failed deliveries', batch);
			expect(info).not.toHaveBeenCalledWith('[meta-capi][sweep] completed', batch);
		});

		it('fails the job when the sweep throws, after the collector still ran', async () => {
			deployEnvironment.mockReturnValue('production');
			deliveryEnabled.mockReturnValue(true);
			sweep.mockRejectedValueOnce(new Error('network'));
			await expect(runScheduledJob('*/15 * * * *')).resolves.toEqual({
				job: 'platform_usage',
				status: 'failed',
			});
			expect(collector).toHaveBeenCalledTimes(1);
			expect(error).toHaveBeenCalledWith('[meta-capi][sweep] failed', {
				status: null,
				code: null,
			});
		});
	});

	describe('Meta conversion retention (quarter-hour cron)', () => {
		beforeEach(() => {
			collector.mockResolvedValue(collected);
		});

		it('purges on Production even while delivery is disabled', async () => {
			deployEnvironment.mockReturnValue('production');
			await expect(runScheduledJob('*/15 * * * *')).resolves.toEqual({
				job: 'platform_usage',
				status: 'completed',
			});
			expect(metaRetention).toHaveBeenCalledTimes(1);
			expect(info).toHaveBeenCalledWith(
				'[meta-capi][retention] completed',
				metaRetentionResult,
			);
		});

		it('never purges outside Production', async () => {
			deployEnvironment.mockReturnValue('preview');
			await runScheduledJob('*/15 * * * *');
			deployEnvironment.mockReturnValue(null);
			await runScheduledJob('*/15 * * * *');
			expect(metaRetention).not.toHaveBeenCalled();
		});

		it('warns when the per-run batch cap left rows behind', async () => {
			deployEnvironment.mockReturnValue('production');
			const capped = { ...metaRetentionResult, batches: 4, complete: false };
			metaRetention.mockResolvedValueOnce(capped);
			await expect(runScheduledJob('*/15 * * * *')).resolves.toEqual({
				job: 'platform_usage',
				status: 'completed',
			});
			expect(warn).toHaveBeenCalledWith('[meta-capi][retention] completed', capped);
		});

		it('fails the job when the purge throws, after the other steps still ran', async () => {
			deployEnvironment.mockReturnValue('production');
			metaRetention.mockRejectedValueOnce(
				new SupabaseHttpError(404, '{"payload":"echo"}', 'PGRST202'),
			);
			await expect(runScheduledJob('*/15 * * * *')).resolves.toEqual({
				job: 'platform_usage',
				status: 'failed',
			});
			expect(collector).toHaveBeenCalledTimes(1);
			expect(error).toHaveBeenCalledWith('[meta-capi][retention] failed', {
				status: 404,
				code: 'PGRST202',
			});
		});
	});
});
