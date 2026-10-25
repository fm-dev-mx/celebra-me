/** Server-only: reads service-role tables. Never import from a client island. */
import {
	META_ADS_ATTRIBUTION_WINDOW,
	META_METRIC_PERIOD,
	buildMetaInsightsTable,
	type MetaAdsInsightRow,
	type MetaInsightsTable,
	type MetaOrganicInsightRow,
} from '@/lib/meta/insights-dashboard';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { commercialPeriod } from '@/lib/tracking/commercial-period';

const ADS_ROW_LIMIT = 1000;

/** Last 30 completed days; 1000 rows (the PostgREST page cap) fits 33 active campaigns a day. */
export async function loadMetaInsightsTable(now = new Date()): Promise<MetaInsightsTable> {
	const period = commercialPeriod(30, now);
	const range = `insight_date=gte.${period.startDate}&insight_date=lte.${period.endDate}`;
	const [ads, organic] = await Promise.all([
		supabaseRestRequest<MetaAdsInsightRow[]>({
			pathWithQuery: `meta_ads_insights_daily?select=insight_date,raw&attribution_window=eq.${META_ADS_ATTRIBUTION_WINDOW}&${range}&limit=${ADS_ROW_LIMIT}`,
			useServiceRole: true,
		}),
		supabaseRestRequest<MetaOrganicInsightRow[]>({
			pathWithQuery: `meta_organic_insights_daily?select=platform,insight_date,raw&metric_period=eq.${META_METRIC_PERIOD}&${range}&limit=200`,
			useServiceRole: true,
		}),
	]);
	// A full page may hide more rows; show the table as unavailable rather than partial totals.
	if (ads.length >= ADS_ROW_LIMIT) throw new RangeError('Meta ads insights exceed one page');
	return buildMetaInsightsTable(period, ads, organic);
}
