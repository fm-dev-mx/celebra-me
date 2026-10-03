/**
 * Account-wide Cloudflare usage for the super-admin platform console, read
 * from the GraphQL Analytics API with a read-only token. Never throws to
 * callers and never forwards Cloudflare's response body: failures collapse to
 * `unavailable`. Quotas are account-wide; per-bucket storage is attributed to
 * the panel environments through explicit values or the repository's bucket
 * naming convention.
 */

import {
	matchR2BucketForEnvironment,
	classifyR2BucketEnvironment,
} from '@/lib/platform/contract/environments';
import { CLOUDFLARE_FREE_TIER, R2_OVERAGE_PRICES_USD } from '@/lib/platform/contract/limits';
import { buildPlatformMetric } from '@/lib/platform/contract/meters';
import type {
	PlatformEnvironmentId,
	PlatformMetric,
	PlatformMissingVar,
} from '@/lib/platform/contract/types';
import { PLATFORM_ENV } from './config';
import { readProfileVar, readSharedVar, resolvePanelEnvironments } from './env-profiles';

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

export interface CloudflareUsageSnapshot {
	kind: 'ok' | 'unconfigured' | 'unavailable';
	fetchedAt: string | null;
	/** Configuration gaps (names only) for the environment cards and the shared card. */
	missing: PlatformMissingVar[];
	/** Ready-made metrics: one storage line per panel environment plus account totals. */
	metrics: PlatformMetric[];
}

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

type UsageConfig = {
	accountId: string;
	/** Name of the variable the query token came from, for cache identity only. */
	tokenName: string;
	token: string;
	/** Resolved bucket per panel environment (null when unresolved). */
	buckets: Record<PlatformEnvironmentId, string | null>;
	bucketMissing: Record<PlatformEnvironmentId, PlatformMissingVar | null>;
	missing: PlatformMissingVar[];
};

let cache: { key: string; expiresAt: number; value: CloudflareUsageSnapshot } | null = null;

