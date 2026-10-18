/**
 * Account-wide Cloudflare usage for the super-admin platform console, read
 * from the GraphQL Analytics API with a read-only token. Never throws to
 * callers and never forwards Cloudflare's response body: failures collapse to
 * `unavailable`. Quotas are account-wide; each deployment attributes the bucket
 * it declares in `MEMORIES_R2_BUCKET_NAME` to its own environment.
 */

import { CLOUDFLARE_PAID_PLAN, R2_OVERAGE_PRICES_USD } from '@/lib/platform/contract/limits';
import { buildPlatformMetric } from '@/lib/platform/contract/meters';
import type {
	PlatformEnvironmentId,
	PlatformMetric,
	PlatformMissingVar,
} from '@/lib/platform/contract/types';
import { firstViewerNode, queryCloudflareGraphql } from './cloudflare-graphql';
import { PLATFORM_ENV } from './config';
import { isLocalPanel, readProfileVar, resolvePanelEnvironments } from './env-profiles';
import { asRows, finiteNumber, isRecord } from './provider-request';

/** Analytics lag by minutes; caching also keeps the console under the API rate limit. */
const CACHE_TTL_MS = 5 * 60 * 1000;
export const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/i;
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

export interface CloudflareUsageSnapshot {
	kind: 'ok' | 'unconfigured' | 'unavailable';
	fetchedAt: string | null;
	/** Configuration gaps (names only) for the environment cards and the shared card. */
	missing: PlatformMissingVar[];
	/** Ready-made metrics: one storage line per panel environment plus account totals. */
	metrics: PlatformMetric[];
}

type MetricName = 'storage' | 'operations' | 'workers' | 'durableObjects';

/**
 * One request per dataset: a dataset the account cannot query only blanks its
 * own meter. Variables not used by a query are simply ignored by the API.
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
	operations: `query MemoriesR2Operations($accountTag: string!, $monthStart: Time!, $now: Time!) {
	viewer { accounts(filter: { accountTag: $accountTag }) {
		rows: r2OperationsAdaptiveGroups(limit: 1000, filter: { datetime_geq: $monthStart, datetime_leq: $now }) {
			sum { requests }
			dimensions { actionType }
		}
	} }
}`,
	workers: `query MemoriesWorkersRequests($accountTag: string!, $monthStart: Time!, $now: Time!) {
	viewer { accounts(filter: { accountTag: $accountTag }) {
		rows: workersInvocationsAdaptive(limit: 1, filter: { datetime_geq: $monthStart, datetime_leq: $now }) {
			sum { requests }
		}
	} }
}`,
	durableObjects: `query MemoriesDurableObjectsRequests($accountTag: string!, $monthStart: Time!, $now: Time!) {
	viewer { accounts(filter: { accountTag: $accountTag }) {
		rows: durableObjectsInvocationsAdaptiveGroups(limit: 1, filter: { datetime_geq: $monthStart, datetime_leq: $now }) {
			sum { requests }
		}
	} }
}`,
};

type UsageConfig = {
	accountId: string;
	token: string;
	/** Declared bucket per panel environment (null when unset or on Local). */
	buckets: Record<PlatformEnvironmentId, string | null>;
	missing: PlatformMissingVar[];
};

let cache: { key: string; expiresAt: number; value: CloudflareUsageSnapshot } | null = null;

