/**
 * Account-wide Cloudflare usage for the super-admin memories console, read from
 * the GraphQL Analytics API with a read-only token. Never throws to callers and
 * never forwards Cloudflare's response body: failures collapse to `unavailable`.
 */

import type { MemoriesPlatformMeter, MemoriesPlatformUsage } from '@/lib/memories/contract/catalog';
import { CLOUDFLARE_FREE_TIER } from '@/lib/memories/contract/limits';
import { getEnv } from '@/lib/server/env';
import { MEMORIES_ENV } from './config';

const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const REQUEST_TIMEOUT_MS = 5_000;
/** Analytics lag by minutes; caching also keeps the console under the API rate limit. */
const CACHE_TTL_MS = 5 * 60 * 1000;
const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/i;
const BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/** Free R2 operations; every other action type counts as Class A unless listed as Class B. */
const R2_FREE_ACTIONS = new Set(['DeleteObject', 'DeleteBucket', 'AbortMultipartUpload']);
const R2_CLASS_B_ACTIONS = new Set([
	'HeadBucket',
	'HeadObject',
	'GetObject',
	'UsageSummary',
	'GetBucketEncryption',
	'GetBucketLocation',
	'GetBucketCors',
	'GetBucketLifecycleConfiguration',
]);

type MetricName = 'storage' | 'operations' | 'workers' | 'durableObjects';

/**
 * One request per dataset: a dataset the account cannot query only blanks its
 * own meter. Variables not used by a query are simply ignored by the API.
 */
const METRIC_QUERIES: Record<MetricName, string> = {
	storage: `query MemoriesR2Storage($accountTag: string!, $bucketName: string!, $storageSince: Time!, $now: Time!) {
	viewer { accounts(filter: { accountTag: $accountTag }) {
		rows: r2StorageAdaptiveGroups(limit: 1, filter: { datetime_geq: $storageSince, datetime_leq: $now, bucketName: $bucketName }, orderBy: [datetime_DESC]) {
			max { payloadSize metadataSize }
		}
	} }
}`,
	operations: `query MemoriesR2Operations($accountTag: string!, $monthStart: Time!, $now: Time!) {
	viewer { accounts(filter: { accountTag: $accountTag }) {
		rows: r2OperationsAdaptiveGroups(limit: 1000, filter: { datetime_geq: $monthStart, datetime_leq: $now }) {
			sum { requests }
			dimensions { actionType }
		}
	} }
}`,
	workers: `query MemoriesWorkersRequests($accountTag: string!, $dayStart: Time!, $now: Time!) {
	viewer { accounts(filter: { accountTag: $accountTag }) {
		rows: workersInvocationsAdaptive(limit: 1, filter: { datetime_geq: $dayStart, datetime_leq: $now }) {
			sum { requests }
		}
	} }
}`,
	durableObjects: `query MemoriesDurableObjectsRequests($accountTag: string!, $dayStart: Time!, $now: Time!) {
	viewer { accounts(filter: { accountTag: $accountTag }) {
		rows: durableObjectsInvocationsAdaptiveGroups(limit: 1, filter: { datetime_geq: $dayStart, datetime_leq: $now }) {
			sum { requests }
		}
	} }
}`,
};

type UsageConfig = { accountId: string; token: string; bucketName: string };

let cache: { key: string; expiresAt: number; value: MemoriesPlatformUsage } | null = null;

export function resetCloudflareUsageCache(): void {
	cache = null;
}

