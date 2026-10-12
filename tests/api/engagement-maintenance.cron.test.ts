const mockRunMaintenance = jest.fn();
const mockEnv: Record<string, string> = {};

jest.mock('@/lib/rsvp/engagement/engagement-maintenance.service', () => ({
	runEngagementMaintenance: mockRunMaintenance,
}));

jest.mock('@/lib/server/env', () => ({
	getEnv: (key: string) => mockEnv[key] ?? '',
}));

import { GET } from '@/pages/api/cron/engagement-maintenance';

const ROUTE_URL = 'https://celebra-me.com/api/cron/engagement-maintenance';

function call(authorization?: string) {
	return GET({
		request: new Request(ROUTE_URL, {
			headers: authorization ? { authorization } : {},
		}),
	} as never);
}

describe('GET /api/cron/engagement-maintenance', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockEnv.CRON_SECRET = 'cron-test-secret';
		jest.spyOn(console, 'info').mockImplementation(() => undefined);
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('rejects requests without the cron secret', async () => {
		expect((await call()).status).toBe(401);
		expect((await call('Bearer wrong')).status).toBe(401);
		mockEnv.CRON_SECRET = '';
		expect((await call('Bearer ')).status).toBe(401);
		expect(mockRunMaintenance).not.toHaveBeenCalled();
	});

	it('runs maintenance and returns the counts', async () => {
		const result = {
			snapshotsWritten: 2,
			snapshotsUnchanged: 0,
			snapshotsFailed: 0,
			anonymizedEvents: 10,
			anonymizationComplete: true,
		};
		mockRunMaintenance.mockResolvedValue(result);
		const response = await call('Bearer cron-test-secret');
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(await response.json()).toEqual(result);
	});

	it('answers 503 when maintenance fails', async () => {
		mockRunMaintenance.mockRejectedValue(new Error('db down'));
		expect((await call('Bearer cron-test-secret')).status).toBe(503);
	});
});
