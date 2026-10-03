/**
 * Cloudinary product-environment usage for the super-admin platform console,
 * read from the Admin API `usage` report with server-only credentials. One
 * shared cloud covers Preview and Production, so every figure is account
 * scoped. Report numbers are "updated periodically" (Admin API docs): the
 * panel stamps the fetch time and never treats them as exact. Never throws to
 * callers and never forwards provider response bodies.
 */

import { buildPlatformMetric } from '@/lib/platform/contract/meters';
import type {
	PlatformMetric,
	PlatformMissingVar,
	PlatformProviderUsage,
} from '@/lib/platform/contract/types';
import { PLATFORM_ENV } from './config';
import { readSharedVar } from './env-profiles';

const REQUEST_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };

let cache: { expiresAt: number; value: PlatformProviderUsage } | null = null;

export function resetCloudinaryUsageCache(): void {
	cache = null;
}

/**
 * Prefers the restricted usage key and falls back to the existing upload key so
 * the card works without a second credential (higher privilege - documented
 * tradeoff). The preferred names are still reported so the panel can recommend
 * creating the restricted key; only names travel, never values.
 */
function readConfig(): { config: CloudinaryConfig | null; missing: PlatformMissingVar[] } {
	const cloudName = readSharedVar(PLATFORM_ENV.cloudinaryCloudName, 'account');
	const usageKey = readSharedVar(PLATFORM_ENV.cloudinaryUsageApiKey, 'account');
	const usageSecret = readSharedVar(PLATFORM_ENV.cloudinaryUsageApiSecret, 'account');
	const uploadKey = readSharedVar(PLATFORM_ENV.cloudinaryApiKey, 'account');
	const uploadSecret = readSharedVar(PLATFORM_ENV.cloudinaryApiSecret, 'account');
	const apiKey = usageKey.value ?? uploadKey.value;
	const apiSecret = usageSecret.value ?? uploadSecret.value;
	const missing: PlatformMissingVar[] = [];
	if (cloudName.missing) missing.push(cloudName.missing);
	if (!usageKey.value && uploadKey.value && usageKey.missing) missing.push(usageKey.missing);
	if (!usageSecret.value && uploadSecret.value && usageSecret.missing) {
		missing.push(usageSecret.missing);
	}
	if (!apiKey && usageKey.missing) missing.push(usageKey.missing);
	if (!apiSecret && usageSecret.missing) missing.push(usageSecret.missing);
	const config =
		cloudName.value && apiKey && apiSecret
			? { cloudName: cloudName.value, apiKey, apiSecret }
			: null;
	return { config, missing };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

type UsagePair = { used: number | null; limit: number | null };

/**
 * Accepts both report shapes the Admin API has shipped: nested
 * `{ usage, limit }` objects and flat numbers. Unrecognized shapes blank their
 * own meter instead of guessing (field names not verified against live data).
 */
export function readUsagePair(payload: Record<string, unknown>, name: string): UsagePair {
	const value = payload[name];
	if (isRecord(value)) {
		return {
			used: finiteNumber(value.usage ?? value.used),
			limit: finiteNumber(value.limit),
		};
	}
	const used = finiteNumber(value);
	return { used, limit: finiteNumber(payload[`${name}_limit`]) };
}

/** Credits ship either nested or as `used_credits` + `credits` totals. */
export function readCreditsPair(payload: Record<string, unknown>): UsagePair {
	const credits = payload.credits;
	if (isRecord(credits)) return readUsagePair(payload, 'credits');
	return {
		used: finiteNumber(payload.used_credits),
		limit: finiteNumber(credits),
	};
}

export function parseCloudinaryUsage(
	payload: unknown,
	now: Date,
	missing: PlatformMissingVar[] = [],
): PlatformProviderUsage {
	if (!isRecord(payload)) return { kind: 'unavailable' };
	const credits = readCreditsPair(payload);
	const storage = readUsagePair(payload, 'storage');
	const bandwidth = readUsagePair(payload, 'bandwidth');
	const requests = readUsagePair(payload, 'requests');
	const resources = readUsagePair(payload, 'resources');
	const metrics: PlatformMetric[] = [
		{ id: 'clCredits', ...credits, window: 'creditCycle' as const },
		{ id: 'clStorage', ...storage, window: 'snapshot' as const },
		{ id: 'clBandwidth', ...bandwidth, window: 'creditCycle' as const },
		{ id: 'clRequests', ...requests, window: 'creditCycle' as const },
		{ id: 'clResources', ...resources, window: 'snapshot' as const },
	].map(({ id, used, limit, window }) =>
		buildPlatformMetric({ id, used, limit, window, scope: 'account', now }),
	);
	if (metrics.every((metric) => metric.meter.used === null)) return { kind: 'unavailable' };
	return { kind: 'ok', fetchedAt: now.toISOString(), metrics, spendUsd: null, missing };
}

async function queryCloudinary(
	config: CloudinaryConfig,
	missing: PlatformMissingVar[],
	now: Date,
	fetchImpl: typeof fetch,
): Promise<PlatformProviderUsage> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetchImpl(
			`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/usage`,
			{
				method: 'GET',
				headers: {
					Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
					'Content-Type': 'application/json',
				},
				signal: controller.signal,
			},
		);
		if (!response.ok) return { kind: 'unavailable' };
		return parseCloudinaryUsage(await response.json(), now, missing);
	} catch {
		return { kind: 'unavailable' };
	} finally {
		clearTimeout(timer);
	}
}

export async function getCloudinaryPlatformUsage(
	now = new Date(),
	fetchImpl: typeof fetch = fetch,
): Promise<PlatformProviderUsage> {
	const { config, missing } = readConfig();
	if (!config) return { kind: 'unconfigured', missing };
	if (cache && cache.expiresAt > now.getTime()) return cache.value;
	const value = await queryCloudinary(config, missing, now, fetchImpl);
	if (value.kind === 'ok') cache = { expiresAt: now.getTime() + CACHE_TTL_MS, value };
	return value;
}
