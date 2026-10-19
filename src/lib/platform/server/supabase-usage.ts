/**
 * Supabase project usage for the super-admin platform console, read from the
 * Management API with a read-only personal access token. One project per
 * environment (Preview and Production). Never throws to callers and never
 * forwards provider response bodies: failures collapse to `unavailable` or a
 * blanked meter.
 *
 * The Free plan's 500 MB cap applies to the database size, which the PAT's
 * scopes (Usage Analytics Read, Disk Config Read) cannot read: the SQL and
 * metrics endpoints need `database_read` or `analytics_logs_read`. Disk usage
 * includes WAL and system files and runs far above the database size, so it
 * is reported as an informative figure with no quota (`limit: null`), never
 * against the 500 MB cap, to avoid a false alarm.
 */

import { buildPlatformMetric } from '@/lib/platform/contract/meters';
import type { PlatformEnvironmentId, PlatformProviderUsage } from '@/lib/platform/contract/types';
import { PLATFORM_ENV } from './config';
import { readProfileVar } from './env-profiles';
import { type ProviderFailure, fetchProviderJson, isRecord } from './provider-request';

const MANAGEMENT_ENDPOINT = 'https://api.supabase.com/v1/projects';
/** Analytics endpoints are rate limited to 30 requests/minute; cache absorbs refreshes. */
const CACHE_TTL_MS = 5 * 60 * 1000;

const PROJECT_REF_ENV: Record<PlatformEnvironmentId, string> = {
	preview: PLATFORM_ENV.supabaseProjectRefPreview,
	production: PLATFORM_ENV.supabaseProjectRefProduction,
};

let cache: Record<string, { expiresAt: number; value: PlatformProviderUsage }> = {};

export function resetSupabaseUsageCache(): void {
	cache = {};
}

/**
 * Disk utilization from `GET /v1/projects/{ref}/config/disk/util`
 * (`{ timestamp, metrics: { fs_used_bytes, … } }` per the OpenAPI spec; a flat
 * shape is also accepted). A missing figure blanks only its own meter.
 */
export function parseDiskUsedBytes(payload: unknown): number | null {
	const root = isRecord(payload) ? payload : null;
	const metrics = isRecord(root?.metrics) ? root.metrics : root;
	const used = metrics?.fs_used_bytes ?? metrics?.used_bytes;
	if (typeof used === 'number' && Number.isFinite(used) && used >= 0) return used;
	return null;
}

export type SupabaseDiskResult =
	{ ok: true; usedBytes: number } | { ok: false; failure: ProviderFailure };

/** Used disk bytes of one project. Never throws and never returns the provider body. */
export async function readProjectDiskUsage(
	ref: string,
	token: string,
	fetchImpl: typeof fetch,
): Promise<SupabaseDiskResult> {
	const result = await fetchProviderJson(
		`${MANAGEMENT_ENDPOINT}/${encodeURIComponent(ref)}/config/disk/util`,
		{ method: 'GET', token },
		fetchImpl,
	);
	if (!result.ok) return { ok: false, failure: result.failure };
	const usedBytes = parseDiskUsedBytes(result.body);
	return usedBytes === null ? { ok: false, failure: 'malformed' } : { ok: true, usedBytes };
}

export async function getSupabasePlatformUsage(
	environment: PlatformEnvironmentId,
	now = new Date(),
	fetchImpl: typeof fetch = fetch,
): Promise<PlatformProviderUsage> {
	const token = readProfileVar(PLATFORM_ENV.supabaseManagementToken, environment);
	const projectRef = readProfileVar(PROJECT_REF_ENV[environment], environment);
	const missing = [token.missing, projectRef.missing].filter(
		(entry): entry is NonNullable<typeof entry> => entry !== null,
	);
	if (!token.value || !projectRef.value) {
		return { kind: 'unconfigured', missing };
	}
	const cached = cache[environment];
	if (cached && cached.expiresAt > now.getTime()) return cached.value;
	const disk = await readProjectDiskUsage(projectRef.value, token.value, fetchImpl);
	const used = disk.ok ? disk.usedBytes : null;
	const value: PlatformProviderUsage =
		used === null
			? { kind: 'unavailable' }
			: {
					kind: 'ok',
					fetchedAt: now.toISOString(),
					spendUsd: null,
					missing: [],
					metrics: [
						buildPlatformMetric({
							id: 'sbDisk',
							used,
							limit: null,
							window: 'snapshot',
							scope: environment,
							now,
						}),
					],
				};
	if (value.kind === 'ok') {
		cache = { ...cache, [environment]: { expiresAt: now.getTime() + CACHE_TTL_MS, value } };
	}
	return value;
}
