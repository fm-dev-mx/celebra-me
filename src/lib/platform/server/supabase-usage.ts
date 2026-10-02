/**
 * Supabase project usage for the super-admin platform console, read from the
 * Management API with a read-only personal access token. One project per
 * environment (Preview and Production), each against its own Free-plan
 * allowance. Never throws to callers and never forwards provider response
 * bodies: failures collapse to `unavailable` or a blanked meter.
 */

import { SUPABASE_FREE_TIER } from '@/lib/platform/contract/limits';
import { buildPlatformMetric } from '@/lib/platform/contract/meters';
import type {
	PlatformMetric,
	PlatformProviderUsage,
	PlatformScope,
} from '@/lib/platform/contract/types';
import { getEnv } from '@/lib/server/env';
import { PLATFORM_ENV } from './config';

const MANAGEMENT_ENDPOINT = 'https://api.supabase.com/v1/projects';
const REQUEST_TIMEOUT_MS = 5_000;
/** Analytics endpoints are rate limited to 30 requests/minute; cache absorbs refreshes. */
const CACHE_TTL_MS = 5 * 60 * 1000;

type SupabaseConfig = { token: string; projects: { scope: PlatformScope; ref: string }[] };

let cache: { expiresAt: number; value: PlatformProviderUsage } | null = null;

export function resetSupabaseUsageCache(): void {
	cache = null;
}

function readConfig(): SupabaseConfig | null {
	const token = getEnv(PLATFORM_ENV.supabaseManagementToken).trim();
	const preview = getEnv(PLATFORM_ENV.supabaseProjectRefPreview).trim();
	const production = getEnv(PLATFORM_ENV.supabaseProjectRefProduction).trim();
	if (!token) return null;
	const projects: { scope: PlatformScope; ref: string }[] = [];
	if (preview) projects.push({ scope: 'preview', ref: preview });
	if (production) projects.push({ scope: 'production', ref: production });
	return projects.length > 0 ? { token, projects } : null;
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

async function querySupabase(
	config: SupabaseConfig,
	now: Date,
	fetchImpl: typeof fetch,
): Promise<PlatformProviderUsage> {
	const results = await Promise.all(
		config.projects.map(async (project) => ({
			scope: project.scope,
			used: await queryProjectUsedBytes(project.ref, config.token, fetchImpl),
		})),
	);
	const metrics: PlatformMetric[] = results.map((result) =>
		buildPlatformMetric({
			id: 'sbDatabase',
			used: result.used,
			limit: SUPABASE_FREE_TIER.databaseBytes,
			window: 'snapshot',
			scope: result.scope,
			now,
		}),
	);
	if (metrics.every((metric) => metric.meter.used === null)) return { kind: 'unavailable' };
	return { kind: 'ok', fetchedAt: now.toISOString(), metrics, spendUsd: null };
}

export async function getSupabasePlatformUsage(
	now = new Date(),
	fetchImpl: typeof fetch = fetch,
): Promise<PlatformProviderUsage> {
	const config = readConfig();
	if (!config) return { kind: 'unconfigured' };
	if (cache && cache.expiresAt > now.getTime()) return cache.value;
	const value = await querySupabase(config, now, fetchImpl);
	if (value.kind === 'ok') cache = { expiresAt: now.getTime() + CACHE_TTL_MS, value };
	return value;
}
