/**
 * Account-wide Cloudflare usage for the super-admin platform console, read
 * from the GraphQL Analytics API with a read-only token. Never throws to
 * callers and never forwards Cloudflare's response body: failures collapse to
 * `unavailable`. Quotas are account-wide; per-bucket storage is only a
 * breakdown of the same account allowance.
 */

import { CLOUDFLARE_FREE_TIER, R2_OVERAGE_PRICES_USD } from '@/lib/platform/contract/limits';
import { buildPlatformMetric } from '@/lib/platform/contract/meters';
import type {
	PlatformMetric,
	PlatformProviderUsage,
	PlatformScope,
} from '@/lib/platform/contract/types';
import { getEnv } from '@/lib/server/env';
import { PLATFORM_ENV } from './config';

const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const REQUEST_TIMEOUT_MS = 5_000;
/** Analytics lag by minutes; caching also keeps the console under the API rate limit. */
const CACHE_TTL_MS = 5 * 60 * 1000;
const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/i;
const BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const DECIMAL_GB = 1_000_000_000;
const DECIMAL_MILLION = 1_000_000;

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

type MetricName = 'storage' | 'storageFallback' | 'operations' | 'workers' | 'durableObjects';

/**
 * One request per dataset: a dataset the account cannot query only blanks its
 * own meter. Variables not used by a query are simply ignored by the API.
 * `storageFallback` keeps the historical single-bucket query alive in case the
 * bucket-name dimension is ever rejected (not verified against the live API).
 */
