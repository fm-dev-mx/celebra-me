jest.mock('@/lib/memories/server/cleanup.service', () => ({
	runMemoriesCleanup: jest.fn(),
}));
jest.mock('@/lib/rsvp/engagement/engagement-maintenance.service', () => ({
	runEngagementMaintenance: jest.fn(),
}));
jest.mock('@/lib/platform/server/collector/run-collector', () => ({
	runPlatformUsageCollector: jest.fn(),
}));
jest.mock('@/lib/server/deploy-identity', () => ({
	readDeployEnvironment: jest.fn(() => 'preview'),
}));

import { runMemoriesCleanup } from '@/lib/memories/server/cleanup.service';
import { runPlatformUsageCollector } from '@/lib/platform/server/collector/run-collector';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import { runEngagementMaintenance } from '@/lib/rsvp/engagement/engagement-maintenance.service';
import { readDeployEnvironment } from '@/lib/server/deploy-identity';
import { SCHEDULED_JOB_CRONS, runScheduledJob } from '@/lib/server/scheduled-jobs';

const cleanup = runMemoriesCleanup as jest.MockedFunction<typeof runMemoriesCleanup>;
const maintenance = runEngagementMaintenance as jest.MockedFunction<
	typeof runEngagementMaintenance
>;
const collector = runPlatformUsageCollector as jest.MockedFunction<
	typeof runPlatformUsageCollector
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

describe('runScheduledJob', () => {
	let info: jest.SpyInstance;
	let warn: jest.SpyInstance;
	let error: jest.SpyInstance;

	beforeEach(() => {
		jest.clearAllMocks();
		deployEnvironment.mockReturnValue('preview');
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
	};

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
		expect(info).toHaveBeenCalledWith('[platform][collector] completed', collected);
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
		expect(warn).toHaveBeenCalledWith(
			'[platform][collector] completed',
			expect.objectContaining({ missingPermissions: ['Disk Config Read'] }),
		);

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
});
