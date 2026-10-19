jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import {
	collectPlatformUsage,
	PLATFORM_SNAPSHOT_RETENTION_DAYS,
	runPlatformUsageCollector,
} from '@/lib/platform/server/collector/run-collector';
import {
	countNamespaceObjects,
	workerWindowsByScript,
} from '@/lib/platform/server/collector/cloudflare-datasets';
import { CELEBRA_ZONE_TAG } from '@/lib/platform/server/collector/collector-config';
import {
	insertPlatformSnapshots,
	purgePlatformSnapshots,
} from '@/lib/platform/server/collector/snapshot-store';
import type { PlatformSnapshotRow } from '@/lib/platform/server/collector/types';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const ACCOUNT_ID = '0123456789abcdef0123456789abcdef';
const CF_TOKEN = 'synthetic-analytics-token';
const SB_TOKEN = 'synthetic-management-token';
const PROJECT_REF = 'syntheticprodref';
const NOW = new Date('2026-10-24T12:00:00.000Z');
const ENV_NAMES = [
	'MEMORIES_CLOUDFLARE_ACCOUNT_ID',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
	'SUPABASE_MANAGEMENT_TOKEN',
	'SUPABASE_PROJECT_REF_PRODUCTION',
] as const;
const NS_RETRIEVE = 'a069aa5eace646e5ab346483007d85b2';
const NS_SIGN = 'ca3514c911424d05a8e05d7a7c1bcf2c';

const restRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

const accounts = (node: unknown) => json({ data: { viewer: { accounts: [node] } } });

function graphqlResponse(query: string): Response {
	if (query.includes('PlatformWorkersHealth')) {
		return accounts({
			today: [
				{
					dimensions: { scriptName: 'celebra-me' },
					sum: { requests: 2120, errors: 0, cpuTimeUs: 34_417_168 },
					quantiles: { cpuTimeP50: 8369, cpuTimeP99: 126_372 },
				},
			],
			month: [
				{
					dimensions: { scriptName: 'celebra-me' },
					sum: { requests: 5715, errors: 2, cpuTimeUs: 79_138_406 },
					quantiles: { cpuTimeP50: 5377, cpuTimeP99: 125_926 },
				},
				{
					dimensions: { scriptName: '__unknown__' },
					sum: { requests: 61, errors: 0, cpuTimeUs: 69_250 },
					quantiles: { cpuTimeP50: 1039, cpuTimeP99: 2849 },
				},
				{
					dimensions: { scriptName: '__unknown__' },
					sum: { requests: 485, errors: 0, cpuTimeUs: 4_742_341 },
					quantiles: { cpuTimeP50: 3713, cpuTimeP99: 81_229 },
				},
			],
		});
	}
	if (query.includes('PlatformDurableObjects')) {
		return accounts({
			today: [{ dimensions: { namespaceId: NS_RETRIEVE }, sum: { requests: 3, errors: 0 } }],
			month: [
				{ dimensions: { namespaceId: NS_RETRIEVE }, sum: { requests: 22, errors: 0 } },
				{ dimensions: { namespaceId: NS_SIGN }, sum: { requests: 8, errors: 1 } },
			],
		});
	}
	if (query.includes('PlatformR2')) {
		return accounts({
			storage: [
				{
					dimensions: { bucketName: 'celebra-memories' },
					max: { payloadSize: 1_000_000, metadataSize: 100 },
				},
			],
			operations: [
				{
					dimensions: { bucketName: 'celebra-memories', actionType: 'PutObject' },
					sum: { requests: 7 },
				},
				{
					dimensions: { bucketName: 'celebra-memories', actionType: 'GetObject' },
					sum: { requests: 40 },
				},
				{
					dimensions: { bucketName: 'celebra-memories', actionType: 'DeleteObject' },
					sum: { requests: 3 },
				},
				{
					dimensions: {
						bucketName: 'celebra-invitation-media',
						actionType: 'HeadObject',
					},
					sum: { requests: 5 },
				},
			],
		});
	}
	if (query.includes('PlatformZoneTraffic')) {
		return json({
			data: {
				viewer: {
					zones: [
						{
							days: [
								{
									dimensions: { date: '2026-10-23' },
									sum: {
										requests: 5257,
										threats: 38,
										responseStatusMap: [
											{ edgeResponseStatus: 200, requests: 3005 },
											{ edgeResponseStatus: 403, requests: 77 },
											{ edgeResponseStatus: 404, requests: 917 },
										],
									},
								},
							],
							top404: [
								{ count: 14, dimensions: { clientRequestPath: '/.git/config' } },
								{
									count: 8,
									dimensions: { clientRequestPath: `/wp-${'x'.repeat(400)}` },
								},
							],
						},
					],
				},
			},
		});
	}
	throw new Error(`unexpected query ${query.slice(0, 40)}`);
}

