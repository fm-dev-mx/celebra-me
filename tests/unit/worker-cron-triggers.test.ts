jest.mock(
	'@astrojs/cloudflare/handler',
	() => ({ handle: jest.fn(async () => new Response('served', { status: 200 })) }),
	{ virtual: true },
);
jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	installRateLimitBindings: jest.fn(),
}));
jest.mock('@/lib/images/image-transformer-provider', () => ({
	installImagesBinding: jest.fn(),
}));
jest.mock('@/lib/memories/server/cleanup.service', () => ({
	runMemoriesCleanup: jest.fn(async () => ({})),
}));
jest.mock('@/lib/rsvp/engagement/engagement-maintenance.service', () => ({
	runEngagementMaintenance: jest.fn(async () => ({})),
}));
jest.mock('@/lib/platform/server/collector/run-collector', () => ({
	runPlatformUsageCollector: jest.fn(async () => ({})),
}));
jest.mock('@/lib/server/deploy-identity', () => ({
	readDeployEnvironment: jest.fn(() => 'preview'),
}));

import type { ScheduledJobOutcome } from '@/lib/server/scheduled-jobs';
import worker from '../../src/worker';
import { readWranglerConfig } from '../helpers/wrangler-config';

/**
 * Every cron trigger declared in wrangler.jsonc must reach a job through the Worker's
 * `scheduled()` handler. A cron edited in wrangler.jsonc alone would otherwise fire on time and
 * settle as `unknown_cron`, silently skipping its job.
 */

const config = readWranglerConfig<{
	env: Record<string, { triggers?: { crons?: string[] } }>;
}>();
const declared = Object.entries(config.env).flatMap(([environment, settings]) =>
	(settings.triggers?.crons ?? []).map((cron) => [environment, cron] as const),
);

describe('wrangler.jsonc cron triggers', () => {
	let info: jest.SpyInstance;
	let error: jest.SpyInstance;
	let warn: jest.SpyInstance;

	beforeEach(() => {
		info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
		error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		info.mockRestore();
		error.mockRestore();
		warn.mockRestore();
	});

	it('declares cron triggers in every Worker environment', () => {
		expect(new Set(declared.map(([environment]) => environment))).toEqual(
			new Set(['preview', 'production']),
		);
	});

	it.each(declared)('routes the %s cron "%s" to a scheduled job', async (_environment, cron) => {
		const context = { waitUntil: jest.fn(), passThroughOnException: jest.fn() };

		await worker.scheduled({ cron, scheduledTime: Date.now() }, {}, context);

		expect(context.waitUntil).toHaveBeenCalledTimes(1);
		const outcome = (await context.waitUntil.mock.calls[0][0]) as ScheduledJobOutcome;
		expect(outcome.job).not.toBeNull();
		expect(outcome.status).not.toBe('unknown_cron');
	});
});