function readConfig(): UsageConfig | null {
	const accountId = getEnv(MEMORIES_ENV.analyticsAccountId).trim();
	const token = getEnv(MEMORIES_ENV.analyticsToken).trim();
	const bucketName = getEnv(MEMORIES_ENV.r2BucketName).trim();
	if (!ACCOUNT_ID_PATTERN.test(accountId) || !token || !BUCKET_NAME_PATTERN.test(bucketName)) {
		return null;
	}
	return { accountId, token, bucketName };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRows(value: unknown): Record<string, unknown>[] | null {
	return Array.isArray(value) ? value.filter(isRecord) : null;
}

function finiteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function sumRequests(rows: Record<string, unknown>[] | null): number | null {
	if (!rows) return null;
	let total = 0;
	for (const row of rows) {
		const requests = finiteNumber(isRecord(row.sum) ? row.sum.requests : undefined);
		if (requests === null) return null;
		total += requests;
	}
	return total;
}

function storageBytes(rows: Record<string, unknown>[] | null): number | null {
	if (!rows) return null;
	if (rows.length === 0) return 0;
	const max = isRecord(rows[0].max) ? rows[0].max : null;
	const payload = finiteNumber(max?.payloadSize);
	const metadata = finiteNumber(max?.metadataSize) ?? 0;
	return payload === null ? null : payload + metadata;
}

export function classifyR2Operations(rows: Record<string, unknown>[] | null): {
	classA: number | null;
	classB: number | null;
} {
	if (!rows) return { classA: null, classB: null };
	let classA = 0;
	let classB = 0;
	for (const row of rows) {
		const actionType = isRecord(row.dimensions) ? row.dimensions.actionType : undefined;
		const requests = finiteNumber(isRecord(row.sum) ? row.sum.requests : undefined);
		if (typeof actionType !== 'string' || requests === null)
			return { classA: null, classB: null };
		if (R2_FREE_ACTIONS.has(actionType)) continue;
		if (R2_CLASS_B_ACTIONS.has(actionType)) classB += requests;
		else classA += requests;
	}
	return { classA, classB };
}

function meter(used: number | null, limit: number): MemoriesPlatformMeter {
	return { used, limit };
}

function windowBounds(now: Date) {
	const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	const storageSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	return {
		now: now.toISOString(),
		dayStart: dayStart.toISOString(),
		monthStart: monthStart.toISOString(),
		storageSince: storageSince.toISOString(),
	};
}

async function queryMetric(
	name: MetricName,
	config: UsageConfig,
	now: Date,
	fetchImpl: typeof fetch,
): Promise<Record<string, unknown>[] | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const bounds = windowBounds(now);
		const variables: Record<string, string> = { accountTag: config.accountId, now: bounds.now };
		if (name === 'storage') {
			variables.bucketName = config.bucketName;
			variables.storageSince = bounds.storageSince;
		} else if (name === 'operations') {
			variables.monthStart = bounds.monthStart;
		} else {
			variables.dayStart = bounds.dayStart;
		}
		const response = await fetchImpl(GRAPHQL_ENDPOINT, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ query: METRIC_QUERIES[name], variables }),
			signal: controller.signal,
		});
		if (!response.ok) return null;
		const payload: unknown = await response.json();
		const viewer = isRecord(payload) && isRecord(payload.data) ? payload.data.viewer : null;
		const account = isRecord(viewer) ? asRows(viewer.accounts)?.[0] : undefined;
		return account ? asRows(account.rows) : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

async function queryCloudflare(
	config: UsageConfig,
	now: Date,
	fetchImpl: typeof fetch,
): Promise<MemoriesPlatformUsage> {
	const [storage, operationRows, workers, durableObjects] = await Promise.all(
		(['storage', 'operations', 'workers', 'durableObjects'] as const).map((name) =>
			queryMetric(name, config, now, fetchImpl),
		),
	);
	const operations = classifyR2Operations(operationRows);
	const usage = {
		r2StorageBytes: meter(storageBytes(storage), CLOUDFLARE_FREE_TIER.r2StorageBytes),
		r2ClassAOperations: meter(
			operations.classA,
			CLOUDFLARE_FREE_TIER.r2ClassAOperationsPerMonth,
		),
		r2ClassBOperations: meter(
			operations.classB,
			CLOUDFLARE_FREE_TIER.r2ClassBOperationsPerMonth,
		),
		workersRequests: meter(sumRequests(workers), CLOUDFLARE_FREE_TIER.workersRequestsPerDay),
		durableObjectsRequests: meter(
			sumRequests(durableObjects),
			CLOUDFLARE_FREE_TIER.durableObjectsRequestsPerDay,
		),
	};
	if (Object.values(usage).every((entry) => entry.used === null)) return { kind: 'unavailable' };
	return { kind: 'ok', fetchedAt: now.toISOString(), ...usage };
}

export async function getCloudflarePlatformUsage(
	now = new Date(),
	fetchImpl: typeof fetch = fetch,
): Promise<MemoriesPlatformUsage> {
	const config = readConfig();
	if (!config) return { kind: 'unconfigured' };
	const key = `${config.accountId}:${config.bucketName}`;
	if (cache && cache.key === key && cache.expiresAt > now.getTime()) return cache.value;
	const value = await queryCloudflare(config, now, fetchImpl);
	// Failures are not cached, so the next refresh retries immediately.
	if (value.kind === 'ok') cache = { key, expiresAt: now.getTime() + CACHE_TTL_MS, value };
	return value;
}