interface FetchOverrides {
	graphql?: (query: string) => Response;
	rest?: (url: string) => Response | undefined;
}

function createFetch(overrides: FetchOverrides = {}) {
	return jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		const override = overrides.rest?.(url);
		if (override) return override;
		if (url.endsWith('/graphql')) {
			const { query } = JSON.parse(String(init?.body)) as { query: string };
			return (overrides.graphql ?? graphqlResponse)(query);
		}
		if (url.includes('/durable_objects/namespaces?')) {
			return json({
				success: true,
				result: [
					{
						id: NS_RETRIEVE,
						name: 'celebra-memories-retrieve_ReplayGuard',
						script: 'celebra-memories-retrieve',
						class: 'ReplayGuard',
					},
					{
						id: NS_SIGN,
						name: 'celebra-memories-sign_ReplayGuard',
						script: 'celebra-memories-sign',
						class: 'ReplayGuard',
					},
				],
			});
		}
		if (url.includes(`/namespaces/${NS_RETRIEVE}/objects`)) {
			return json({
				result: [
					{ id: 'o1', hasStoredData: true },
					{ id: 'o2', hasStoredData: false },
				],
				result_info: { count: 2, cursor: 'last-page-cursor' },
			});
		}
		if (url.includes(`/namespaces/${NS_SIGN}/objects`)) {
			return json({ result: [{ id: 'o3', hasStoredData: true }], result_info: { count: 1 } });
		}
		if (url === `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/disk/util`) {
			return json({
				timestamp: NOW.toISOString(),
				metrics: {
					fs_size_bytes: 8_000_000_000,
					fs_avail_bytes: 7_000_000_000,
					fs_used_bytes: 123_456_789,
				},
			});
		}
		throw new Error(`unexpected request ${url}`);
	}) as unknown as jest.MockedFunction<typeof fetch>;
}