export function resetCloudflareUsageCache(): void {
	cache = null;
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

function readConfig(): { config: UsageConfig | null; missing: PlatformMissingVar[] } {
	const account = readProfileVar(PLATFORM_ENV.cloudflareAccountId, 'account', (value) =>
		ACCOUNT_ID_PATTERN.test(value),
	);
	const token = readProfileVar(PLATFORM_ENV.cloudflareAnalyticsToken, 'account');
	const missing = [account.missing, token.missing].filter(
		(entry): entry is PlatformMissingVar => entry !== null,
	);
	const buckets: Record<PlatformEnvironmentId, string | null> = {
		preview: null,
		production: null,
	};
	// Local's plain bucket is the Local bucket, which belongs to neither panel
	// environment: only a deployment attributes its declared bucket.
	if (!isLocalPanel()) {
		for (const environment of resolvePanelEnvironments()) {
			const bucket = readProfileVar(PLATFORM_ENV.r2BucketName, environment, (value) =>
				BUCKET_NAME_PATTERN.test(value),
			);
			buckets[environment] = bucket.value;
			if (bucket.missing) missing.push(bucket.missing);
		}
	}
	if (!account.value || !token.value) return { config: null, missing };
	return {
		config: { accountId: account.value, token: token.value, buckets, missing },
		missing,
	};
}

export function windowBounds(now: Date) {
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
	const bounds = windowBounds(now);
	const variables: Record<string, string> = { accountTag: config.accountId, now: bounds.now };
	if (name === 'storage') variables.storageSince = bounds.storageSince;
	else variables.monthStart = bounds.monthStart;
	const result = await queryCloudflareGraphql(
		METRIC_QUERIES[name],
		variables,
		config.token,
		fetchImpl,
	);
	const account = result.ok ? firstViewerNode(result.viewer, 'accounts') : null;
	return account ? asRows(account.rows) : null;
}

function overageUsd(excess: number, unitPrice: number): number {
	return Math.round(excess * unitPrice * 100) / 100;
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

/** Bytes per bucket from the bucket-grouped query; malformed rows blank the meters. */
export function storageBytesByBucket(
	rows: Record<string, unknown>[] | null,
): Map<string, number> | null {
	if (!rows) return null;
	const byBucket = new Map<string, number>();
	for (const row of rows) {
		const dimensions = isRecord(row.dimensions) ? row.dimensions : null;
		const bucketName = dimensions?.bucketName;
		if (typeof bucketName !== 'string') return null;
		const max = isRecord(row.max) ? row.max : null;
		const payload = finiteNumber(max?.payloadSize);
		if (payload === null) return null;
		const metadata = finiteNumber(max?.metadataSize) ?? 0;
		const bytes = payload + metadata;
		byBucket.set(bucketName, Math.max(byBucket.get(bucketName) ?? 0, bytes));
	}
	return byBucket;
}

function storageMetrics(
	byBucket: Map<string, number> | null,
	bucketName: string | null,
	environment: PlatformEnvironmentId,
	now: Date,
): PlatformMetric {
	const limit = CLOUDFLARE_PAID_PLAN.r2StorageBytes;
	const used = byBucket && bucketName ? (byBucket.get(bucketName) ?? 0) : null;
	return buildPlatformMetric({
		id: 'cfR2StorageBucket',
		resource: bucketName ?? undefined,
		used,
		limit,
		window: 'snapshot',
		scope: environment,
		now,
	});
}

function accountMetrics(
	storageTotal: number | null,
	operationRows: Record<string, unknown>[] | null,
	workers: Record<string, unknown>[] | null,
	durableObjects: Record<string, unknown>[] | null,
	now: Date,
): PlatformMetric[] {
	const limit = CLOUDFLARE_PAID_PLAN.r2StorageBytes;
	const operations = classifyR2Operations(operationRows);
	return [
		buildPlatformMetric({
			id: 'cfR2StorageAccount',
			used: storageTotal,
			limit,
			window: 'snapshot',
			scope: 'account',
			now,
			overageUsd:
				storageTotal !== null && storageTotal > limit
					? overageUsd(
							(storageTotal - limit) / DECIMAL_GB,
							R2_OVERAGE_PRICES_USD.storagePerGbMonth,
						)
					: null,
		}),
		buildPlatformMetric({
			id: 'cfR2ClassA',
			used: operations.classA,
			limit: CLOUDFLARE_PAID_PLAN.r2ClassAOperationsPerMonth,
			window: 'monthUtc',
			scope: 'account',
			now,
			overageUsd:
				operations.classA !== null &&
				operations.classA > CLOUDFLARE_PAID_PLAN.r2ClassAOperationsPerMonth
					? overageUsd(
							(operations.classA - CLOUDFLARE_PAID_PLAN.r2ClassAOperationsPerMonth) /
								DECIMAL_MILLION,
							R2_OVERAGE_PRICES_USD.classAOperationsPerMillion,
						)
					: null,
		}),
		buildPlatformMetric({
			id: 'cfR2ClassB',
			used: operations.classB,
			limit: CLOUDFLARE_PAID_PLAN.r2ClassBOperationsPerMonth,
			window: 'monthUtc',
			scope: 'account',
			now,
			overageUsd:
				operations.classB !== null &&
				operations.classB > CLOUDFLARE_PAID_PLAN.r2ClassBOperationsPerMonth
					? overageUsd(
							(operations.classB - CLOUDFLARE_PAID_PLAN.r2ClassBOperationsPerMonth) /
								DECIMAL_MILLION,
							R2_OVERAGE_PRICES_USD.classBOperationsPerMillion,
						)
					: null,
		}),
		buildPlatformMetric({
			id: 'cfWorkersRequests',
			used: sumRequests(workers),
			limit: CLOUDFLARE_PAID_PLAN.workersRequestsPerMonth,
			window: 'monthUtc',
			scope: 'account',
			now,
		}),
		buildPlatformMetric({
			id: 'cfDurableObjectsRequests',
			used: sumRequests(durableObjects),
			limit: CLOUDFLARE_PAID_PLAN.durableObjectsRequestsPerMonth,
			window: 'monthUtc',
			scope: 'account',
			now,
		}),
	];
}

async function queryCloudflare(
	config: UsageConfig,
	now: Date,
	fetchImpl: typeof fetch,
): Promise<CloudflareUsageSnapshot> {
	const [storageRows, operationRows, workers, durableObjects] = await Promise.all(
		(['storage', 'operations', 'workers', 'durableObjects'] as const).map((name) =>
			queryMetric(name, config, now, fetchImpl),
		),
	);
	const byBucket = storageBytesByBucket(storageRows);
	const storageTotal = byBucket
		? Array.from(byBucket.values()).reduce((sum, bytes) => sum + bytes, 0)
		: null;
	const bucketEnvironments = isLocalPanel() ? [] : resolvePanelEnvironments();
	const metrics = [
		...bucketEnvironments.map((environment) =>
			storageMetrics(byBucket, config.buckets[environment], environment, now),
		),
		...accountMetrics(storageTotal, operationRows, workers, durableObjects, now),
	];
	if (metrics.every((metric) => metric.meter.used === null)) {
		return { kind: 'unavailable', fetchedAt: null, missing: config.missing, metrics: [] };
	}
	return { kind: 'ok', fetchedAt: now.toISOString(), missing: config.missing, metrics };
}

export async function getCloudflarePlatformUsage(
	now = new Date(),
	fetchImpl: typeof fetch = fetch,
): Promise<CloudflareUsageSnapshot> {
	const { config, missing } = readConfig();
	if (!config) {
		return { kind: 'unconfigured', fetchedAt: null, missing, metrics: [] };
	}
	const key = `${config.accountId}:${Object.entries(config.buckets).join(',')}`;
	if (cache && cache.key === key && cache.expiresAt > now.getTime()) return cache.value;
	const value = await queryCloudflare(config, now, fetchImpl);
	// Failures are not cached, so the next refresh retries immediately.
	if (value.kind === 'ok') cache = { key, expiresAt: now.getTime() + CACHE_TTL_MS, value };
	return value;
}
