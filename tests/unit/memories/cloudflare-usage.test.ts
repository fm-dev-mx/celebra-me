import {
	classifyR2Operations,
	getCloudflarePlatformUsage,
	resetCloudflareUsageCache,
} from '@/lib/memories/server/cloudflare-usage';
import { CLOUDFLARE_FREE_TIER } from '@/lib/memories/contract/limits';

const ACCOUNT_ID = '0123456789abcdef0123456789abcdef';
const TOKEN = 'synthetic-analytics-token';
const NOW = new Date('2026-10-24T12:00:00.000Z');
const ENV_NAMES = [
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

	it('combines the four datasets against the Free-plan allowances', async () => {
		const fetchImpl = createFetch();

		const usage = await getCloudflarePlatformUsage(NOW, fetchImpl);

		expect(usage).toEqual({
			kind: 'ok',
			fetchedAt: NOW.toISOString(),
			r2StorageBytes: { used: 1_500_001_000, limit: CLOUDFLARE_FREE_TIER.r2StorageBytes },
			r2ClassAOperations: { used: 150, limit: 1_000_000 },
			r2ClassBOperations: { used: 940, limit: 10_000_000 },
			workersRequests: { used: 410, limit: 100_000 },
			durableObjectsRequests: { used: 55, limit: 100_000 },
		});
		expect(fetchImpl).toHaveBeenCalledTimes(4);
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
		expect(init?.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
		const storageCall = fetchImpl.mock.calls
			.map(([, request]) => JSON.parse(String(request?.body)))
			.find((body) => body.query.includes('r2StorageAdaptiveGroups'));
		expect(storageCall.variables).toMatchObject({
			accountTag: ACCOUNT_ID,
			bucketName: 'celebra-memories',
		});
	});

	it('blanks only the dataset that fails and keeps the rest', async () => {
		const fetchImpl = createFetch((query) =>
			query.includes('durableObjects')
				? new Response('{"errors":[{"message":"unknown field"}]}', { status: 200 })
				: responseFor(query),
		);

		const usage = await getCloudflarePlatformUsage(NOW, fetchImpl);

		expect(usage).toMatchObject({
			kind: 'ok',
			workersRequests: { used: 410 },
			durableObjectsRequests: { used: null },
		});
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
