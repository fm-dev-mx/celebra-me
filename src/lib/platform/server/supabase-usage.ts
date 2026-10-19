/**
 * Supabase project usage for the super-admin platform console. One project per
 * environment (Preview and Production). Never throws to callers and never
 * forwards provider response bodies: failures collapse to `unavailable` or a
 * blanked meter.
 *
 * The Free plan's 500 MB cap applies to the database size. The Management API
 * token cannot read it without SQL access to every table, so the size comes
 * from the `platform_database_size()` RPC (service role only, returns a single
 * number), called with the Worker's own service role key. That key only
 * reaches its own project, so the size is read only when `SUPABASE_URL` is the
 * environment's project; elsewhere the meter stays blank.
 *
 * Disk usage comes from the Management API (read-only PAT). It includes WAL
 * and system files and runs far above the database size, so it is reported as
 * an informative figure with no quota (`limit: null`).
 */

import { SUPABASE_FREE_TIER } from '@/lib/platform/contract/limits';
import { buildPlatformMetric } from '@/lib/platform/contract/meters';
import type { PlatformEnvironmentId, PlatformProviderUsage } from '@/lib/platform/contract/types';
import { getEnv } from '@/lib/server/env';
import { PLATFORM_ENV } from './config';
import { readProfileVar } from './env-profiles';
import {
	type ProviderFailure,
	fetchProviderJson,
	finiteNumber,
	isRecord,
} from './provider-request';

const MANAGEMENT_ENDPOINT = 'https://api.supabase.com/v1/projects';
const DATABASE_SIZE_RPC = 'rest/v1/rpc/platform_database_size';
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

/** Origin of `ref`'s project when `SUPABASE_URL` points at it, else null. */
function ownProjectOrigin(ref: string): string | null {
	const raw = getEnv('SUPABASE_URL').trim();
	if (!raw) return null;
	try {
		const url = new URL(raw);
		return url.protocol === 'https:' && url.hostname === `${ref.toLowerCase()}.supabase.co`
			? url.origin
			: null;
	} catch {
		return null;
	}
}

/**
 * Database size of `ref`'s project via `platform_database_size()`, or null when
 * this deployment has no service role key for that project, the migration is
 * not applied yet, or the call fails. Never throws.
 */
async function readProjectDatabaseSize(
	ref: string,
	fetchImpl: typeof fetch,
): Promise<number | null> {
	const origin = ownProjectOrigin(ref);
	const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY').trim();
	if (!origin || !serviceKey) return null;
	const result = await fetchProviderJson(
		`${origin}/${DATABASE_SIZE_RPC}`,
		{ method: 'POST', token: serviceKey, headers: { apikey: serviceKey }, body: {} },
		fetchImpl,
	);
	return result.ok ? finiteNumber(result.body) : null;
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
	const [databaseBytes, disk] = await Promise.all([
		readProjectDatabaseSize(projectRef.value, fetchImpl),
		readProjectDiskUsage(projectRef.value, token.value, fetchImpl),
	]);
	const diskBytes = disk.ok ? disk.usedBytes : null;
	const metric = (id: string, used: number | null, limit: number | null) =>
		buildPlatformMetric({ id, used, limit, window: 'snapshot', scope: environment, now });
	const value: PlatformProviderUsage =
		databaseBytes === null && diskBytes === null
			? { kind: 'unavailable' }
			: {
					kind: 'ok',
					fetchedAt: now.toISOString(),
					spendUsd: null,
					missing: [],
					metrics: [
						metric('sbDatabase', databaseBytes, SUPABASE_FREE_TIER.databaseBytes),
						...(diskBytes === null ? [] : [metric('sbDisk', diskBytes, null)]),
					],
				};
	if (value.kind === 'ok') {
		cache = { ...cache, [environment]: { expiresAt: now.getTime() + CACHE_TTL_MS, value } };
	}
	return value;
}
