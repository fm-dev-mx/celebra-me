/**
 * Pure meter math shared by the platform usage server and dashboards: ratios,
 * threshold levels, meter fill steps and the constant-rate exhaustion
 * projection. No imports beyond the sibling contract modules.
 */

import { PLATFORM_USAGE_CRITICAL_RATIO, PLATFORM_USAGE_WARNING_RATIO } from './limits';
import type {
	PlatformMetric,
	PlatformMeter,
	PlatformProjection,
	PlatformScope,
	PlatformWindow,
} from './types';

export type PlatformUsageLevel = 'normal' | 'warning' | 'critical';

export function platformUsageRatio(used: number, limit: number): number {
	return limit > 0 ? Math.max(0, used / limit) : 0;
}

/** Meter fill in 5 % steps, rendered by CSS (`[data-fill]`) instead of inline styles. */
export function platformMeterStep(percent: number): number {
	const clamped = Math.max(0, Math.min(100, percent));
	return clamped > 0 && clamped < 5 ? 5 : Math.round(clamped / 5) * 5;
}

export function platformUsageLevel(ratio: number): PlatformUsageLevel {
	if (ratio >= PLATFORM_USAGE_CRITICAL_RATIO) return 'critical';
	if (ratio >= PLATFORM_USAGE_WARNING_RATIO) return 'warning';
	return 'normal';
}

function windowBoundsUtc(window: PlatformWindow, now: Date): { start: number; end: number } | null {
	const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	const dayEnd = dayStart + 24 * 60 * 60 * 1000;
	const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
	const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
	switch (window) {
		case 'dayUtc':
			return { start: dayStart, end: dayEnd };
		case 'monthUtc':
			return { start: monthStart, end: monthEnd };
		default:
			// Billing and credit cycles start on provider-side dates (not verified);
			// snapshots (storage) have no reset, so neither yields a rate.
			return null;
	}
}

/**
 * Constant-rate estimate of when a quota runs out inside the current window.
 * Usage is assumed to continue at the average rate observed since the window
 * opened; `safe` means that rate never reaches the quota before the reset.
 */
export function projectPlatformExhaustion(
	meter: PlatformMeter,
	window: PlatformWindow,
	now: Date,
): PlatformProjection {
	const { used, limit } = meter;
	if (used === null || limit === null || used <= 0 || limit <= 0 || used >= limit) {
		return { kind: 'unknown' };
	}
	const bounds = windowBoundsUtc(window, now);
	if (!bounds) return { kind: 'unknown' };
	const elapsedMs = now.getTime() - bounds.start;
	if (elapsedMs <= 0) return { kind: 'unknown' };
	const usedPerMs = used / elapsedMs;
	if (usedPerMs <= 0) return { kind: 'unknown' };
	const exhaustedAt = now.getTime() + (limit - used) / usedPerMs;
	if (exhaustedAt >= bounds.end) return { kind: 'safe' };
	return { kind: 'exhaustsAt', at: new Date(exhaustedAt).toISOString() };
}

/** Assemble one meter row with its projection computed against `now`. */
export function buildPlatformMetric(input: {
	id: string;
	used: number | null;
	limit: number | null;
	window: PlatformWindow;
	scope: PlatformScope;
	now: Date;
	resource?: string;
	overageUsd?: number | null;
}): PlatformMetric {
	const meter: PlatformMeter = { used: input.used, limit: input.limit };
	return {
		id: input.id,
		resource: input.resource,
		meter,
		window: input.window,
		scope: input.scope,
		overageUsd: input.overageUsd ?? null,
		projection: projectPlatformExhaustion(meter, input.window, input.now),
	};
}
