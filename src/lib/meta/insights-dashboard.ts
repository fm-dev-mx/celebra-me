/** Shared by the collector and the view; pure so the view logic needs no server imports. */
export const META_ADS_ATTRIBUTION_WINDOW = 'unified';
/** Replacement for the Page reach metric removed in Graph v26.0. */
export const META_PAGE_REACH_METRIC = 'page_total_media_view_unique';
export const META_IG_REACH_METRIC = 'reach';
export const META_METRIC_PERIOD = 'day';

export interface MetaAdsInsightRow {
	insight_date: string;
	raw: Record<string, unknown>;
}

export interface MetaOrganicInsightRow {
	platform: 'facebook' | 'instagram';
	insight_date: string;
	raw: Record<string, unknown>;
}

/** `null` means no row was collected for that day, never zero. */
export interface MetaInsightsDay {
	date: string;
	spend: number | null;
	clicks: number | null;
	pageReach: number | null;
	instagramReach: number | null;
}

export interface MetaInsightsTable {
	startDate: string;
	endDate: string;
	days: MetaInsightsDay[];
	/** Spend and clicks add up across days; daily unique reach does not, so it has no total. */
	totals: { spend: number; clicks: number };
	collectedDays: number;
}

function finite(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function add(current: number | null, value: number | null): number | null {
	if (value === null) return current;
	return (current ?? 0) + value;
}

/** Builds one row per day from `startDate` to `endDate`, newest first. */
export function buildMetaInsightsTable(
	period: { startDate: string; endDate: string },
	ads: MetaAdsInsightRow[],
	organic: MetaOrganicInsightRow[],
): MetaInsightsTable {
	const byDate = new Map<string, MetaInsightsDay>();
	const cursor = new Date(`${period.startDate}T00:00:00Z`);
	const end = new Date(`${period.endDate}T00:00:00Z`);
	while (cursor <= end) {
		const date = cursor.toISOString().slice(0, 10);
		byDate.set(date, {
			date,
			spend: null,
			clicks: null,
			pageReach: null,
			instagramReach: null,
		});
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	for (const row of ads) {
		const day = byDate.get(row.insight_date);
		if (!day) continue;
		day.spend = add(day.spend, finite(row.raw.spend));
		day.clicks = add(day.clicks, finite(row.raw.clicks));
	}
	for (const row of organic) {
		const day = byDate.get(row.insight_date);
		if (!day) continue;
		if (row.platform === 'facebook') day.pageReach = finite(row.raw[META_PAGE_REACH_METRIC]);
		else day.instagramReach = finite(row.raw[META_IG_REACH_METRIC]);
	}
	const days = [...byDate.values()].reverse();
	return {
		startDate: period.startDate,
		endDate: period.endDate,
		days,
		totals: {
			spend: days.reduce((sum, day) => sum + (day.spend ?? 0), 0),
			clicks: days.reduce((sum, day) => sum + (day.clicks ?? 0), 0),
		},
		collectedDays: days.filter(
			(day) => day.spend !== null || day.pageReach !== null || day.instagramReach !== null,
		).length,
	};
}
