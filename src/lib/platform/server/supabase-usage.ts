/**
 * Supabase disk usage for the platform usage collector, read from the
 * Management API with a read-only personal access token. Never throws and
 * never forwards provider response bodies.
 *
 * The Free plan's 500 MB cap applies to the database size, which the
 * collector reads through `platform_database_size()` instead (the PAT's
 * scopes cannot). Disk usage includes WAL and system files and runs far above
 * the database size, so the console shows it as a secondary figure with no
 * quota.
 */

import { type ProviderFailure, fetchProviderJson, isRecord } from './provider-request';

const MANAGEMENT_ENDPOINT = 'https://api.supabase.com/v1/projects';

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