export function resetCloudflareUsageCache(): void {
	cache = null;
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

function readConfig(): { config: UsageConfig | null; missing: PlatformMissingVar[] } {
	const environments = resolvePanelEnvironments();
	const account = readSharedVar(PLATFORM_ENV.cloudflareAccountId, 'account', (value) =>
		ACCOUNT_ID_PATTERN.test(value),
	);
	const missing: PlatformMissingVar[] = account.missing ? [account.missing] : [];
	const tokens = environments.map((environment) =>
		readProfileVar('cloudflareAnalyticsToken', environment),
	);
	for (const token of tokens) if (token.missing) missing.push(token.missing);
	const queryToken = tokens.find((token) => token.value) ?? null;
	const buckets: Record<PlatformEnvironmentId, string | null> = {
		preview: null,
		production: null,
	};
	const bucketMissing: Record<PlatformEnvironmentId, PlatformMissingVar | null> = {
		preview: null,
		production: null,
	};
	for (const environment of environments) {
		const bucket = readProfileVar('r2BucketName', environment, {
			validate: (value) => BUCKET_NAME_PATTERN.test(value),
			allowPlainFallback: false,
		});
		buckets[environment] = bucket.value;
		bucketMissing[environment] = bucket.missing;
	}
	if (!account.value || !queryToken?.value) return { config: null, missing };
	return {
		config: {
			accountId: account.value,
			tokenName: queryToken.name,
			token: queryToken.value,
			buckets,
			bucketMissing,
			missing,
		},
		missing,
	};
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
	bucketName: string | null,
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
			variables.bucketName = bucketName ?? '';
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

/** Bytes per bucket from the dimensioned query; null rows stay null. */
export function storageBytesByBucket(
	rows: Record<string, unknown>[] | null,
	fallbackBucket: string,
): Map<string, number> | null {
	if (!rows) return null;
	const byBucket = new Map<string, number>();
	for (const row of rows) {
		const dimensions = isRecord(row.dimensions) ? row.dimensions : null;
		const bucketName =
			typeof dimensions?.bucketName === 'string' ? dimensions.bucketName : fallbackBucket;
		const max = isRecord(row.max) ? row.max : null;
		const payload = finiteNumber(max?.payloadSize);
		if (payload === null) return null;
		const metadata = finiteNumber(max?.metadataSize) ?? 0;
		const bytes = payload + metadata;
		byBucket.set(bucketName, Math.max(byBucket.get(bucketName) ?? 0, bytes));
	}
	return byBucket;
}

function isLocalBucket(bucketName: string): boolean {
	return classifyR2BucketEnvironment(bucketName) === 'local';
}

function storageMetrics(
	byBucket: Map<string, number> | null,
	bucketName: string | null,
	environment: PlatformEnvironmentId,
	now: Date,
): PlatformMetric {
	const limit = CLOUDFLARE_FREE_TIER.r2StorageBytes;
	const used =
		byBucket && bucketName && !isLocalBucket(bucketName)
			? (byBucket.get(bucketName) ?? 0)
			: null;
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
	const limit = CLOUDFLARE_FREE_TIER.r2StorageBytes;
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
}

/**
 * When Local has no explicit bucket value, attribute an observed bucket to the
 * environment through the repository naming convention; the gap disappears if
 * exactly one bucket matches.
 */
function resolveConventionBuckets(
	config: UsageConfig,
	byBucket: Map<string, number> | null,
): { buckets: Record<PlatformEnvironmentId, string | null>; missing: PlatformMissingVar[] } {
	const buckets = { ...config.buckets };
	const bucketMissing = { ...config.bucketMissing };
	if (byBucket) {
		const observed = Array.from(byBucket.keys());
		for (const environment of resolvePanelEnvironments()) {
			if (buckets[environment]) continue;
			const match = matchR2BucketForEnvironment(observed, environment);
			if (match) {
				buckets[environment] = match;
				bucketMissing[environment] = null;
			}
		}
	}
	const missing = [
		...config.missing,
		...resolvePanelEnvironments()
			.map((environment) => bucketMissing[environment])
			.filter((entry): entry is PlatformMissingVar => entry !== null),
	];
	return { buckets, missing };
}

async function queryCloudflare(
	config: UsageConfig,
	now: Date,
	fetchImpl: typeof fetch,
): Promise<CloudflareUsageSnapshot> {
	const storageRows = await queryMetric('storage', config, null, now, fetchImpl);
	let byBucket = storageBytesByBucket(storageRows, '');
	if (!byBucket) {
		// The bucket dimension may be rejected (not verified live): fall back to
		// one single-bucket query per resolved bucket and keep the meters alive.
		const fallbacks = await Promise.all(
			Object.values(config.buckets)
				.filter((bucketName): bucketName is string => Boolean(bucketName))
				.map(async (bucketName) => {
					const rows = await queryMetric(
						'storageFallback',
						config,
						bucketName,
						now,
						fetchImpl,
					);
					return storageBytesByBucket(rows, bucketName);
				}),
		);
		const merged = new Map<string, number>();
		for (const entry of fallbacks) {
			if (entry) for (const [name, bytes] of entry) merged.set(name, bytes);
		}
		byBucket = merged.size > 0 ? merged : null;
	}
	const resolved = resolveConventionBuckets(config, byBucket);
	const [operationRows, workers, durableObjects] = await Promise.all(
		(['operations', 'workers', 'durableObjects'] as const).map((name) =>
			queryMetric(name, config, null, now, fetchImpl),
		),
	);
	// Only bucket-grouped rows account for every bucket at once; the
	// single-bucket fallback must not pretend its sum is the account total.
	const dimensioned = (storageRows ?? []).some(
		(row) => isRecord(row.dimensions) && typeof row.dimensions.bucketName === 'string',
	);
	const storageTotal =
		dimensioned && byBucket
			? Array.from(byBucket.values()).reduce((sum, bytes) => sum + bytes, 0)
			: null;
	const metrics = [
		...resolvePanelEnvironments().map((environment) =>
			storageMetrics(byBucket, resolved.buckets[environment], environment, now),
		),
		...accountMetrics(storageTotal, operationRows, workers, durableObjects, now),
	];
	if (metrics.every((metric) => metric.meter.used === null)) {
		return { kind: 'unavailable', fetchedAt: null, missing: resolved.missing, metrics: [] };
	}
	return { kind: 'ok', fetchedAt: now.toISOString(), missing: resolved.missing, metrics };
}

export async function getCloudflarePlatformUsage(
	now = new Date(),
	fetchImpl: typeof fetch = fetch,
): Promise<CloudflareUsageSnapshot> {
	const { config, missing } = readConfig();
	if (!config) {
		return { kind: 'unconfigured', fetchedAt: null, missing, metrics: [] };
	}
	const key = `${config.accountId}:${config.tokenName}:${Object.entries(config.buckets).join(',')}`;
	if (cache && cache.key === key && cache.expiresAt > now.getTime()) return cache.value;
	const value = await queryCloudflare(config, now, fetchImpl);
	// Failures are not cached, so the next refresh retries immediately.
	if (value.kind === 'ok') cache = { key, expiresAt: now.getTime() + CACHE_TTL_MS, value };
	return value;
}
