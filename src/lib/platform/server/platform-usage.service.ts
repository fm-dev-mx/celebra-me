/**
 * Assembles the platform usage report from the latest `platform_usage_snapshots`
 * rows that the Production collector cron writes every 15 minutes. A page load
 * never queries a provider: it reads the snapshot table with the service role
 * and maps one row per dataset onto the panel sections (the deployment's own
 * environment plus the shared account quotas). A failed or missing dataset only
 * blanks its own meters; payloads are aggregates, and configuration gaps reach
 * the browser as variable names only.
 */

import {
	CLOUDFLARE_PAID_PLAN,
	R2_OVERAGE_PRICES_USD,
	SUPABASE_FREE_TIER,
} from '@/lib/platform/contract/limits';
import { buildPlatformMetric } from '@/lib/platform/contract/meters';
import type {
	PlatformEnvironmentId,
	PlatformMetric,
	PlatformMissingVar,
	PlatformProviderCard,
	PlatformProviderUsage,
	PlatformScope,
	PlatformSection,
	PlatformUsageReport,
	PlatformWindow,
} from '@/lib/platform/contract/types';
import { readHostedDeployEnvironment } from '@/lib/server/deploy-identity';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { PlatformSnapshotProvider } from './collector/types';
import { PLATFORM_ENV } from './config';
import { readProfileVar } from './env-profiles';
import { finiteNumber, isRecord } from './provider-request';

const BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const DECIMAL_GB = 1_000_000_000;
const DECIMAL_MILLION = 1_000_000;
/** Six datasets per run: the newest few runs always hold the latest row of each. */
const LATEST_ROWS_LIMIT = 36;

export interface StoredSnapshot {
	provider: PlatformSnapshotProvider;
	ok: boolean;
	payload: Record<string, unknown>;
	collected_at: string;
}

type LatestSnapshots = Partial<Record<PlatformSnapshotProvider, StoredSnapshot>>;

/** Newest row per dataset; rows arrive newest first. */
async function readLatestPlatformSnapshots(): Promise<LatestSnapshots> {
	const rows = await supabaseRestRequest<unknown>({
		pathWithQuery: `platform_usage_snapshots?select=provider,ok,payload,collected_at&order=collected_at.desc&limit=${LATEST_ROWS_LIMIT}`,
		useServiceRole: true,
	});
	const latest: LatestSnapshots = {};
	if (!Array.isArray(rows)) return latest;
	for (const row of rows) {
		if (!isRecord(row) || typeof row.provider !== 'string') continue;
		const provider = row.provider as PlatformSnapshotProvider;
		if (latest[provider] || typeof row.collected_at !== 'string') continue;
		latest[provider] = {
			provider,
			ok: row.ok === true,
			payload: isRecord(row.payload) ? row.payload : {},
			collected_at: row.collected_at,
		};
	}
	return latest;
}

function path(payload: Record<string, unknown> | undefined, ...keys: string[]): unknown {
	let value: unknown = payload;
	for (const key of keys) value = isRecord(value) ? value[key] : undefined;
	return value;
}

function okPayload(row: StoredSnapshot | undefined): Record<string, unknown> | undefined {
	return row?.ok ? row.payload : undefined;
}

function overageUsd(excess: number, unitPrice: number): number {
	return Math.round(excess * unitPrice * 100) / 100;
}

function overage(used: number | null, limit: number, unit: number, price: number) {
	return used !== null && used > limit ? overageUsd((used - limit) / unit, price) : null;
}

/** Variable names an unconfigured dataset reported, attributed to `scope`. */
function missingOf(
	rows: (StoredSnapshot | undefined)[],
	scope: PlatformScope,
): PlatformMissingVar[] {
	const names = new Set<string>();
	for (const row of rows) {
		const missing = row && !row.ok ? row.payload.missing : undefined;
		if (!Array.isArray(missing)) continue;
		for (const name of missing) if (typeof name === 'string') names.add(name);
	}
	return [...names].map((name) => ({ name, state: 'absent', scope }));
}

function latestCollectedAt(rows: (StoredSnapshot | undefined)[]): string | null {
	return rows.reduce<string | null>(
		(latest, row) =>
			row && (!latest || row.collected_at > latest) ? row.collected_at : latest,
		null,
	);
}

