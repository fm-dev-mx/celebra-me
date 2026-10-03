import {
	classifyR2Operations,
	getCloudflarePlatformUsage,
	resetCloudflareUsageCache,
} from '@/lib/platform/server/cloudflare-usage';
import { CLOUDFLARE_FREE_TIER } from '@/lib/platform/contract/limits';
import type { PlatformMetric, PlatformProviderUsageOk } from '@/lib/platform/contract/types';

const ACCOUNT_ID = '0123456789abcdef0123456789abcdef';
const TOKEN = 'synthetic-analytics-token';
const NOW = new Date('2026-10-24T12:00:00.000Z');
const ENV_NAMES = [
	'MEMORIES_CLOUDFLARE_ACCOUNT_ID',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
	'MEMORIES_R2_BUCKET_NAME',
	'VERCEL_ENV',
] as const;

function graphql(rows: unknown[]): Response {
	return new Response(JSON.stringify({ data: { viewer: { accounts: [{ rows }] } } }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

function responseFor(query: string): Response {
	if (query.includes('MemoriesR2StorageByBucket')) {
		return graphql([
			{
				dimensions: { bucketName: 'celebra-memories' },
				max: { payloadSize: 1_500_000_000, metadataSize: 1_000 },
			},
			{
				dimensions: { bucketName: 'celebra-memories-staging' },
				max: { payloadSize: 400_000_000, metadataSize: 500 },
			},
			{
				dimensions: { bucketName: 'celebra-memories-local' },
				max: { payloadSize: 50_000_000, metadataSize: 0 },
			},
		]);
	}
	if (query.includes('r2StorageAdaptiveGroups')) {
		return graphql([{ max: { payloadSize: 1_500_000_000, metadataSize: 1_000 } }]);
	}
	if (query.includes('r2OperationsAdaptiveGroups')) {
		return graphql([
			{ sum: { requests: 120 }, dimensions: { actionType: 'PutObject' } },
			{ sum: { requests: 30 }, dimensions: { actionType: 'CreateMultipartUpload' } },
			{ sum: { requests: 900 }, dimensions: { actionType: 'GetObject' } },
			{ sum: { requests: 40 }, dimensions: { actionType: 'HeadObject' } },
			{ sum: { requests: 75 }, dimensions: { actionType: 'DeleteObject' } },
		]);
	}
	if (query.includes('workersInvocationsAdaptive')) {
		return graphql([{ sum: { requests: 410 } }]);
	}
	return graphql([{ sum: { requests: 55 } }]);
}

function createFetch(handler: (query: string) => Response | Promise<Response> = responseFor) {
	return jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body)) as { query: string };
		return handler(body.query);
	}) as unknown as jest.MockedFunction<typeof fetch>;
}

function metric(usage: PlatformProviderUsageOk, id: string, resource?: string): PlatformMetric {
	const found = usage.metrics.find((entry) => entry.id === id && entry.resource === resource);
	if (!found) throw new Error(`missing metric ${id} ${resource ?? ''}`);
	return found;
}

const originalEnv: Partial<Record<(typeof ENV_NAMES)[number], string>> = {};

beforeAll(() => {
	for (const name of ENV_NAMES) originalEnv[name] = process.env[name];
});

afterAll(() => {
	for (const name of ENV_NAMES) {
		if (originalEnv[name] === undefined) delete process.env[name];
		else process.env[name] = originalEnv[name];
	}
});

beforeEach(() => {
	resetCloudflareUsageCache();
	process.env.MEMORIES_CLOUDFLARE_ACCOUNT_ID = ACCOUNT_ID;
	process.env.MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN = TOKEN;
	process.env.MEMORIES_R2_BUCKET_NAME = 'celebra-memories';
	delete process.env.VERCEL_ENV;
});

