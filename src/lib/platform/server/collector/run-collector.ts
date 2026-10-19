/**
 * One platform usage collector run (Production cron, every 15 minutes): read
 * every provider dataset, write one snapshot row per dataset, then purge rows
 * past retention. A failing dataset becomes an `ok = false` row and never stops
 * the others; the run only fails when the snapshot table cannot be written.
 */

import { readProjectDiskUsage } from '../supabase-usage';
import {
	collectDurableObjects,
	collectR2,
	collectWorkers,
	collectZone,
} from './cloudflare-datasets';
import {
	type CloudflareCollectorConfig,
	readCloudflareCollectorConfig,
	readSupabaseCollectorConfig,
} from './collector-config';
import { insertPlatformSnapshots, purgePlatformSnapshots } from './snapshot-store';
import type { DatasetResult, PlatformSnapshotProvider, PlatformSnapshotRow } from './types';

export const PLATFORM_SNAPSHOT_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Supabase Management API scope that `config/disk/util` needs. */
const SUPABASE_DISK_PERMISSION = 'Disk Config Read';

async function collectSupabaseDisk(fetchImpl: typeof fetch): Promise<DatasetResult> {
	const { config, missing } = readSupabaseCollectorConfig();
	if (!config) return { ok: false, payload: { failure: 'unconfigured', missing } };
	const disk = await readProjectDiskUsage(config.projectRef, config.token, fetchImpl);
	if (disk.ok) return { ok: true, payload: { usedBytes: disk.usedBytes } };
	return {
		ok: false,
		payload: {
			failure: disk.failure,
			stage: 'disk_util',
			...(disk.failure === 'http_403' ? { missingPermission: SUPABASE_DISK_PERMISSION } : {}),
		},
	};
}

/** Never throws: an unexpected error inside a dataset is recorded as `network`. */
async function settle(task: () => Promise<DatasetResult>): Promise<DatasetResult> {
	try {
		return await task();
	} catch {
		return { ok: false, payload: { failure: 'network', stage: 'unexpected' } };
	}
}

export async function collectPlatformUsage(
	now: Date,
	fetchImpl: typeof fetch = fetch,
): Promise<PlatformSnapshotRow[]> {
	const cloudflare = readCloudflareCollectorConfig();
	const unconfigured: DatasetResult = {
		ok: false,
		payload: { failure: 'unconfigured', missing: cloudflare.missing },
	};
	const config = cloudflare.config;
	const run = (
		collect: (
			config: CloudflareCollectorConfig,
			now: Date,
			fetchImpl: typeof fetch,
		) => Promise<DatasetResult>,
	) => (config ? settle(() => collect(config, now, fetchImpl)) : Promise.resolve(unconfigured));
	const datasets: [PlatformSnapshotProvider, Promise<DatasetResult>][] = [
		['cloudflare_workers', run(collectWorkers)],
		['cloudflare_durable_objects', run(collectDurableObjects)],
		['cloudflare_r2', run(collectR2)],
		['cloudflare_zone', run(collectZone)],
		['supabase_disk', settle(() => collectSupabaseDisk(fetchImpl))],
	];
	const collectedAt = now.toISOString();
	return Promise.all(
		datasets.map(async ([provider, pending]) => {
			const result = await pending;
			return {
				collected_at: collectedAt,
				provider,
				ok: result.ok,
				payload: { ...result.payload },
			};
		}),
	);
}

export interface PlatformCollectorResult {
	/** Dataset name to whether it was collected. */
	datasets: Record<PlatformSnapshotProvider, boolean>;
	/** Permissions a provider reported missing, for the operator log. */
	missingPermissions: string[];
	purged: boolean;
}

export async function runPlatformUsageCollector(
	now = new Date(),
	fetchImpl: typeof fetch = fetch,
): Promise<PlatformCollectorResult> {
	const rows = await collectPlatformUsage(now, fetchImpl);
	await insertPlatformSnapshots(rows);
	let purged = true;
	try {
		await purgePlatformSnapshots(
			new Date(now.getTime() - PLATFORM_SNAPSHOT_RETENTION_DAYS * DAY_MS),
		);
	} catch {
		// Purge retries on the next run; the fresh snapshots are already stored.
		purged = false;
	}
	const missingPermissions = [
		...new Set(
			rows
				.map((row) => row.payload.missingPermission)
				.filter((value): value is string => typeof value === 'string'),
		),
	];
	return {
		datasets: Object.fromEntries(rows.map((row) => [row.provider, row.ok])) as Record<
			PlatformSnapshotProvider,
			boolean
		>,
		missingPermissions,
		purged,
	};
}