function row(rows: PlatformSnapshotRow[], provider: PlatformSnapshotRow['provider']) {
	const found = rows.find((entry) => entry.provider === provider);
	if (!found) throw new Error(`missing ${provider}`);
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

const DATABASE_SIZE_RPC = 'rpc/platform_database_size';
const DATABASE_BYTES = 69_000_000;

beforeEach(() => {
	jest.clearAllMocks();
	process.env.MEMORIES_CLOUDFLARE_ACCOUNT_ID = ACCOUNT_ID;
	process.env.MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN = CF_TOKEN;
	process.env.SUPABASE_MANAGEMENT_TOKEN = SB_TOKEN;
	process.env.SUPABASE_PROJECT_REF_PRODUCTION = PROJECT_REF;
	restRequest.mockImplementation(async (options: { pathWithQuery: string }) =>
		options.pathWithQuery === DATABASE_SIZE_RPC ? DATABASE_BYTES : [],
	);
});

describe('collectPlatformUsage', () => {
	it('collects every dataset into one row per provider with aggregates only', async () => {
		const fetchImpl = createFetch();

		const rows = await collectPlatformUsage(NOW, fetchImpl);

		expect(rows.map((entry) => entry.provider)).toEqual([
			'cloudflare_workers',
			'cloudflare_durable_objects',
			'cloudflare_r2',
			'cloudflare_zone',
			'supabase_disk',
			'supabase_database',
		]);
		expect(rows.every((entry) => entry.ok && entry.collected_at === NOW.toISOString())).toBe(
			true,
		);

		expect(row(rows, 'cloudflare_workers').payload).toMatchObject({
			dayStart: '2026-10-24T00:00:00.000Z',
			monthStart: '2026-10-01T00:00:00.000Z',
			scripts: [
				{
					scriptName: '__unknown__',
					today: null,
					month: { requests: 546, errors: 0, cpuTimeMs: 4811, cpuP50Ms: 4, cpuP99Ms: 81 },
				},
				{
					scriptName: 'celebra-me',
					today: {
						requests: 2120,
						errors: 0,
						cpuTimeMs: 34_417,
						cpuP50Ms: 8,
						cpuP99Ms: 126,
					},
					month: {
						requests: 5715,
						errors: 2,
						cpuTimeMs: 79_138,
						cpuP50Ms: 5,
						cpuP99Ms: 126,
					},
				},
			],
			totals: {
				today: { requests: 2120, errors: 0, cpuTimeMs: 34_417 },
				month: { requests: 6261, errors: 2, cpuTimeMs: 83_949 },
			},
		});

		expect(row(rows, 'cloudflare_durable_objects').payload).toMatchObject({
			namespaces: [
				{
					id: NS_RETRIEVE,
					script: 'celebra-memories-retrieve',
					className: 'ReplayGuard',
					requestsToday: 3,
					requestsMonth: 22,
					objects: 2,
					withStoredData: 1,
					truncated: false,
				},
				{ id: NS_SIGN, requestsToday: 0, requestsMonth: 8, errorsMonth: 1, objects: 1 },
			],
			totals: { requestsToday: 3, requestsMonth: 30, objects: 3, withStoredData: 2 },
		});

		expect(row(rows, 'cloudflare_r2').payload).toEqual({
			monthStart: '2026-10-01T00:00:00.000Z',
			buckets: [
				{ bucketName: 'celebra-invitation-media', storageBytes: 0, classA: 0, classB: 5 },
				{ bucketName: 'celebra-memories', storageBytes: 1_000_100, classA: 7, classB: 40 },
			],
			totals: { storageBytes: 1_000_100, classA: 7, classB: 45 },
		});

		const zone = row(rows, 'cloudflare_zone').payload;
		expect(zone.days).toEqual([
			{ date: '2026-10-23', requests: 5257, threats: 38, status403: 77, status404: 917 },
		]);
		const paths = zone.top404Paths as { path: string; count: number }[];
		expect(paths[0]).toEqual({ path: '/.git/config', count: 14 });
		expect(paths[1]?.path).toHaveLength(200);

		expect(row(rows, 'supabase_disk').payload).toEqual({ usedBytes: 123_456_789 });
		expect(row(rows, 'supabase_database').payload).toEqual({ usedBytes: DATABASE_BYTES });

		// 4 GraphQL datasets + namespace list + 2 object listings + Supabase disk.
		expect(fetchImpl).toHaveBeenCalledTimes(8);
		const zoneCall = fetchImpl.mock.calls.find(([, init]) =>
			String(init?.body).includes('PlatformZoneTraffic'),
		);
		expect(JSON.parse(String(zoneCall?.[1]?.body)).variables).toMatchObject({
			zoneTag: CELEBRA_ZONE_TAG,
			sinceDate: '2026-10-17',
			untilDate: '2026-10-24',
		});
	});

	it('never stores a token or a provider body', async () => {
		const fetchImpl = createFetch({
			rest: (url) =>
				url.includes('supabase.com')
					? json({ message: `secret ${SB_TOKEN}` }, 500)
					: undefined,
		});

		const rows = await collectPlatformUsage(NOW, fetchImpl);
		const serialized = JSON.stringify(rows);

		expect(serialized).not.toContain(CF_TOKEN);
		expect(serialized).not.toContain(SB_TOKEN);
		expect(serialized).not.toContain('secret');
		expect(row(rows, 'supabase_disk')).toMatchObject({
			ok: false,
			payload: { failure: 'http_5xx', stage: 'disk_util' },
		});
	});

	it('isolates a failing provider and names the permission a 403 lacks', async () => {
		const fetchImpl = createFetch({
			rest: (url) => {
				if (url.includes('/durable_objects/namespaces?'))
					return json({ success: false }, 403);
				if (url.includes('supabase.com')) return json({}, 403);
				return undefined;
			},
			graphql: (query) =>
				query.includes('PlatformZoneTraffic')
					? json({
							data: null,
							errors: [{ message: 'denied', extensions: { code: 'authz' } }],
						})
					: graphqlResponse(query),
		});

		const rows = await collectPlatformUsage(NOW, fetchImpl);

		expect(row(rows, 'cloudflare_workers').ok).toBe(true);
		expect(row(rows, 'cloudflare_r2').ok).toBe(true);
		expect(row(rows, 'cloudflare_durable_objects')).toEqual(
			expect.objectContaining({
				ok: false,
				payload: {
					failure: 'http_403',
					stage: 'namespaces',
					missingPermission: 'Workers Scripts Read',
				},
			}),
		);
		expect(row(rows, 'cloudflare_zone').payload).toEqual({
			failure: 'graphql_error',
			stage: 'graphql',
			code: 'authz',
			missingPermission: 'Zone Analytics Read (celebra-me.com)',
		});
		expect(row(rows, 'supabase_disk').payload).toEqual({
			failure: 'http_403',
			stage: 'disk_util',
			missingPermission: 'Disk Config Read',
		});
	});

	it('records a thrown fetch as a failed dataset without stopping the run', async () => {
		const fetchImpl = createFetch({
			graphql: (query) => {
				if (query.includes('PlatformR2')) throw new TypeError('socket closed');
				return graphqlResponse(query);
			},
		});

		const rows = await collectPlatformUsage(NOW, fetchImpl);

		expect(row(rows, 'cloudflare_r2')).toMatchObject({
			ok: false,
			payload: { failure: 'network' },
		});
		expect(rows.filter((entry) => entry.ok)).toHaveLength(5);
	});

	it('records the database size RPC failure without needing the Management API token', async () => {
		delete process.env.SUPABASE_MANAGEMENT_TOKEN;
		restRequest.mockImplementation(async (options: { pathWithQuery: string }) => {
			if (options.pathWithQuery === DATABASE_SIZE_RPC) throw new Error('function not found');
			return [];
		});

		const rows = await collectPlatformUsage(NOW, createFetch());

		expect(row(rows, 'supabase_database')).toMatchObject({
			ok: false,
			payload: { failure: 'network', stage: 'rpc' },
		});
		expect(row(rows, 'supabase_disk')).toMatchObject({
			ok: false,
			payload: { failure: 'unconfigured', missing: ['SUPABASE_MANAGEMENT_TOKEN'] },
		});
	});

	it('rejects malformed rows instead of storing half a figure', async () => {
		const fetchImpl = createFetch({
			graphql: (query) =>
				query.includes('PlatformWorkersHealth')
					? accounts({ today: [{ dimensions: { scriptName: 'x' }, sum: {} }], month: [] })
					: graphqlResponse(query),
		});

		const rows = await collectPlatformUsage(NOW, fetchImpl);

		expect(row(rows, 'cloudflare_workers').payload).toEqual({
			failure: 'malformed',
			stage: 'graphql',
		});
	});

	it('reports unconfigured datasets by variable name without calling providers', async () => {
		delete process.env.MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN;
		delete process.env.SUPABASE_PROJECT_REF_PRODUCTION;
		const fetchImpl = createFetch();

		const rows = await collectPlatformUsage(NOW, fetchImpl);

		expect(fetchImpl).not.toHaveBeenCalled();
		expect(row(rows, 'cloudflare_zone').payload).toEqual({
			failure: 'unconfigured',
			missing: ['MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN'],
		});
		expect(row(rows, 'supabase_disk').payload).toEqual({
			failure: 'unconfigured',
			missing: ['SUPABASE_PROJECT_REF_PRODUCTION'],
		});
	});
});

describe('Durable Objects listing', () => {
	it('follows the cursor while pages are full', async () => {
		const full = Array.from({ length: 10_000 }, (_, index) => ({
			id: `o${index}`,
			hasStoredData: index % 2 === 0,
		}));
		const fetchImpl = jest.fn(async (input: string | URL | Request) => {
			const url = new URL(String(input));
			return url.searchParams.get('cursor') === 'page-2'
				? json({
						result: [{ id: 'last', hasStoredData: true }],
						result_info: { cursor: 'end' },
					})
				: json({ result: full, result_info: { cursor: 'page-2' } });
		}) as unknown as typeof fetch;

		await expect(
			countNamespaceObjects(
				{ accountId: ACCOUNT_ID, token: CF_TOKEN, zoneTag: CELEBRA_ZONE_TAG },
				NS_RETRIEVE,
				fetchImpl,
			),
		).resolves.toEqual({
			ok: true,
			value: { objects: 10_001, withStoredData: 5_001, truncated: false },
		});
	});

	it('merges repeated script rows and keeps the worst quantile', () => {
		const merged = workerWindowsByScript([
			{
				dimensions: { scriptName: 'a' },
				sum: { requests: 1, errors: 0, cpuTimeUs: 1000 },
				quantiles: { cpuTimeP50: 1000, cpuTimeP99: 9000 },
			},
			{
				dimensions: { scriptName: 'a' },
				sum: { requests: 2, errors: 1, cpuTimeUs: 2000 },
				quantiles: { cpuTimeP50: 3000, cpuTimeP99: 4000 },
			},
		]);
		expect(merged?.get('a')).toEqual({
			requests: 3,
			errors: 1,
			cpuTimeMs: 3,
			cpuP50Ms: 3,
			cpuP99Ms: 9,
		});
	});
});

describe('snapshot store', () => {
	it('inserts rows with the service role and no response body', async () => {
		const rows: PlatformSnapshotRow[] = [
			{
				collected_at: NOW.toISOString(),
				provider: 'supabase_disk',
				ok: true,
				payload: { usedBytes: 1 },
			},
		];

		await insertPlatformSnapshots(rows);
		await insertPlatformSnapshots([]);

		expect(restRequest).toHaveBeenCalledTimes(1);
		expect(restRequest).toHaveBeenCalledWith({
			pathWithQuery: 'platform_usage_snapshots',
			method: 'POST',
			useServiceRole: true,
			prefer: 'return=minimal',
			body: rows,
		});
	});

	it('purges only rows collected before the cutoff', async () => {
		await purgePlatformSnapshots(new Date('2026-07-26T12:00:00.000Z'));

		expect(restRequest).toHaveBeenCalledWith({
			pathWithQuery: 'platform_usage_snapshots?collected_at=lt.2026-07-26T12%3A00%3A00.000Z',
			method: 'DELETE',
			useServiceRole: true,
			prefer: 'return=minimal',
		});
	});
});

describe('runPlatformUsageCollector', () => {
	it('stores the run, then purges rows older than 90 days', async () => {
		const fetchImpl = createFetch({
			rest: (url) => (url.includes('supabase.com') ? json({}, 403) : undefined),
		});

		const result = await runPlatformUsageCollector(NOW, fetchImpl);

		expect(PLATFORM_SNAPSHOT_RETENTION_DAYS).toBe(90);
		expect(restRequest).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				method: 'POST',
				pathWithQuery: DATABASE_SIZE_RPC,
				useServiceRole: true,
			}),
		);
		expect(restRequest).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ method: 'POST', pathWithQuery: 'platform_usage_snapshots' }),
		);
		expect(restRequest).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({
				method: 'DELETE',
				pathWithQuery:
					'platform_usage_snapshots?collected_at=lt.2026-07-26T12%3A00%3A00.000Z',
			}),
		);
		expect(result).toEqual({
			datasets: {
				cloudflare_workers: true,
				cloudflare_durable_objects: true,
				cloudflare_r2: true,
				cloudflare_zone: true,
				supabase_disk: false,
				supabase_database: true,
			},
			missingPermissions: ['Disk Config Read'],
			purged: true,
		});
	});

	it('keeps the stored run when the purge fails', async () => {
		restRequest.mockImplementation(
			async (options: { pathWithQuery: string; method?: string }) => {
				if (options.pathWithQuery === DATABASE_SIZE_RPC) return DATABASE_BYTES;
				if (options.method === 'DELETE') throw new Error('timeout');
				return [];
			},
		);

		const result = await runPlatformUsageCollector(NOW, createFetch());

		expect(result.purged).toBe(false);
		expect(Object.values(result.datasets).every(Boolean)).toBe(true);
	});

	it('fails when the snapshot table cannot be written and skips the purge', async () => {
		restRequest.mockImplementation(async (options: { pathWithQuery: string }) => {
			if (options.pathWithQuery === DATABASE_SIZE_RPC) return DATABASE_BYTES;
			throw new Error('relation does not exist');
		});

		await expect(runPlatformUsageCollector(NOW, createFetch())).rejects.toThrow();
		expect(restRequest).toHaveBeenCalledTimes(2);
	});
});
