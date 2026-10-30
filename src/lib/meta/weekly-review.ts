/** Aggregate-only contract shared by the weekly job and the server-rendered panel. */
import { z } from 'zod';

const percent = z.number().min(0).max(100).nullable();
export const metaQualityEventSchema = z.object({
	event: z.string().regex(/^[A-Za-z][A-Za-z0-9_ ]{0,79}$/),
	emq: z.number().min(0).max(10).nullable(),
	coverage: percent,
	browserKeys: percent,
	serverKeys: percent,
	dedupCoverage: percent,
});
export type MetaQualityEvent = z.infer<typeof metaQualityEventSchema>;
export const metaWeeklyReviewSchema = z.object({
	version: z.literal(1),
	startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	generatedAt: z.iso.datetime(),
	quality: z.array(metaQualityEventSchema).max(100).nullable(),
	insights: z
		.object({
			spend: z.number().nonnegative(),
			clicks: z.number().nonnegative(),
			adsDays: z.number().int().min(0).max(7),
			pageDays: z.number().int().min(0).max(7),
			instagramDays: z.number().int().min(0).max(7),
		})
		.nullable(),
	commercial: z
		.object({
			capiStatus: z.enum(['correct', 'attention', 'error', 'safe-disabled']),
			pending: z.number().int().nonnegative(),
			failed: z.number().int().nonnegative(),
			ambiguous: z.number().int().nonnegative(),
			leads: z.number().int().nonnegative(),
			orders: z.number().int().nonnegative(),
		})
		.nullable(),
	notice: z.enum(['pending', 'sent', 'unconfigured', 'failed']),
});
export type MetaWeeklyReview = z.infer<typeof metaWeeklyReviewSchema>;

/** A missing metric is unknown, including malformed and out-of-range provider values. */
function metric(value: unknown, max: number): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
		? value
		: null;
}
function record(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}
export function normalizeMetaQuality(rows: Record<string, unknown>[]): MetaQualityEvent[] {
	if (rows.length > 100) throw new RangeError('Too many dataset quality events');
	return rows.map((row) => {
		const feedback = Array.isArray(row.dedupe_key_feedback)
			? row.dedupe_key_feedback.map(record).find((key) => key.dedupe_key === 'event_id')
			: undefined;
		return metaQualityEventSchema.parse({
			event: row.event_name,
			emq: metric(record(row.event_match_quality).composite_score, 10),
			coverage: metric(record(row.event_coverage).percentage, 100),
			browserKeys: metric(record(feedback?.browser_events_with_dedupe_key).percentage, 100),
			serverKeys: metric(record(feedback?.server_events_with_dedupe_key).percentage, 100),
			dedupCoverage: metric(
				record(feedback?.overall_browser_coverage_from_dedupe_key).percentage,
				100,
			),
		});
	});
}

/** Calendar week Monday–Sunday, anchored to the last completed commercial day. */
export function metaReviewWeek(lastCompletedDay: string) {
	const end = new Date(`${lastCompletedDay}T00:00:00Z`);
	end.setUTCDate(end.getUTCDate() - end.getUTCDay());
	const start = new Date(end);
	start.setUTCDate(start.getUTCDate() - 6);
	return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export function metaReviewNeedsAttention(report: MetaWeeklyReview): boolean {
	return (
		!report.insights ||
		report.insights.adsDays < 7 ||
		report.insights.pageDays < 7 ||
		report.insights.instagramDays < 7 ||
		!report.quality?.length ||
		report.quality.some((event) =>
			Object.entries(event).some(([key, value]) => key !== 'event' && value === null),
		) ||
		report.quality.some(
			(event) =>
				(event.emq !== null && event.emq < 6) ||
				(event.coverage !== null && event.coverage < 75) ||
				(event.dedupCoverage !== null && event.dedupCoverage < 75),
		) ||
		!report.commercial ||
		report.commercial.capiStatus !== 'correct'
	);
}
