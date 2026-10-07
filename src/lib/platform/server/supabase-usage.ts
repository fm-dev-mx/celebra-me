/**
 * Supabase project usage for the super-admin platform console, read from the
 * Management API with a read-only personal access token. One project per
 * environment (Preview and Production), each against its own Free-plan
 * allowance and its own credentials. Never throws to callers and never
 * forwards provider response bodies: failures collapse to `unavailable` or a
 * blanked meter.
 */

import { SUPABASE_FREE_TIER } from '@/lib/platform/contract/limits';
import { buildPlatformMetric } from '@/lib/platform/contract/meters';
import type { PlatformEnvironmentId, PlatformProviderUsage } from '@/lib/platform/contract/types';
import { PLATFORM_ENV } from './config';
import { readProfileVar, readSharedVar } from './env-profiles';

const MANAGEMENT_ENDPOINT = 'https://api.supabase.com/v1/projects';
const REQUEST_TIMEOUT_MS = 5_000;
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
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

async function queryProjectUsedBytes(
	ref: string,
	token: string,
	fetchImpl: typeof fetch,
): Promise<number | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetchImpl(
			`${MANAGEMENT_ENDPOINT}/${encodeURIComponent(ref)}/config/disk/util`,
			{
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				signal: controller.signal,
			},
		);
		if (!response.ok) return null;
		return parseDiskUsedBytes(await response.json());
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

export async function getSupabasePlatformUsage(
	environment: PlatformEnvironmentId,
	now = new Date(),
	fetchImpl: typeof fetch = fetch,
): Promise<PlatformProviderUsage> {
	const token = readProfileVar('supabaseManagementToken', environment);
	const projectRef = readSharedVar(PROJECT_REF_ENV[environment], environment);
	const missing = [token.missing, projectRef.missing].filter(
		(entry): entry is NonNullable<typeof entry> => entry !== null,
	);
	if (!token.value || !projectRef.value) {
		return { kind: 'unconfigured', missing };
	}
	const cached = cache[environment];
	if (cached && cached.expiresAt > now.getTime()) return cached.value;
	const used = await queryProjectUsedBytes(projectRef.value, token.value, fetchImpl);
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