describe('getCloudflarePlatformUsage', () => {
	it('reports unconfigured without calling Cloudflare when a variable is missing or malformed', async () => {
		const fetchImpl = createFetch();
		delete process.env.MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN;
		await expect(getCloudflarePlatformUsage(NOW, fetchImpl)).resolves.toEqual({
			kind: 'unconfigured',
		});

		process.env.MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN = TOKEN;
		process.env.MEMORIES_CLOUDFLARE_ACCOUNT_ID = 'not-an-account';
		await expect(getCloudflarePlatformUsage(NOW, fetchImpl)).resolves.toEqual({
			kind: 'unconfigured',
		});
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('combines the datasets against the Free-plan allowances and sums buckets for the account', async () => {
		const fetchImpl = createFetch();

		const usage = await getCloudflarePlatformUsage(NOW, fetchImpl);

		expect(usage.kind).toBe('ok');
		const ok = usage as PlatformProviderUsageOk;
		expect(ok.fetchedAt).toBe(NOW.toISOString());
		expect(ok.spendUsd).toBeNull();
		expect(metric(ok, 'cfR2StorageBucket', 'celebra-memories').meter).toEqual({
			used: 1_500_001_000,
			limit: CLOUDFLARE_FREE_TIER.r2StorageBytes,
		});
		expect(metric(ok, 'cfR2StorageBucket', 'celebra-memories-staging').meter.used).toBe(
			400_000_500,
		);
		// Local development buckets stay out of the panel but keep counting on the account.
		expect(
			ok.metrics.some(
				(entry) =>
					entry.id === 'cfR2StorageBucket' && entry.resource === 'celebra-memories-local',
			),
		).toBe(false);
		expect(metric(ok, 'cfR2StorageAccount').meter.used).toBe(1_950_001_500);
		expect(metric(ok, 'cfR2ClassA').meter).toEqual({ used: 150, limit: 1_000_000 });
		expect(metric(ok, 'cfR2ClassB').meter).toEqual({ used: 940, limit: 10_000_000 });
		expect(metric(ok, 'cfWorkersRequests').meter).toEqual({ used: 410, limit: 100_000 });
		expect(metric(ok, 'cfDurableObjectsRequests').meter).toEqual({ used: 55, limit: 100_000 });
		expect(fetchImpl).toHaveBeenCalledTimes(4);
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
		expect(init?.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
	});

	it('labels the configured bucket with the environment the panel runs in', async () => {
		process.env.VERCEL_ENV = 'production';
		const usage = (await getCloudflarePlatformUsage(
			NOW,
			createFetch(),
		)) as PlatformProviderUsageOk;

		expect(metric(usage, 'cfR2StorageBucket', 'celebra-memories').scope).toBe('production');
		expect(metric(usage, 'cfR2StorageBucket', 'celebra-memories-staging').scope).toBe(
			'account',
		);
		expect(metric(usage, 'cfR2StorageAccount').scope).toBe('account');
	});

	it('falls back to the single-bucket query when the bucket dimension is rejected', async () => {
		const fetchImpl = createFetch((query) =>
			query.includes('MemoriesR2StorageByBucket')
				? new Response('{"errors":[{"message":"unknown field"}]}', { status: 200 })
				: responseFor(query),
		);

		const usage = (await getCloudflarePlatformUsage(NOW, fetchImpl)) as PlatformProviderUsageOk;

		expect(metric(usage, 'cfR2StorageBucket', 'celebra-memories').meter.used).toBe(
			1_500_001_000,
		);
		expect(usage.metrics.some((entry) => entry.id === 'cfR2StorageAccount')).toBe(false);
		const queries = fetchImpl.mock.calls.map(([, request]) =>
			JSON.parse(String(request?.body)),
		);
		expect(queries.some((body) => body.query.includes('MemoriesR2StorageByBucket'))).toBe(true);
		expect(queries.some((body) => body.query.includes('bucketName: $bucketName'))).toBe(true);
	});

	it('estimates an overage in money only once a free allowance is exceeded', async () => {
		const fetchImpl = createFetch((query) =>
			query.includes('r2OperationsAdaptiveGroups')
				? graphql([
						{ sum: { requests: 1_200_000 }, dimensions: { actionType: 'PutObject' } },
					])
				: responseFor(query),
		);

		const usage = (await getCloudflarePlatformUsage(NOW, fetchImpl)) as PlatformProviderUsageOk;

		expect(metric(usage, 'cfR2ClassA').meter.used).toBe(1_200_000);
		expect(metric(usage, 'cfR2ClassA').overageUsd).toBeCloseTo(0.9, 2);
		expect(metric(usage, 'cfR2ClassB').overageUsd).toBeNull();
	});

	it('blanks only the dataset that fails and keeps the rest', async () => {
		const fetchImpl = createFetch((query) =>
			query.includes('durableObjects')
				? new Response('{"errors":[{"message":"unknown field"}]}', { status: 200 })
				: responseFor(query),
		);

		const usage = (await getCloudflarePlatformUsage(NOW, fetchImpl)) as PlatformProviderUsageOk;

		expect(metric(usage, 'cfWorkersRequests').meter.used).toBe(410);
		expect(metric(usage, 'cfDurableObjectsRequests').meter.used).toBeNull();
	});

	it('collapses total failure to unavailable without leaking the token or the response body', async () => {
		const fetchImpl = createFetch(
			() => new Response(`forbidden for ${TOKEN}`, { status: 403 }),
		);

		const usage = await getCloudflarePlatformUsage(NOW, fetchImpl);

		expect(usage).toEqual({ kind: 'unavailable' });
		expect(JSON.stringify(usage)).not.toContain(TOKEN);
	});

	it('treats a network error or timeout as unavailable', async () => {
		const fetchImpl = createFetch(() => Promise.reject(new Error('socket hang up')));
		await expect(getCloudflarePlatformUsage(NOW, fetchImpl)).resolves.toEqual({
			kind: 'unavailable',
		});
	});

	it('caches a successful read for five minutes and retries after a failure', async () => {
		const fetchImpl = createFetch();
		await getCloudflarePlatformUsage(NOW, fetchImpl);
		await getCloudflarePlatformUsage(new Date(NOW.getTime() + 60_000), fetchImpl);
		expect(fetchImpl).toHaveBeenCalledTimes(4);

		await getCloudflarePlatformUsage(new Date(NOW.getTime() + 6 * 60_000), fetchImpl);
		expect(fetchImpl).toHaveBeenCalledTimes(8);
	});
});

describe('classifyR2Operations', () => {
	it('counts unknown actions as Class A and skips free ones', () => {
		expect(
			classifyR2Operations([
				{ sum: { requests: 2 }, dimensions: { actionType: 'SomeNewWrite' } },
				{ sum: { requests: 3 }, dimensions: { actionType: 'AbortMultipartUpload' } },
				{ sum: { requests: 4 }, dimensions: { actionType: 'HeadBucket' } },
			]),
		).toEqual({ classA: 2, classB: 4 });
	});

	it('rejects malformed rows instead of under-reporting', () => {
		expect(
			classifyR2Operations([{ sum: {}, dimensions: { actionType: 'GetObject' } }]),
		).toEqual({
			classA: null,
			classB: null,
		});
		expect(classifyR2Operations(null)).toEqual({ classA: null, classB: null });
	});
});