/**
 * Card state from its datasets: `ok` once any dataset was collected (the
 * others blank their own meters), `unconfigured` when configuration is
 * missing, `unavailable` otherwise (provider failures or no rows yet).
 */
function cardUsage(
	rows: (StoredSnapshot | undefined)[],
	metrics: PlatformMetric[],
	missing: PlatformMissingVar[],
): PlatformProviderUsage {
	const fetchedAt = latestCollectedAt(rows.filter((row) => row?.ok));
	if (fetchedAt) return { kind: 'ok', fetchedAt, metrics, spendUsd: null, missing };
	const unconfigured = rows.every(
		(row) => row && path(row.payload, 'failure') === 'unconfigured',
	);
	return unconfigured || missing.length > 0
		? { kind: 'unconfigured', missing }
		: { kind: 'unavailable' };
}

function metricAt(
	row: StoredSnapshot | undefined,
	input: {
		id: string;
		used: unknown;
		limit: number | null;
		window: PlatformWindow;
		scope: PlatformScope;
		resource?: string;
		overageUsd?: (used: number | null) => number | null;
	},
): PlatformMetric {
	const used = row?.ok ? finiteNumber(input.used) : null;
	return buildPlatformMetric({
		id: input.id,
		resource: input.resource,
		used,
		limit: input.limit,
		window: input.window,
		scope: input.scope,
		now: new Date(row?.collected_at ?? 0),
		overageUsd: input.overageUsd?.(used) ?? null,
	});
}

/** Zone figures of the collection day (UTC), or the newest day stored. */
function zoneToday(row: StoredSnapshot | undefined): Record<string, unknown> | undefined {
	const days = path(okPayload(row), 'days');
	if (!Array.isArray(days) || days.length === 0 || !row) return undefined;
	const date = row.collected_at.slice(0, 10);
	const match = days.find((day) => isRecord(day) && day.date === date) ?? days[days.length - 1];
	return isRecord(match) ? match : undefined;
}

function bucketBytes(row: StoredSnapshot | undefined, bucketName: string | null): number | null {
	const buckets = path(okPayload(row), 'buckets');
	if (!bucketName || !Array.isArray(buckets)) return null;
	const bucket = buckets.find((entry) => isRecord(entry) && entry.bucketName === bucketName);
	return isRecord(bucket) ? (finiteNumber(bucket.storageBytes) ?? 0) : 0;
}

function cloudflareShared(latest: LatestSnapshots): PlatformProviderUsage {
	const workers = latest.cloudflare_workers;
	const durableObjects = latest.cloudflare_durable_objects;
	const r2 = latest.cloudflare_r2;
	const zone = latest.cloudflare_zone;
	const rows = [workers, durableObjects, r2, zone];
	const plan = CLOUDFLARE_PAID_PLAN;
	const today = zoneToday(zone);
	const r2Total = (key: string) => path(okPayload(r2), 'totals', key);
	const metrics = [
		metricAt(r2, {
			id: 'cfR2StorageAccount',
			used: r2Total('storageBytes'),
			limit: plan.r2StorageBytes,
			window: 'snapshot',
			scope: 'account',
			overageUsd: (used) =>
				overage(
					used,
					plan.r2StorageBytes,
					DECIMAL_GB,
					R2_OVERAGE_PRICES_USD.storagePerGbMonth,
				),
		}),
		metricAt(r2, {
			id: 'cfR2ClassA',
			used: r2Total('classA'),
			limit: plan.r2ClassAOperationsPerMonth,
			window: 'monthUtc',
			scope: 'account',
			overageUsd: (used) =>
				overage(
					used,
					plan.r2ClassAOperationsPerMonth,
					DECIMAL_MILLION,
					R2_OVERAGE_PRICES_USD.classAOperationsPerMillion,
				),
		}),
		metricAt(r2, {
			id: 'cfR2ClassB',
			used: r2Total('classB'),
			limit: plan.r2ClassBOperationsPerMonth,
			window: 'monthUtc',
			scope: 'account',
			overageUsd: (used) =>
				overage(
					used,
					plan.r2ClassBOperationsPerMonth,
					DECIMAL_MILLION,
					R2_OVERAGE_PRICES_USD.classBOperationsPerMillion,
				),
		}),
		metricAt(workers, {
			id: 'cfWorkersRequests',
			used: path(okPayload(workers), 'totals', 'month', 'requests'),
			limit: plan.workersRequestsPerMonth,
			window: 'monthUtc',
			scope: 'account',
		}),
		metricAt(workers, {
			id: 'cfWorkersCpu',
			used: path(okPayload(workers), 'totals', 'month', 'cpuTimeMs'),
			limit: plan.workersCpuMsPerMonth,
			window: 'monthUtc',
			scope: 'account',
		}),
		metricAt(durableObjects, {
			id: 'cfDurableObjectsRequests',
			used: path(okPayload(durableObjects), 'totals', 'requestsMonth'),
			limit: plan.durableObjectsRequestsPerMonth,
			window: 'monthUtc',
			scope: 'account',
		}),
		metricAt(workers, {
			id: 'cfWorkersErrors',
			used: path(okPayload(workers), 'totals', 'today', 'errors'),
			limit: null,
			window: 'dayUtc',
			scope: 'account',
		}),
		metricAt(durableObjects, {
			id: 'cfDurableObjectsObjects',
			used: path(okPayload(durableObjects), 'totals', 'objects'),
			limit: null,
			window: 'snapshot',
			scope: 'account',
		}),
		metricAt(zone, {
			id: 'cfZone404',
			used: today?.status404,
			limit: null,
			window: 'dayUtc',
			scope: 'account',
		}),
		metricAt(zone, {
			id: 'cfZone403',
			used: today?.status403,
			limit: null,
			window: 'dayUtc',
			scope: 'account',
		}),
		metricAt(zone, {
			id: 'cfZoneThreats',
			used: today?.threats,
			limit: null,
			window: 'dayUtc',
			scope: 'account',
		}),
	];
	return cardUsage(rows, metrics, missingOf(rows, 'account'));
}