const METRIC_QUERIES: Record<MetricName, string> = {
	storage: `query MemoriesR2StorageByBucket($accountTag: string!, $storageSince: Time!, $now: Time!) {
	viewer { accounts(filter: { accountTag: $accountTag }) {
		rows: r2StorageAdaptiveGroups(limit: 1000, filter: { datetime_geq: $storageSince, datetime_leq: $now }) {
			dimensions { bucketName }
			max { payloadSize metadataSize }
		}
	} }
}`,
	storageFallback: `query MemoriesR2Storage($accountTag: string!, $bucketName: string!, $storageSince: Time!, $now: Time!) {
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

let cache: { key: string; expiresAt: number; value: PlatformProviderUsage } | null = null;

export function resetCloudflareUsageCache(): void {
	cache = null;
}

function readConfig(): UsageConfig | null {
	const accountId = getEnv(PLATFORM_ENV.cloudflareAccountId).trim();
	const token = getEnv(PLATFORM_ENV.cloudflareAnalyticsToken).trim();
	const bucketName = getEnv(PLATFORM_ENV.r2BucketName).trim();
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

function storageBytesByBucket(
	rows: Record<string, unknown>[] | null,
	fallbackBucket: string,
): { byBucket: Map<string, number>; dimensioned: boolean } | null {
	if (!rows) return null;
	const byBucket = new Map<string, number>();
	let dimensioned = false;
	for (const row of rows) {
		const dimensions = isRecord(row.dimensions) ? row.dimensions : null;
		const bucketName =
			typeof dimensions?.bucketName === 'string' ? dimensions.bucketName : fallbackBucket;
		if (typeof dimensions?.bucketName === 'string') dimensioned = true;
		const max = isRecord(row.max) ? row.max : null;
		const payload = finiteNumber(max?.payloadSize);
		if (payload === null) return null;
		const metadata = finiteNumber(max?.metadataSize) ?? 0;
		const bytes = payload + metadata;
		byBucket.set(bucketName, Math.max(byBucket.get(bucketName) ?? 0, bytes));
	}
	return { byBucket, dimensioned };
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

/**
 * The bucket this deployment writes to belongs to the environment the panel
 * runs in (Local development reports no environment and stays account-scoped).
 */
function currentEnvironmentScope(): PlatformScope | null {
	const vercelEnv = getEnv(PLATFORM_ENV.vercelEnv).trim();
	if (vercelEnv === 'production') return 'production';
	if (vercelEnv === 'preview') return 'preview';
	return null;
}

/** Local development bucket (wrangler env naming: `-local`); excluded from the panel. */
function isLocalBucket(bucketName: string): boolean {
	return /-local$/i.test(bucketName);
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
			variables.storageSince = bounds.storageSince;
		} else if (name === 'storageFallback') {
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

function overageUsd(excess: number, unitPrice: number): number {
	return Math.round(excess * unitPrice * 100) / 100;
}

function storageMetrics(
	parsed: { byBucket: Map<string, number>; dimensioned: boolean } | null,
	config: UsageConfig,
	now: Date,
): PlatformMetric[] {
	const limit = CLOUDFLARE_FREE_TIER.r2StorageBytes;
	if (!parsed) {
		return [
			buildPlatformMetric({
				id: 'cfR2StorageAccount',
				used: null,
				limit,
				window: 'snapshot',
				scope: 'account',
				now,
			}),
		];
	}
	const metrics: PlatformMetric[] = [];
	const environment = currentEnvironmentScope();
	let total = 0;
	for (const [bucketName, bytes] of parsed.byBucket) {
		total += bytes;
		if (isLocalBucket(bucketName)) continue;
		metrics.push(
			buildPlatformMetric({
				id: 'cfR2StorageBucket',
				resource: bucketName,
				used: bytes,
				limit,
				window: 'snapshot',
				scope: bucketName === config.bucketName ? (environment ?? 'account') : 'account',
				now,
			}),
		);
	}
	// Only bucket-grouped rows can account for every bucket at once; the
	// single-bucket fallback must not pretend its figure is the account total.
	if (parsed.dimensioned) {
		metrics.push(
			buildPlatformMetric({
				id: 'cfR2StorageAccount',
				used: total,
				limit,
				window: 'snapshot',
				scope: 'account',
				now,
				overageUsd:
					total > limit
						? overageUsd(
								(total - limit) / DECIMAL_GB,
								R2_OVERAGE_PRICES_USD.storagePerGbMonth,
							)
						: null,
			}),
		);
	}
	return metrics;
}

async function queryCloudflare(
	config: UsageConfig,
	now: Date,
	fetchImpl: typeof fetch,
): Promise<PlatformProviderUsage> {
	const [storageInitial, operationRows, workers, durableObjects] = await Promise.all([
		queryMetric('storage', config, now, fetchImpl),
		queryMetric('operations', config, now, fetchImpl),
		queryMetric('workers', config, now, fetchImpl),
		queryMetric('durableObjects', config, now, fetchImpl),
	]);
	const storage =
		storageInitial ?? (await queryMetric('storageFallback', config, now, fetchImpl));
	const operations = classifyR2Operations(operationRows);
	const metrics = [
		...storageMetrics(storageBytesByBucket(storage, config.bucketName), config, now),
		buildPlatformMetric({
			id: 'cfR2ClassA',
			used: operations.classA,
			limit: CLOUDFLARE_FREE_TIER.r2ClassAOperationsPerMonth,
			window: 'monthUtc',
			scope: 'account',
			now,
			overageUsd:
				operations.classA !== null &&
				operations.classA > CLOUDFLARE_FREE_TIER.r2ClassAOperationsPerMonth
					? overageUsd(
							(operations.classA - CLOUDFLARE_FREE_TIER.r2ClassAOperationsPerMonth) /
								DECIMAL_MILLION,
							R2_OVERAGE_PRICES_USD.classAOperationsPerMillion,
						)
					: null,
		}),
		buildPlatformMetric({
			id: 'cfR2ClassB',
			used: operations.classB,
			limit: CLOUDFLARE_FREE_TIER.r2ClassBOperationsPerMonth,
			window: 'monthUtc',
			scope: 'account',
			now,
			overageUsd:
				operations.classB !== null &&
				operations.classB > CLOUDFLARE_FREE_TIER.r2ClassBOperationsPerMonth
					? overageUsd(
							(operations.classB - CLOUDFLARE_FREE_TIER.r2ClassBOperationsPerMonth) /
								DECIMAL_MILLION,
							R2_OVERAGE_PRICES_USD.classBOperationsPerMillion,
						)
					: null,
		}),
		buildPlatformMetric({
			id: 'cfWorkersRequests',
			used: sumRequests(workers),
			limit: CLOUDFLARE_FREE_TIER.workersRequestsPerDay,
			window: 'dayUtc',
			scope: 'account',
			now,
		}),
		buildPlatformMetric({
			id: 'cfDurableObjectsRequests',
			used: sumRequests(durableObjects),
			limit: CLOUDFLARE_FREE_TIER.durableObjectsRequestsPerDay,
			window: 'dayUtc',
			scope: 'account',
			now,
		}),
	];
	if (metrics.every((metric) => metric.meter.used === null)) return { kind: 'unavailable' };
	return { kind: 'ok', fetchedAt: now.toISOString(), metrics, spendUsd: null };
}

export async function getCloudflarePlatformUsage(
	now = new Date(),
	fetchImpl: typeof fetch = fetch,
): Promise<PlatformProviderUsage> {
	const config = readConfig();
	if (!config) return { kind: 'unconfigured' };
	const key = `${config.accountId}:${config.bucketName}`;
	if (cache && cache.key === key && cache.expiresAt > now.getTime()) return cache.value;
	const value = await queryCloudflare(config, now, fetchImpl);
	// Failures are not cached, so the next refresh retries immediately.
	if (value.kind === 'ok') cache = { key, expiresAt: now.getTime() + CACHE_TTL_MS, value };
	return value;
}
