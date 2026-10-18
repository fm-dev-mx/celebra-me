/**
 * Supabase project usage for the super-admin platform console, read from the
 * Management API with a read-only personal access token. One project per
 * environment (Preview and Production), each against its own Free-plan
 * allowance. Never throws to callers and never
 * forwards provider response bodies: failures collapse to `unavailable` or a
 * blanked meter.
 */

import { SUPABASE_FREE_TIER } from '@/lib/platform/contract/limits';
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
 * Disk utilization from `GET /v1/projects/{ref}/config/disk/util`. The exact
 * envelope and its equivalence to the plan's "database size" are not verified
 * against the live API: both shapes are accepted and a missing figure blanks
 * only its own meter.
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
							id: 'sbDatabase',
							used,
							limit: SUPABASE_FREE_TIER.databaseBytes,
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