function cloudflareEnvironment(
	latest: LatestSnapshots,
	environment: PlatformEnvironmentId,
): PlatformProviderUsage {
	const r2 = latest.cloudflare_r2;
	const bucket = readProfileVar(PLATFORM_ENV.r2BucketName, environment, (value) =>
		BUCKET_NAME_PATTERN.test(value),
	);
	const missing = bucket.missing ? [bucket.missing] : [];
	const metric = buildPlatformMetric({
		id: 'cfR2StorageBucket',
		resource: bucket.value ?? undefined,
		used: r2?.ok ? bucketBytes(r2, bucket.value) : null,
		limit: CLOUDFLARE_PAID_PLAN.r2StorageBytes,
		window: 'snapshot',
		scope: environment,
		now: new Date(r2?.collected_at ?? 0),
	});
	return cardUsage([r2], [metric], missing);
}

function supabaseEnvironment(
	latest: LatestSnapshots,
	environment: PlatformEnvironmentId,
): PlatformProviderUsage {
	const database = latest.supabase_database;
	const disk = latest.supabase_disk;
	const rows = [database, disk];
	const metrics = [
		metricAt(database, {
			id: 'sbDatabase',
			used: path(okPayload(database), 'usedBytes'),
			limit: SUPABASE_FREE_TIER.databaseBytes,
			window: 'snapshot',
			scope: environment,
		}),
		metricAt(disk, {
			id: 'sbDisk',
			used: path(okPayload(disk), 'usedBytes'),
			limit: null,
			window: 'snapshot',
			scope: environment,
		}),
	];
	return cardUsage(rows, metrics, missingOf(rows, environment));
}

/**
 * The snapshots describe the database this deployment reads: Production's
 * collector rows on Production, seeded rows on Preview. Local reads its own
 * database and is labeled as Production, the only environment that collects.
 */
export async function getPlatformUsageReport(
	readSnapshots: () => Promise<LatestSnapshots> = readLatestPlatformSnapshots,
): Promise<PlatformUsageReport> {
	const environment = readHostedDeployEnvironment() ?? 'production';
	let latest: LatestSnapshots = {};
	try {
		latest = await readSnapshots();
	} catch {
		// An unreadable table leaves every card `unavailable`; the page still renders.
	}
	const environmentCards: PlatformProviderCard[] = [
		{ provider: 'cloudflare', usage: cloudflareEnvironment(latest, environment) },
		{ provider: 'supabase', usage: supabaseEnvironment(latest, environment) },
	];
	const shared: PlatformSection = {
		id: 'shared',
		cards: [{ provider: 'cloudflare', usage: cloudflareShared(latest) }],
	};
	return [{ id: environment, cards: environmentCards }, shared];
}
