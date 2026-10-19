import {
	formatPlatformAge,
	formatPlatformBytes,
	formatPlatformCount,
	formatPlatformPercent,
	platformMissingDestination,
} from '@/lib/platform/dashboard-copy';
import {
	groupPlatformReport,
	platformDeployment,
	summarizePlatformReport,
} from '@/lib/platform/report-view';
import type { PlatformUsageReport } from '@/lib/platform/contract/types';

const AT = '2026-10-24T19:00:00.000Z';

function report(sections: PlatformUsageReport): PlatformUsageReport {
	return sections;
}

const okUsage = (used: number, limit: number, fetchedAt = AT) => ({
	kind: 'ok' as const,
	fetchedAt,
	spendUsd: null,
	missing: [],
	metrics: [
		{
			id: 'cfWorkersRequests',
			meter: { used, limit },
			window: 'snapshot' as const,
			scope: 'production' as const,
			overageUsd: null,
			projection: { kind: 'unknown' as const },
		},
	],
});

describe('platform number formatting', () => {
	it('prints decimal storage units so quotas read as published', () => {
		expect(formatPlatformBytes(500_000_000)).toBe('500 MB');
		expect(formatPlatformBytes(333_000_000)).toBe('333 MB');
		expect(formatPlatformBytes(1_900_000_000)).toBe('1.9 GB');
		expect(formatPlatformBytes(10_000_000_000)).toBe('10 GB');
		expect(formatPlatformBytes(0)).toBe('0 MB');
	});

	it('prints short counts and percents', () => {
		expect(formatPlatformCount(950)).toBe('950');
		expect(formatPlatformCount(1_900)).toBe('1.9k');
		expect(formatPlatformCount(12_345)).toBe('12k');
		expect(formatPlatformCount(1_200_000)).toBe('1.2 M');
		expect(formatPlatformPercent(0.004)).toBe('<1 %');
		expect(formatPlatformPercent(0.666)).toBe('67 %');
	});

	it('reads freshness as an age', () => {
		const now = new Date('2026-10-24T19:30:00.000Z');
		expect(formatPlatformAge('2026-10-24T19:29:40.000Z', now)).toBe('hace un momento');
		expect(formatPlatformAge('2026-10-24T19:05:00.000Z', now)).toBe('hace 25 min');
		expect(formatPlatformAge('2026-10-24T16:00:00.000Z', now)).toBe('hace 3 h');
	});
});

describe('platform report view', () => {
	it('infers the deployment from the visible environments', () => {
		expect(
			platformDeployment([
				{ id: 'production', cards: [] },
				{ id: 'shared', cards: [] },
			]),
		).toBe('production');
		expect(
			platformDeployment([
				{ id: 'preview', cards: [] },
				{ id: 'production', cards: [] },
				{ id: 'shared', cards: [] },
			]),
		).toBe('local');
	});

	it('points missing values at the right place per deployment', () => {
		expect(platformMissingDestination('preview').command).toBe(
			'pnpm ops:cloudflare:preview:secrets',
		);
		expect(platformMissingDestination('preview').text).toContain('celebra-me-preview');
		expect(platformMissingDestination('local')).toEqual({
			text: expect.stringContaining('.env.local'),
			command: null,
		});
	});

	it('groups by provider with Production before Preview', () => {
		const views = groupPlatformReport(
			report([
				{ id: 'preview', cards: [{ provider: 'supabase', usage: okUsage(1, 10) }] },
				{ id: 'production', cards: [{ provider: 'supabase', usage: okUsage(1, 10) }] },
				{
					id: 'shared',
					cards: [{ provider: 'cloudflare', usage: { kind: 'unavailable' } }],
				},
			]),
		);
		expect(views.map((view) => view.provider)).toEqual(['cloudflare', 'supabase']);
		expect(views[0].shared).toEqual({ kind: 'unavailable' });
		expect(views[1].shared).toBeNull();
		expect(views[1].environments.map((entry) => entry.environment)).toEqual([
			'production',
			'preview',
		]);
	});

	it('scores the overall level from thresholds, gaps and outages', () => {
		const healthy = summarizePlatformReport(
			report([
				{ id: 'production', cards: [{ provider: 'supabase', usage: okUsage(1, 10) }] },
			]),
		);
		expect(healthy).toMatchObject({ level: 'ok', healthy: 1, updatedAt: AT });

		const warning = summarizePlatformReport(
			report([
				{ id: 'production', cards: [{ provider: 'supabase', usage: okUsage(7, 10) }] },
			]),
		);
		expect(warning.level).toBe('warning');

		const attention = summarizePlatformReport(
			report([
				{
					id: 'production',
					cards: [{ provider: 'supabase', usage: { kind: 'unavailable' } }],
				},
			]),
		);
		expect(attention).toMatchObject({ level: 'attention', unavailable: 1, updatedAt: null });

		const critical = summarizePlatformReport(
			report([
				{
					id: 'production',
					cards: [
						{ provider: 'supabase', usage: okUsage(9, 10, '2026-10-24T18:00:00.000Z') },
						{ provider: 'cloudflare', usage: okUsage(7, 10) },
					],
				},
			]),
		);
		expect(critical).toMatchObject({
			level: 'critical',
			critical: 1,
			warning: 1,
			updatedAt: AT,
		});
	});
});
