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
	runMemoriesCleanup: jest.fn(),
}));
jest.mock('@/lib/rsvp/engagement/engagement-maintenance.service', () => ({
	runEngagementMaintenance: jest.fn(),
}));
jest.mock('@/lib/commercial/commercial-retention.service', () => ({
	runCommercialRetention: jest.fn(async () => ({
		trackingEventsDeleted: 0,
		visitorSessionsDeleted: 0,
		batches: 1,
		complete: true,
	})),
}));
jest.mock('@/lib/commercial/meta-capi/estimated-lead-value', () => ({
	runMetaEstimatedLeadValueRecalculation: jest.fn(async () => 'completed'),
}));
jest.mock('@/lib/server/deploy-identity', () => ({
	readDeployEnvironment: jest.fn(() => 'preview'),
}));

import { handle } from '@astrojs/cloudflare/handler';
import { installImagesBinding } from '@/lib/images/image-transformer-provider';
import { runMemoriesCleanup } from '@/lib/memories/server/cleanup.service';
import { runEngagementMaintenance } from '@/lib/rsvp/engagement/engagement-maintenance.service';
import { installRateLimitBindings } from '@/lib/rsvp/security/rate-limit-provider';
import { SCHEDULED_JOB_CRONS, type ScheduledJobOutcome } from '@/lib/server/scheduled-jobs';
import { fetchFromApp, resetAppLoopbackForTests } from '@/lib/server/app-loopback';
import worker from '../../src/worker';

/**
 * `src/worker.ts` is the Workers entry (`main` in wrangler.jsonc). Cloudflare runs the cron
 * triggers through its `scheduled` handler, which must hand the job to `ctx.waitUntil`:
 * otherwise the runtime may stop the invocation before the job finishes.
 */

const cleanup = runMemoriesCleanup as jest.MockedFunction<typeof runMemoriesCleanup>;
const maintenance = runEngagementMaintenance as jest.MockedFunction<
	typeof runEngagementMaintenance
>;

const env = { IMAGES: {}, ASSETS: {} };

function executionContext() {
	return { waitUntil: jest.fn<void, [Promise<unknown>]>(), passThroughOnException: jest.fn() };
}

describe('Worker entry', () => {
	let info: jest.SpyInstance;
	let error: jest.SpyInstance;

	beforeEach(() => {
		jest.clearAllMocks();
		cleanup.mockResolvedValue({
			validationSettled: 0,
			validationRejected: 0,
			uploadsRescued: 0,
			uploadsReleased: 0,
			inFlightPending: 0,
			settleComplete: true,
			expiredContent: 0,
			claimed: 0,
			deleted: 0,
			failed: 0,
			anonymized: 0,
			auditPurged: 0,
		});
		maintenance.mockResolvedValue({
			snapshotsWritten: 0,
			snapshotsUnchanged: 0,
			snapshotsFailed: 0,
			anonymizedEvents: 0,
			anonymizationComplete: true,
		});
		info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
		error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		info.mockRestore();
		error.mockRestore();
	});

	it('installs the bindings before handing the request to the Astro handler', async () => {
		const context = executionContext();
		const request = new Request('https://www.celebra-me.com/');

		const response = await worker.fetch(request, env, context);

		expect(await response.text()).toBe('served');
		expect(installRateLimitBindings).toHaveBeenCalledWith(env);
		expect(installImagesBinding).toHaveBeenCalledWith(env);
		expect(handle).toHaveBeenCalledWith(request, env, context);
		const handleOrder = (handle as jest.Mock).mock.invocationCallOrder[0];
		for (const install of [installRateLimitBindings, installImagesBinding]) {
			expect((install as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(handleOrder);
		}
	});

	it('redirects the apex to www before the Astro handler, also in process', async () => {
		resetAppLoopbackForTests();
		const response = await worker.fetch(
			new Request('https://celebra-me.com/r/victoria-y-roberto?x=1'),
			env,
			executionContext(),
		);

		expect(response.status).toBe(307);
		expect(response.headers.get('location')).toBe(
			'https://www.celebra-me.com/r/victoria-y-roberto?x=1',
		);
		expect(handle).not.toHaveBeenCalled();
		const inner = await fetchFromApp('https://celebra-me.com/r/victoria-y-roberto', {
			redirect: 'manual',
		});
		expect(inner.status).toBe(307);
		expect(handle).not.toHaveBeenCalled();
		resetAppLoopbackForTests();
	});

	it('routes self-requests to the Astro handler in process', async () => {
		resetAppLoopbackForTests();
		const context = executionContext();
		await worker.fetch(new Request('https://www.celebra-me.com/'), env, context);
		(handle as jest.Mock).mockClear();

		const response = await fetchFromApp('https://www.celebra-me.com/r/victoria-y-roberto');

		expect(await response.text()).toBe('served');
		const [inner, innerEnv, innerContext] = (handle as jest.Mock).mock.calls[0];
		expect((inner as Request).url).toBe('https://www.celebra-me.com/r/victoria-y-roberto');
		expect(innerEnv).toBe(env);
		const pending = Promise.resolve();
		(innerContext as ReturnType<typeof executionContext>).waitUntil(pending);
		expect(context.waitUntil).toHaveBeenCalledWith(pending);
		context.waitUntil.mockImplementation(() => {
			throw new Error('request already answered');
		});
		expect(() =>
			(innerContext as ReturnType<typeof executionContext>).waitUntil(pending),
		).not.toThrow();
		resetAppLoopbackForTests();
	});

	it.each([
		['memories_cleanup', SCHEDULED_JOB_CRONS.memories_cleanup, cleanup, maintenance],
		[
			'engagement_maintenance',
			SCHEDULED_JOB_CRONS.engagement_maintenance,
			maintenance,
			cleanup,
		],
	] as const)(
		'hands the %s job of cron "%s" to ctx.waitUntil',
		async (job, cron, expectedService, otherService) => {
			const context = executionContext();

			await worker.scheduled({ cron, scheduledTime: Date.now() }, env, context);

			expect(installRateLimitBindings).toHaveBeenCalledWith(env);
			expect(installImagesBinding).toHaveBeenCalledWith(env);
			expect(context.waitUntil).toHaveBeenCalledTimes(1);
			const outcome = (await context.waitUntil.mock.calls[0][0]) as ScheduledJobOutcome;
			expect(outcome).toEqual({ job, status: 'completed' });
			expect(expectedService).toHaveBeenCalledTimes(1);
			expect(otherService).not.toHaveBeenCalled();
		},
	);

	it('still settles through ctx.waitUntil for a cron no job is bound to', async () => {
		const context = executionContext();

		await worker.scheduled({ cron: '0 0 * * *', scheduledTime: Date.now() }, env, context);

		expect(context.waitUntil).toHaveBeenCalledTimes(1);
		await expect(context.waitUntil.mock.calls[0][0]).resolves.toEqual({
			job: null,
			status: 'unknown_cron',
		});
		expect(cleanup).not.toHaveBeenCalled();
		expect(maintenance).not.toHaveBeenCalled();
	});
});
