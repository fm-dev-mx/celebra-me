/**
 * Vercel billing usage for the super-admin platform console, read from the
 * billing charges API (FOCUS JSONL). The one project runs on the Hobby plan,
 * so the period spend is expected to be $0 and the card also links to the
 * usage dashboard for allotments, which no public endpoint exposes (not
 * verified). Never throws to callers and never forwards provider response
 * bodies.
 */

import type { PlatformProviderUsage } from '@/lib/platform/contract/types';
import { getEnv } from '@/lib/server/env';
import { PLATFORM_ENV } from './config';

const BILLING_ENDPOINT = 'https://api.vercel.com/v1/billing/charges';
const REQUEST_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 15 * 60 * 1000;

type VercelConfig = { token: string; teamId: string };

let cache: { expiresAt: number; value: PlatformProviderUsage } | null = null;

export function resetVercelUsageCache(): void {
	cache = null;
}

function readConfig(): VercelConfig | null {
	const token = getEnv(PLATFORM_ENV.vercelApiToken).trim();
	if (!token) return null;
	return { token, teamId: getEnv(PLATFORM_ENV.vercelTeamId).trim() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Sum billed cost across FOCUS rows. The FOCUS 1.3 column names (`BilledCost`,
 * `EffectiveCost`) are taken from the Vercel changelog; the live payload shape
 * is not verified, so an unrecognized payload yields null instead of a guess.
 */
export function parseBillingChargesUsd(payload: string): number | null {
	let total = 0;
	let seen = false;
	for (const line of payload.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		let row: unknown;
		try {
			row = JSON.parse(trimmed);
		} catch {
			return null;
		}
		if (!isRecord(row)) return null;
		const cost = row.BilledCost ?? row.EffectiveCost ?? row.billedCost ?? row.effectiveCost;
		const amount = typeof cost === 'string' ? Number(cost) : cost;
		if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
		total += amount;
		seen = true;
	}
	return seen ? Math.round(total * 100) / 100 : null;
}

async function queryBillingCharges(
	config: VercelConfig,
	now: Date,
	fetchImpl: typeof fetch,
): Promise<{ ok: boolean; spendUsd: number | null }> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		// `from`/`to` bound the request to the current UTC month; the exact
		// parameter names and the Hobby billing cycle start are not verified.
		const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
		const to = now.toISOString();
		const params = new URLSearchParams({ from, to });
		if (config.teamId) params.set('teamId', config.teamId);
		const response = await fetchImpl(`${BILLING_ENDPOINT}?${params.toString()}`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${config.token}`,
				'Content-Type': 'application/json',
			},
			signal: controller.signal,
		});
		if (!response.ok) return { ok: false, spendUsd: null };
		return { ok: true, spendUsd: parseBillingChargesUsd(await response.text()) };
	} catch {
		return { ok: false, spendUsd: null };
	} finally {
		clearTimeout(timer);
	}
}

async function queryVercel(
	config: VercelConfig,
	now: Date,
	fetchImpl: typeof fetch,
): Promise<PlatformProviderUsage> {
	const result = await queryBillingCharges(config, now, fetchImpl);
	if (!result.ok) return { kind: 'unavailable' };
	return { kind: 'ok', fetchedAt: now.toISOString(), metrics: [], spendUsd: result.spendUsd };
}

export async function getVercelPlatformUsage(
	now = new Date(),
	fetchImpl: typeof fetch = fetch,
): Promise<PlatformProviderUsage> {
	const config = readConfig();
	if (!config) return { kind: 'unconfigured' };
	if (cache && cache.expiresAt > now.getTime()) return cache.value;
	const value = await queryVercel(config, now, fetchImpl);
	if (value.kind === 'ok') cache = { expiresAt: now.getTime() + CACHE_TTL_MS, value };
	return value;
}
