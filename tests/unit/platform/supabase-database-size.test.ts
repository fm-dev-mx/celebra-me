/**
 * Supabase database size for the platform console: read through the
 * service-role-only `platform_database_size()` RPC of the deployment's own
 * project and compared against the Free plan's 500 MB cap. Disk stays an
 * informative figure.
 */

import { platformUsageLevel, platformUsageRatio } from '@/lib/platform/contract/meters';
import {
	getSupabasePlatformUsage,
	resetSupabaseUsageCache,
} from '@/lib/platform/server/supabase-usage';

const NOW = new Date('2026-10-24T12:00:00.000Z');
const REF = 'abcdefghijklmnopqrst';
const SERVICE_KEY = 'secret-service-role-value';

const ENV_NAMES = [
	'SUPABASE_MANAGEMENT_TOKEN',
	'SUPABASE_PROJECT_REF_PRODUCTION',
	'SUPABASE_URL',
	'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

type Route = { database?: Response; disk?: Response };

function providerFetch(route: Route) {
	return jest.fn<Promise<Response>, Parameters<typeof fetch>>(async (input) => {
		const url = String(input);
		if (url.endsWith('/rest/v1/rpc/platform_database_size')) {
			return route.database ?? jsonResponse({ message: 'not found' }, 404);
		}
		if (url.endsWith('/config/disk/util')) {
			return route.disk ?? jsonResponse({ message: 'error' }, 500);
		}
		throw new Error(`unexpected request ${url}`);
	});
}

function metricById(usage: Awaited<ReturnType<typeof getSupabasePlatformUsage>>, id: string) {
	return usage.kind === 'ok' ? usage.metrics.find((metric) => metric.id === id) : undefined;
}

describe('Supabase database size', () => {
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
		process.env.SUPABASE_MANAGEMENT_TOKEN = 'secret-pat-value';
		process.env.SUPABASE_PROJECT_REF_PRODUCTION = REF;
		process.env.SUPABASE_URL = `https://${REF}.supabase.co/`;
		process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
		resetSupabaseUsageCache();
	});

	it('reads the size through the RPC of its own project, against the 500 MB cap', async () => {
		const fetchImpl = providerFetch({
			database: jsonResponse(400_000_000),
			disk: jsonResponse({ metrics: { fs_used_bytes: 1_200_000_000 } }),
		});

		const usage = await getSupabasePlatformUsage('production', NOW, fetchImpl);

		const database = metricById(usage, 'sbDatabase');
		expect(database).toMatchObject({
			meter: { used: 400_000_000, limit: 500_000_000 },
			scope: 'production',
		});
		expect(platformUsageLevel(platformUsageRatio(400_000_000, 500_000_000))).toBe('warning');
		expect(metricById(usage, 'sbDisk')).toMatchObject({
			meter: { used: 1_200_000_000, limit: null },
		});

		const rpcCall = fetchImpl.mock.calls.find(([url]) => String(url).includes('/rpc/'));
		expect(String(rpcCall?.[0])).toBe(
			`https://${REF}.supabase.co/rest/v1/rpc/platform_database_size`,
		);
		const init = rpcCall?.[1];
		expect(init?.method).toBe('POST');
		expect(init?.headers).toMatchObject({
			apikey: SERVICE_KEY,
			Authorization: `Bearer ${SERVICE_KEY}`,
		});
	});

	it('never calls another project with this deployment’s service role key', async () => {
		process.env.SUPABASE_URL = 'https://otherprojectref000000.supabase.co';
		const fetchImpl = providerFetch({
			disk: jsonResponse({ metrics: { fs_used_bytes: 333_000_000 } }),
		});

		const usage = await getSupabasePlatformUsage('production', NOW, fetchImpl);

		expect(fetchImpl.mock.calls.some(([url]) => String(url).includes('/rpc/'))).toBe(false);
		expect(metricById(usage, 'sbDatabase')).toMatchObject({
			meter: { used: null, limit: 500_000_000 },
		});
		expect(metricById(usage, 'sbDisk')).toMatchObject({ meter: { used: 333_000_000 } });
	});

	it('falls back to disk only while the migration is not applied', async () => {
		const fetchImpl = providerFetch({
			disk: jsonResponse({ metrics: { fs_used_bytes: 333_000_000 } }),
		});

		const usage = await getSupabasePlatformUsage('production', NOW, fetchImpl);

		expect(usage.kind).toBe('ok');
		expect(metricById(usage, 'sbDatabase')?.meter.used).toBeNull();
		expect(metricById(usage, 'sbDisk')?.meter.used).toBe(333_000_000);
	});

	it('keeps the database size when the disk read fails', async () => {
		const fetchImpl = providerFetch({ database: jsonResponse(69_000_000) });

		const usage = await getSupabasePlatformUsage('production', NOW, fetchImpl);

		expect(metricById(usage, 'sbDatabase')?.meter.used).toBe(69_000_000);
		expect(metricById(usage, 'sbDisk')).toBeUndefined();
	});

	it('is unavailable only when both reads fail', async () => {
		const usage = await getSupabasePlatformUsage('production', NOW, providerFetch({}));

		expect(usage).toEqual({ kind: 'unavailable' });
	});

	it('rejects a non-numeric RPC body', async () => {
		const fetchImpl = providerFetch({
			database: jsonResponse({ size: 1 }),
			disk: jsonResponse({ metrics: { fs_used_bytes: 1 } }),
		});

		const usage = await getSupabasePlatformUsage('production', NOW, fetchImpl);

		expect(metricById(usage, 'sbDatabase')?.meter.used).toBeNull();
	});

	it('keeps the service role key out of the report', async () => {
		const fetchImpl = providerFetch({
			database: jsonResponse(69_000_000),
			disk: jsonResponse({ metrics: { fs_used_bytes: 1 } }),
		});

		const usage = await getSupabasePlatformUsage('production', NOW, fetchImpl);

		const payload = JSON.stringify(usage);
		expect(payload).not.toContain(SERVICE_KEY);
		expect(payload).not.toContain('secret-pat-value');
	});
});
