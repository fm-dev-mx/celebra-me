/**
 * Quota alerts for one collector run: every metric of the usage report whose figure reaches
 * PLATFORM_QUOTA_ALERT_RATIO of its allowance. The collector logs them in its summary event, and
 * the daily Production monitor (`pnpm ops:monitor platform-quotas`) reads that event from Workers
 * Logs, so the alert needs no database credential outside the Worker.
 */

import { PLATFORM_QUOTA_ALERT_RATIO } from '@/lib/platform/contract/limits';
import type { PlatformUsageReport } from '@/lib/platform/contract/types';
import { type StoredSnapshot, getPlatformUsageReport } from '../platform-usage.service';
import type { PlatformSnapshotRow } from './types';

export const PLATFORM_USAGE_SUMMARY_EVENT = 'platform_usage_summary';

export interface PlatformQuotaAlert {
	id: string;
	resource?: string;
	percent: number;
}

export function findQuotaAlerts(report: PlatformUsageReport): PlatformQuotaAlert[] {
	const alerts: PlatformQuotaAlert[] = [];
	for (const section of report) {
		for (const card of section.cards) {
			if (card.usage.kind !== 'ok') continue;
			for (const metric of card.usage.metrics) {
				const { used, limit } = metric.meter;
				if (used === null || limit === null || limit <= 0) continue;
				if (used / limit < PLATFORM_QUOTA_ALERT_RATIO) continue;
				alerts.push({
					id: metric.id,
					...(metric.resource ? { resource: metric.resource } : {}),
					percent: Math.round((used / limit) * 100),
				});
			}
		}
	}
	return alerts;
}

/** Scores the rows this run just collected, without reading them back from the table. */
export async function quotaAlertsForRows(
	rows: PlatformSnapshotRow[],
): Promise<PlatformQuotaAlert[]> {
	const latest: Partial<Record<PlatformSnapshotRow['provider'], StoredSnapshot>> = {};
	for (const row of rows) latest[row.provider] = { ...row };
	return findQuotaAlerts(await getPlatformUsageReport(async () => latest));
}

/** One line per alert, e.g. `cfR2ClassA 83%` or `cfR2StorageBucket(celebra-memories) 81%`. */
export function formatQuotaAlerts(alerts: PlatformQuotaAlert[]): string {
	return alerts
		.map(({ id, resource, percent }) => `${resource ? `${id}(${resource})` : id} ${percent}%`)
		.join(', ');
}
