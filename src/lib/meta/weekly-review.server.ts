/** Server-only. Never stores Graph bodies, credentials, or commercial identity fields. */
import { MetaGraphClient } from './graph-client';
import { loadMetaInsightsTable } from './insights-dashboard.server';
import {
	metaWeeklyReviewSchema,
	metaReviewWeek,
	metaReviewNeedsAttention,
	normalizeMetaQuality,
	type MetaWeeklyReview,
} from './weekly-review';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { loadCommercialDashboardData } from '@/lib/tracking/commercial-dashboard.server';
import { buildCommercialDashboardViewModel } from '@/lib/tracking/commercial-dashboard';
import { commercialPeriod } from '@/lib/tracking/commercial-period';
import { getEnv } from '@/lib/server/env';
import { readDeployEnvironment } from '@/lib/server/deploy-identity';

export const META_REVIEW_PIXEL = '1348260657445453';
const WINDOW = 'weekly_review_v1';
// Same aggregate snapshot convention as the monthly estimated lead value calculation.
const FILTER = `account_id=eq.meta_commercial&level=eq.campaign&object_id=eq.weekly_review_${META_REVIEW_PIXEL}&attribution_window=eq.${WINDOW}`;

export async function loadMetaWeeklyReview(): Promise<MetaWeeklyReview | null> {
	const rows = await supabaseRestRequest<{ raw: unknown }[]>({
		pathWithQuery: `meta_ads_insights_daily?select=raw&${FILTER}&order=insight_date.desc&limit=1`,
		useServiceRole: true,
	});
	if (!rows.length) return null;
	return metaWeeklyReviewSchema.parse(rows[0].raw);
}

async function save(report: MetaWeeklyReview): Promise<void> {
	await supabaseRestRequest<unknown>({
		pathWithQuery:
			'meta_ads_insights_daily?on_conflict=account_id,level,object_id,insight_date,attribution_window',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=merge-duplicates,return=minimal',
		body: [
			{
				account_id: 'meta_commercial',
				level: 'campaign',
				object_id: `weekly_review_${META_REVIEW_PIXEL}`,
				insight_date: report.endDate,
				attribution_window: WINDOW,
				raw: report,
				collected_at: report.generatedAt,
			},
		],
	});
}

async function generate(now: Date, fetchImpl?: typeof fetch): Promise<MetaWeeklyReview> {
	const week = metaReviewWeek(commercialPeriod(30, now).endDate);
	// Each source is independent; failures are unknown rather than healthy or zero.
	const [insights, quality, commercial] = await Promise.allSettled([
		loadMetaInsightsTable(now),
		(async () => {
			const client = new MetaGraphClient({
				accessToken: getEnv('META_DATASET_QUALITY_ACCESS_TOKEN'),
				fetchImpl,
			});
			return normalizeMetaQuality(await client.datasetQuality(META_REVIEW_PIXEL));
		})(),
		loadCommercialDashboardData(),
	]);
	const days =
		insights.status === 'fulfilled'
			? insights.value.days.filter(
					(day) => day.date >= week.startDate && day.date <= week.endDate,
				)
			: null;
	const summary = commercial.status === 'fulfilled' ? commercial.value : null;
	return metaWeeklyReviewSchema.parse({
		version: 1,
		...week,
		generatedAt: now.toISOString(),
		notice: 'pending',
		quality: quality.status === 'fulfilled' ? quality.value : null,
		insights: days
			? {
					spend: days.reduce((total, day) => total + (day.spend ?? 0), 0),
					clicks: days.reduce((total, day) => total + (day.clicks ?? 0), 0),
					adsDays: days.filter((day) => day.spend !== null && day.clicks !== null).length,
					pageDays: days.filter((day) => day.pageReach !== null).length,
					instagramDays: days.filter((day) => day.instagramReach !== null).length,
				}
			: null,
		commercial: summary
			? {
					capiStatus: buildCommercialDashboardViewModel(summary, {
						capiDeliveryMode: getEnv('META_CAPI_DELIVERY_MODE'),
					}).health.capi.status,
					pending: summary.conversionStatusCounts.pending,
					failed: summary.conversionStatusCounts.failed,
					ambiguous: summary.conversionStatusCounts.ambiguous,
					leads: summary.totals.leads,
					orders: summary.sales.orders,
				}
			: null,
	});
}

async function notify(
	report: MetaWeeklyReview,
	fetchImpl: typeof fetch,
): Promise<MetaWeeklyReview['notice']> {
	const target = getEnv('META_WEEKLY_REVIEW_WEBHOOK_URL');
	if (!target.trim()) return 'unconfigured';
	try {
		const url = new URL(target);
		if (url.protocol !== 'https:' || url.username || url.password || url.hash) return 'failed';
		const response = await fetchImpl(url.href, {
			method: 'POST',
			redirect: 'manual',
			signal: AbortSignal.timeout(10_000),
			headers: {
				'Content-Type': 'application/json',
				'Idempotency-Key': `meta-weekly-review:${META_REVIEW_PIXEL}:${report.endDate}`,
			},
			body: JSON.stringify({
				event: 'meta_weekly_review',
				week: report.endDate,
				message: 'Su revisión semanal de Meta está disponible en el panel comercial.',
				needsAttention: metaReviewNeedsAttention(report),
				path: '/dashboard/commercial',
			}),
		});
		await response.body?.cancel();
		return response.ok ? 'sent' : 'failed';
	} catch {
		return 'failed';
	}
}

/** Daily cron checks for one report per completed week; failed notices retry the next day. */
export async function runMetaWeeklyReview(
	options: { now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<'completed' | 'failed' | 'skipped'> {
	if (readDeployEnvironment() !== 'production') return 'skipped';
	try {
		const now = options.now ?? new Date();
		const week = metaReviewWeek(commercialPeriod(30, now).endDate);
		let report = await loadMetaWeeklyReview();
		if (!report || report.endDate !== week.endDate) {
			report = await generate(now, options.fetchImpl);
			await save(report); // Never send a notice before the panel can read the report.
		}
		if (report.notice === 'sent') return 'skipped';
		report.notice = await notify(report, options.fetchImpl ?? fetch.bind(globalThis));
		await save(report);
		console.info(
			JSON.stringify({
				event: 'meta_weekly_review',
				week: report.endDate,
				notice: report.notice,
				needsAttention: metaReviewNeedsAttention(report),
			}),
		);
		if (report.notice === 'unconfigured') return 'skipped';
		return report.notice === 'sent' ? 'completed' : 'failed';
	} catch {
		console.error('[meta-weekly-review] failed');
		return 'failed';
	}
}
