import { runEngagementMaintenanceJob } from '@/lib/rsvp/engagement/engagement-maintenance-job';

jest.mock('@/lib/rsvp/engagement/engagement-maintenance.service', () => ({
	runEngagementMaintenance: jest.fn(),
}));

const result = {
	snapshotsWritten: 2,
	snapshotsUnchanged: 0,
	snapshotsFailed: 0,
	anonymizedEvents: 10,
	anonymizationComplete: true,
};

function createLog() {
	return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

describe('runEngagementMaintenanceJob', () => {
	it('returns the counts and logs them with the source', async () => {
		const log = createLog();
		const outcome = await runEngagementMaintenanceJob({
			source: 'worker_scheduled',
			maintenance: async () => result,
			log,
		});
		expect(outcome).toEqual({ kind: 'completed', result });
		expect(log.info).toHaveBeenCalledWith('[engagement][maintenance] completed', {
			source: 'worker_scheduled',
			...result,
		});
		expect(log.warn).not.toHaveBeenCalled();
	});

	it('defaults the source to the scheduled cron and warns on failed snapshots', async () => {
		const log = createLog();
		await runEngagementMaintenanceJob({
			maintenance: async () => ({ ...result, snapshotsFailed: 1 }),
			log,
		});
		expect(log.info).not.toHaveBeenCalled();
		expect(log.warn).toHaveBeenCalledWith(
			'[engagement][maintenance] completed',
			expect.objectContaining({ source: 'scheduled_cron', snapshotsFailed: 1 }),
		);
	});

	it('reports a thrown maintenance without rethrowing', async () => {
		const log = createLog();
		const outcome = await runEngagementMaintenanceJob({
			maintenance: async () => {
				throw new Error('db down');
			},
			log,
		});
		expect(outcome).toEqual({ kind: 'exception', message: 'db down' });
		expect(log.error).toHaveBeenCalledWith('[engagement][maintenance] failed', {
			source: 'scheduled_cron',
			error: { code: 'Error', message: expect.stringMatching(/^Unexpected Error/) },
		});
	});
});
