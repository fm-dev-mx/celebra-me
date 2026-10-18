import {
	PAGE_EXPECTATIONS,
	SCHEDULED_HANDLER_PATH,
	SCHEDULED_JOB_LOG_MARKERS,
	runLocalWorkerChecks,
} from '../../scripts/ops/cloudflare-worker-local-check.ts';
import { SCHEDULED_JOB_CRONS } from '@/lib/server/scheduled-jobs';
import { resolveSecurityHeaders } from '@/lib/server/security-headers';

const ORIGIN = 'http://127.0.0.1:8799';
const SHA = 'a'.repeat(40);

interface FakeWorkerOptions {
	dropHeader?: string;
	healthStatus?: number;
	scheduledBody?: string;
}

/** Answers like a healthy local Worker; options break one behavior at a time. */
function fakeWorker(options: FakeWorkerOptions = {}) {
	const requested: string[] = [];
	const fetchImpl = jest.fn(async (input: string | URL | Request) => {
		const url = new URL(String(input));
		requested.push(`${url.pathname}${url.search}`);
		const headers = new Headers(
			resolveSecurityHeaders(url.pathname)
				.filter(([name]) => name !== options.dropHeader)
				.map(([name, value]) => [name, value]),
		);
		if (url.pathname === SCHEDULED_HANDLER_PATH) {
			return new Response(options.scheduledBody ?? 'ok', { status: 200 });
		}
		if (url.pathname === '/api/health') {
			const status = options.healthStatus ?? 200;
			headers.set('content-type', 'application/json');
			const body = JSON.stringify({
				status: status === 200 ? 'healthy' : 'unhealthy',
				build: { commitSha: SHA },
				checks: {
					runtime: { status: 'ok' },
					database: { status: status === 200 ? 'ok' : 'error' },
				},
			});
			return new Response(body, { status, headers });
		}
		const page = PAGE_EXPECTATIONS.find((entry) => entry.path === url.pathname);
		if (!page) return new Response('not found', { status: 404, headers });
		if (page.status !== 200) headers.set('location', page.location ?? '/login');
		return new Response(null, { status: page.status, headers });
	});
	return { fetchImpl: fetchImpl as unknown as typeof fetch, requested };
}

const fullLog = Object.values(SCHEDULED_JOB_LOG_MARKERS).join('\n');

describe('cloudflare-worker-local-check', () => {
	it('passes a Worker that serves headers, health and both crons', async () => {
		const { fetchImpl, requested } = fakeWorker();

		await expect(
			runLocalWorkerChecks({
				origin: ORIGIN,
				fetchImpl,
				expectedSha: SHA,
				readLog: () => fullLog,
			}),
		).resolves.toEqual([]);
		for (const cron of Object.values(SCHEDULED_JOB_CRONS)) {
			expect(requested).toContain(
				`${SCHEDULED_HANDLER_PATH}?cron=${encodeURIComponent(cron)}`,
			);
		}
	});

	it('reports a security header the Worker drops', async () => {
		const { fetchImpl } = fakeWorker({ dropHeader: 'X-Frame-Options' });

		const failures = await runLocalWorkerChecks({ origin: ORIGIN, fetchImpl });

		expect(failures).toContain('/: header X-Frame-Options is missing');
		expect(failures).toContain('/api/health: header X-Frame-Options is missing');
	});

	it('reports an unhealthy database and a different build', async () => {
		const { fetchImpl } = fakeWorker({ healthStatus: 503 });

		const failures = await runLocalWorkerChecks({
			origin: ORIGIN,
			fetchImpl,
			expectedSha: 'b'.repeat(40),
		});

		expect(failures).toEqual(
			expect.arrayContaining([
				'/api/health: status 503 (unhealthy)',
				'/api/health: database check is not ok',
				`/api/health: commitSha ${SHA}, expected ${'b'.repeat(40)}`,
			]),
		);
	});

	it('reports a cron whose job never logs, as when scheduled() drops the job', async () => {
		const { fetchImpl } = fakeWorker();

		const failures = await runLocalWorkerChecks({
			origin: ORIGIN,
			fetchImpl,
			readLog: () => SCHEDULED_JOB_LOG_MARKERS.memories_cleanup,
			logTimeoutMs: 0,
			sleep: async () => undefined,
		});

		expect(failures).toEqual([
			`scheduled engagement_maintenance (${SCHEDULED_JOB_CRONS.engagement_maintenance}): no "${SCHEDULED_JOB_LOG_MARKERS.engagement_maintenance}" line in the wrangler log`,
		]);
	});

	it('reports a scheduled handler that does not answer ok', async () => {
		const { fetchImpl } = fakeWorker({ scheduledBody: 'Not Found' });

		const failures = await runLocalWorkerChecks({ origin: ORIGIN, fetchImpl });

		expect(failures).toHaveLength(Object.keys(SCHEDULED_JOB_CRONS).length);
		expect(failures[0]).toMatch(/^scheduled memories_cleanup .*: 200 Not Found$/);
	});
});
