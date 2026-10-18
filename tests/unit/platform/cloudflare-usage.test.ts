import {
	classifyR2Operations,
	getCloudflarePlatformUsage,
	resetCloudflareUsageCache,
	type CloudflareUsageSnapshot,
} from '@/lib/platform/server/cloudflare-usage';
import { CLOUDFLARE_PAID_PLAN } from '@/lib/platform/contract/limits';
import type { PlatformMetric } from '@/lib/platform/contract/types';
import { asHostedDeploy } from '@tests/helpers/deploy-identity';

const ACCOUNT_ID = '0123456789abcdef0123456789abcdef';
const TOKEN = 'synthetic-analytics-token';
const NOW = new Date('2026-10-24T12:00:00.000Z');
const ENV_NAMES = [
	'SUPABASE_URL',
	'MEMORIES_CLOUDFLARE_ACCOUNT_ID',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
	'MEMORIES_R2_BUCKET_NAME',
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

function metric(snapshot: CloudflareUsageSnapshot, id: string, scope?: string): PlatformMetric {
	const found = snapshot.metrics.find(
		(entry) => entry.id === id && (scope === undefined || entry.scope === scope),
	);
	if (!found) throw new Error(`missing metric ${id} ${scope ?? ''}`);
	return found;
}

function missingNames(snapshot: CloudflareUsageSnapshot): string[] {
	return snapshot.missing.map((entry) => entry.name).sort();
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
	for (const name of ENV_NAMES) delete process.env[name];
	process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
	process.env.MEMORIES_CLOUDFLARE_ACCOUNT_ID = ACCOUNT_ID;
	process.env.MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN = TOKEN;
});

