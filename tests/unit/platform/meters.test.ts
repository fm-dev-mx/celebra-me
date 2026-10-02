import {
	buildPlatformMetric,
	platformMeterStep,
	platformUsageLevel,
	platformUsageRatio,
	projectPlatformExhaustion,
} from '@/lib/platform/contract/meters';
import { platformMetricFormat } from '@/lib/platform/dashboard-copy';

const NOW = new Date('2026-10-24T12:00:00.000Z');

describe('meter math', () => {
	it('scores ratios, levels and fill steps like the consoles render them', () => {
		expect(platformUsageRatio(50, 100)).toBe(0.5);
		expect(platformUsageRatio(0, 0)).toBe(0);
		expect(platformUsageRatio(-1, 100)).toBe(0);
		expect(platformUsageLevel(0.5)).toBe('normal');
		expect(platformUsageLevel(0.7)).toBe('warning');
		expect(platformUsageLevel(0.9)).toBe('critical');
		expect(platformMeterStep(0)).toBe(0);
		expect(platformMeterStep(3)).toBe(5);
		expect(platformMeterStep(97)).toBe(95);
		expect(platformMeterStep(100)).toBe(100);
	});
});

describe('projectPlatformExhaustion', () => {
	it('projects a daily quota from the rate observed since 00:00 UTC', () => {
		// 12 h into the UTC day, 90 % of the daily quota is gone.
		const projection = projectPlatformExhaustion(
			{ used: 90_000, limit: 100_000 },
			'dayUtc',
			NOW,
		);
		expect(projection.kind).toBe('exhaustsAt');
		if (projection.kind === 'exhaustsAt') {
			// 10 000 left at 7 500/hour -> 1.33 h after noon UTC.
			expect(new Date(projection.at).getTime()).toBeGreaterThan(NOW.getTime());
			expect(new Date(projection.at).getTime()).toBeLessThan(Date.UTC(2026, 9, 24, 14, 0, 0));
		}
	});

	it('is safe when the observed rate resets before reaching the quota', () => {
		expect(projectPlatformExhaustion({ used: 100, limit: 100_000 }, 'dayUtc', NOW)).toEqual({
			kind: 'safe',
		});
	});

	it('cannot project snapshots, unknown cycles or empty meters', () => {
		expect(projectPlatformExhaustion({ used: 1_000, limit: 10_000 }, 'snapshot', NOW)).toEqual({
			kind: 'unknown',
		});
		expect(
			projectPlatformExhaustion({ used: 1_000, limit: 10_000 }, 'creditCycle', NOW),
		).toEqual({ kind: 'unknown' });
		expect(projectPlatformExhaustion({ used: null, limit: 10_000 }, 'dayUtc', NOW)).toEqual({
			kind: 'unknown',
		});
		expect(projectPlatformExhaustion({ used: 10, limit: null }, 'dayUtc', NOW)).toEqual({
			kind: 'unknown',
		});
		expect(projectPlatformExhaustion({ used: 10_000, limit: 10_000 }, 'dayUtc', NOW)).toEqual({
			kind: 'unknown',
		});
	});

	it('projects a monthly quota against the UTC calendar month', () => {
		const projection = projectPlatformExhaustion(
			{ used: 990_000, limit: 1_000_000 },
			'monthUtc',
			NOW,
		);
		expect(projection.kind).toBe('exhaustsAt');
	});

	it('assembles metrics with their projection attached', () => {
		const metric = buildPlatformMetric({
			id: 'cfWorkersRequests',
			used: 90_000,
			limit: 100_000,
			window: 'dayUtc',
			scope: 'account',
			now: NOW,
			overageUsd: 0.5,
		});
		expect(metric.meter).toEqual({ used: 90_000, limit: 100_000 });
		expect(metric.overageUsd).toBe(0.5);
		expect(metric.projection.kind).toBe('exhaustsAt');
	});

	it('formats storage and bandwidth metrics with byte units', () => {
		const bandwidthMetric = buildPlatformMetric({
			id: 'clBandwidth',
			used: 5_000_000_000,
			limit: null,
			window: 'creditCycle',
			scope: 'account',
			now: NOW,
		});
		expect(platformMetricFormat(bandwidthMetric)(5_000_000_000)).toBe('5 GB');
	});
});
