/**
 * @jest-environment node
 */
import type { PlatformUsageReport } from '@/lib/platform/contract/types';
import {
	findQuotaAlerts,
	formatQuotaAlerts,
	quotaAlertsForRows,
} from '@/lib/platform/server/collector/quota-alerts';

const metric = (id: string, used: number | null, limit: number | null, resource?: string) => ({
	id,
	...(resource ? { resource } : {}),
	meter: { used, limit },
	window: 'monthUtc' as const,
	scope: 'account' as const,
	overageUsd: null,
	projection: { kind: 'unknown' as const },
});

describe('platform quota alerts', () => {
	it('lists metrics at or above 80 % of their allowance and skips unknown figures', () => {
		const report: PlatformUsageReport = [
			{
				id: 'shared',
				cards: [
					{
						provider: 'cloudflare',
						usage: {
							kind: 'ok',
							fetchedAt: '2026-10-22T16:00:00.000Z',
							spendUsd: null,
							missing: [],
							metrics: [
								metric('cfR2ClassA', 830_000, 1_000_000),
								metric('cfR2ClassB', 7_990_000, 10_000_000),
								metric(
									'cfR2StorageBucket',
									8_000_000_000,
									10_000_000_000,
									'memories',
								),
								metric('cfR2StorageAccount', null, 10_000_000_000),
								metric('sbDisk', 9, null),
							],
						},
					},
					{ provider: 'supabase', usage: { kind: 'unavailable' } },
				],
			},
		];
		const alerts = findQuotaAlerts(report);
		expect(alerts).toEqual([
			{ id: 'cfR2ClassA', percent: 83 },
			{ id: 'cfR2StorageBucket', resource: 'memories', percent: 80 },
		]);
		expect(formatQuotaAlerts(alerts)).toBe('cfR2ClassA 83%, cfR2StorageBucket(memories) 80%');
	});

	it('scores the rows of the current run against the Supabase database allowance', async () => {
		const collectedAt = '2026-10-22T16:00:00.000Z';
		await expect(
			quotaAlertsForRows([
				{
					collected_at: collectedAt,
					provider: 'supabase_database',
					ok: true,
					payload: { usedBytes: 450_000_000 },
				},
			]),
		).resolves.toEqual([{ id: 'sbDatabase', percent: 90 }]);
		await expect(
			quotaAlertsForRows([
				{
					collected_at: collectedAt,
					provider: 'supabase_database',
					ok: true,
					payload: { usedBytes: 100_000_000 },
				},
			]),
		).resolves.toEqual([]);
	});
});