describe('getCloudflarePlatformUsage', () => {
	it('reports unconfigured without calling Cloudflare and names every missing variable', async () => {
		const fetchImpl = createFetch();
		delete process.env.MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN;

		const usage = await getCloudflarePlatformUsage(NOW, fetchImpl);

		expect(usage.kind).toBe('unconfigured');
		expect(usage).not.toHaveProperty('metrics[0]');
		expect(usage.missing).toEqual([
			{ name: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN', state: 'absent', scope: 'account' },
		]);
		expect(JSON.stringify(usage)).not.toContain(TOKEN);

		process.env.MEMORIES_CLOUDFLARE_ACCOUNT_ID = 'not-an-account';
		const malformed = await getCloudflarePlatformUsage(NOW, createFetch());
		expect(malformed.kind).toBe('unconfigured');
		expect(missingNames(malformed)).toContain('MEMORIES_CLOUDFLARE_ACCOUNT_ID');
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('reports the declared bucket of a deployment and sums every bucket for the account', async () => {
		asHostedDeploy('production');
		process.env.MEMORIES_R2_BUCKET_NAME = 'celebra-memories';
		const fetchImpl = createFetch();

		const usage = await getCloudflarePlatformUsage(NOW, fetchImpl);

		expect(usage.kind).toBe('ok');
		expect(usage.fetchedAt).toBe(NOW.toISOString());
		expect(usage.missing).toEqual([]);
		expect(metric(usage, 'cfR2StorageBucket', 'production')).toMatchObject({
			resource: 'celebra-memories',
			scope: 'production',
			meter: { used: 1_500_001_000, limit: CLOUDFLARE_PAID_PLAN.r2StorageBytes },
		});
		expect(usage.metrics.some((entry) => entry.scope === 'preview')).toBe(false);
		expect(metric(usage, 'cfR2StorageAccount').meter.used).toBe(1_950_001_500);
		expect(metric(usage, 'cfR2ClassA').meter).toEqual({ used: 150, limit: 1_000_000 });
		expect(metric(usage, 'cfR2ClassB').meter).toEqual({ used: 940, limit: 10_000_000 });
		expect(metric(usage, 'cfWorkersRequests')).toMatchObject({
			window: 'monthUtc',
			meter: { used: 410, limit: 10_000_000 },
		});
		expect(metric(usage, 'cfDurableObjectsRequests')).toMatchObject({
			window: 'monthUtc',
			meter: { used: 55, limit: 1_000_000 },
		});
		expect(fetchImpl).toHaveBeenCalledTimes(4);
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
		expect(init?.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
	});

	it('names the bucket variable when a deployment does not declare a valid one', async () => {
		asHostedDeploy('preview');

		const usage = await getCloudflarePlatformUsage(NOW, createFetch());

		expect(usage.kind).toBe('ok');
		expect(usage.missing).toEqual([
			{ name: 'MEMORIES_R2_BUCKET_NAME', state: 'absent', scope: 'preview' },
		]);
		expect(metric(usage, 'cfR2StorageBucket', 'preview').meter.used).toBeNull();

		resetCloudflareUsageCache();
		process.env.MEMORIES_R2_BUCKET_NAME = 'Not A Bucket';
		const invalid = await getCloudflarePlatformUsage(NOW, createFetch());
		expect(invalid.missing).toEqual([
			{ name: 'MEMORIES_R2_BUCKET_NAME', state: 'invalid', scope: 'preview' },
		]);
		expect(JSON.stringify(invalid)).not.toContain('Not A Bucket');
	});

	it('shows only account totals on Local, whose plain bucket is the Local bucket', async () => {
		process.env.MEMORIES_R2_BUCKET_NAME = 'celebra-memories-local';

		const usage = await getCloudflarePlatformUsage(NOW, createFetch());

		expect(usage.kind).toBe('ok');
		expect(usage.missing).toEqual([]);
		expect(usage.metrics.some((entry) => entry.id === 'cfR2StorageBucket')).toBe(false);
		expect(metric(usage, 'cfR2StorageAccount').meter.used).toBe(1_950_001_500);
	});

	it('blanks the storage meters when a storage row lacks its bucket', async () => {
		const fetchImpl = createFetch((query) =>
			query.includes('MemoriesR2StorageByBucket')
				? graphql([{ max: { payloadSize: 10, metadataSize: 0 } }])
				: responseFor(query),
		);

		const usage = await getCloudflarePlatformUsage(NOW, fetchImpl);

		expect(usage.kind).toBe('ok');
		expect(metric(usage, 'cfR2StorageAccount').meter.used).toBeNull();
		expect(metric(usage, 'cfWorkersRequests').meter.used).toBe(410);
	});

	it('estimates an overage in money only once a free allowance is exceeded', async () => {
		const fetchImpl = createFetch((query) =>
			query.includes('r2OperationsAdaptiveGroups')
				? graphql([
						{ sum: { requests: 1_200_000 }, dimensions: { actionType: 'PutObject' } },
					])
				: responseFor(query),
		);

		const usage = await getCloudflarePlatformUsage(NOW, fetchImpl);

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

		const usage = await getCloudflarePlatformUsage(NOW, fetchImpl);

		expect(metric(usage, 'cfWorkersRequests').meter.used).toBe(410);
		expect(metric(usage, 'cfDurableObjectsRequests').meter.used).toBeNull();
	});

	it('collapses total failure to unavailable without leaking the token or the response body', async () => {
		const fetchImpl = createFetch(
			() => new Response(`forbidden for ${TOKEN}`, { status: 403 }),
		);

		const usage = await getCloudflarePlatformUsage(NOW, fetchImpl);

		expect(usage).toMatchObject({ kind: 'unavailable', metrics: [] });
		expect(JSON.stringify(usage)).not.toContain(TOKEN);
	});

	it('treats a network error or timeout as unavailable', async () => {
		const fetchImpl = createFetch(() => Promise.reject(new Error('socket hang up')));
		await expect(getCloudflarePlatformUsage(NOW, fetchImpl)).resolves.toMatchObject({
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
