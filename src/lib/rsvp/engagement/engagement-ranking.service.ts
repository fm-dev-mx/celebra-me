/**
 * Administrator ranking over permanent engagement snapshots (phase 2).
 *
 * The database routine decides the sample (same event type, final over rolling, 20-guest
 * threshold, group sizes). This module turns those rows into the report the admin panel renders:
 * per-invitation rows sorted by the requested metric and per-design groups with medians, ranking
 * only what the comparison rules allow. It never touches guest data.
 * Spec: docs/domains/rsvp/engagement-analytics.md ("Comparison rules", "Ranking query").
 */
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	listInvitationEngagementRankingRpc,
	type EngagementRankingRow,
} from '@/lib/rsvp/repositories/engagement.repository';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import { EVENT_TYPES, type EventType } from '@/lib/theme/theme-contract';
import {
	RANKING_GROUP_KEYS,
	RANKING_METRICS,
	type EngagementRankingReport,
	type RankingDesignGroup,
	type RankingGroupKey,
	type RankingInvitation,
	type RankingMetric,
	type RankingThresholds,
} from '@/interfaces/dashboard/engagement-ranking.interface';

/** Engagement collection started with v0.20.0-beta.1; nothing exists before this date. */
const ENGAGEMENT_COLLECTION_SINCE = '2026-10-12';

/** Mirrors the routine (guests) and the spec (groups); the app only withholds ranks. */
export const RANKING_THRESHOLDS: RankingThresholds = { sharedGuests: 20, groupInvitations: 5 };

export interface EngagementRankingQuery {
	eventType: string;
	groupKey?: string;
	metric?: string;
}

function isRankingGroupKey(value: string): value is RankingGroupKey {
	return (RANKING_GROUP_KEYS as readonly string[]).includes(value);
}

function isRankingMetric(value: string): value is RankingMetric {
	return (RANKING_METRICS as readonly string[]).includes(value);
}

function isEventType(value: string): value is EventType {
	return (EVENT_TYPES as readonly string[]).includes(value);
}

function toNumber(value: string | number | null | undefined): number | null {
	if (value === null || value === undefined) return null;
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

/** Lower time to respond is better; every rate is better when higher. */
const LOWER_IS_BETTER: ReadonlySet<RankingMetric> = new Set(['medianSecondsToRespond']);

function metricOf(
	row: Pick<
		RankingInvitation,
		'openRate' | 'completionRate' | 'rsvpConversion' | 'medianSecondsToRespond'
	>,
	metric: RankingMetric,
): number | null {
	return row[metric];
}

/** Sorts by metric with nulls last; ties keep the incoming order. */
function compareByMetric(metric: RankingMetric) {
	const direction = LOWER_IS_BETTER.has(metric) ? 1 : -1;
	return (a: number | null, b: number | null): number => {
		if (a === null && b === null) return 0;
		if (a === null) return 1;
		if (b === null) return -1;
		return (a - b) * direction;
	};
}

/** Dense rank over an already sorted list: equal metric values share a rank. */
function assignDenseRanks<T>(
	items: T[],
	metricValue: (item: T) => number | null,
	assign: (item: T, rank: number | null) => T,
): T[] {
	let rank = 0;
	let previous: number | null | undefined;
	return items.map((item) => {
		const value = metricValue(item);
		if (value === null) return assign(item, null);
		if (value !== previous) {
			rank += 1;
			previous = value;
		}
		return assign(item, rank);
	});
}

export function median(values: readonly number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function toInvitation(row: EngagementRankingRow): RankingInvitation {
	return {
		eventId: row.event_id,
		invitationProjectId: row.invitation_project_id,
		title: row.title,
		slug: row.slug,
		eventDate: row.event_date,
		eventDeleted: row.event_deleted,
		snapshotKind: row.snapshot_kind,
		computedAt: row.computed_at,
		guestsTotal: row.guests_total,
		guestsShared: row.guests_shared,
		guestsOpened: row.guests_opened,
		guestsResponded: row.guests_responded,
		opensTotal: row.opens_total,
		openRate: toNumber(row.open_rate),
		completionRate: toNumber(row.completion_rate),
		rsvpConversion: toNumber(row.rsvp_conversion),
		reopenRatio: toNumber(row.reopen_ratio),
		medianSecondsToOpen: toNumber(row.median_seconds_to_open),
		medianSecondsToRespond: toNumber(row.median_seconds_to_respond),
		mobileShare: toNumber(row.mobile_share),
		shareLeadDays: row.share_lead_days,
		reminderCoverage: toNumber(row.reminder_coverage),
		groupValue: row.group_value,
		sampleState: row.sample_state,
		rank: null,
	};
}

function medianOf(
	items: readonly RankingInvitation[],
	pick: (item: RankingInvitation) => number | null,
) {
	return median(items.map(pick).filter((value): value is number => value !== null));
}

/** Builds the report from routine rows; exported for tests, the API uses `getEngagementRanking`. */
export function buildEngagementRankingReport(
	rows: readonly EngagementRankingRow[],
	query: { eventType: string; groupKey: RankingGroupKey; metric: RankingMetric },
): EngagementRankingReport {
	const compare = compareByMetric(query.metric);
	const invitations = rows.map(toInvitation);

	// Design groups: medians over eligible invitations; rank only groups that meet the thresholds.
	const byGroup = new Map<string | null, RankingInvitation[]>();
	for (const item of invitations) {
		const bucket = byGroup.get(item.groupValue) ?? [];
		bucket.push(item);
		byGroup.set(item.groupValue, bucket);
	}
	const groups: RankingDesignGroup[] = [...byGroup.entries()].map(([groupValue, members]) => {
		const eligible = members.filter((item) => item.sampleState === 'eligible');
		return {
			groupValue,
			invitations: members.length,
			eligibleInvitations: eligible.length,
			openRate: medianOf(eligible, (item) => item.openRate),
			completionRate: medianOf(eligible, (item) => item.completionRate),
			rsvpConversion: medianOf(eligible, (item) => item.rsvpConversion),
			medianSecondsToRespond: medianOf(eligible, (item) => item.medianSecondsToRespond),
			shareLeadDays: medianOf(eligible, (item) => item.shareLeadDays),
			reminderCoverage: medianOf(eligible, (item) => item.reminderCoverage),
			rank: null,
		};
	});
	const rankedGroupValues = new Set(
		groups
			.filter((group) => group.eligibleInvitations >= RANKING_THRESHOLDS.groupInvitations)
			.map((group) => group.groupValue),
	);
	const groupMetric = (group: RankingDesignGroup) =>
		rankedGroupValues.has(group.groupValue) ? metricOf(group, query.metric) : null;
	groups.sort((a, b) => {
		const rankable =
			Number(rankedGroupValues.has(b.groupValue)) -
			Number(rankedGroupValues.has(a.groupValue));
		return rankable !== 0 ? rankable : compare(groupMetric(a), groupMetric(b));
	});
	const designs = assignDenseRanks(groups, groupMetric, (group, rank) => ({ ...group, rank }));

	// Invitations: eligible rows of ranked groups carry a rank; everything else is listed unranked.
	const invitationMetric = (item: RankingInvitation) =>
		item.sampleState === 'eligible' && rankedGroupValues.has(item.groupValue)
			? metricOf(item, query.metric)
			: null;
	invitations.sort((a, b) => {
		const eligible =
			Number(b.sampleState === 'eligible') - Number(a.sampleState === 'eligible');
		return eligible !== 0
			? eligible
			: compare(metricOf(a, query.metric), metricOf(b, query.metric));
	});
	const rankedInvitations = assignDenseRanks(invitations, invitationMetric, (item, rank) => ({
		...item,
		rank,
	}));

	return {
		eventType: query.eventType,
		groupKey: query.groupKey,
		metric: query.metric,
		since: ENGAGEMENT_COLLECTION_SINCE,
		thresholds: RANKING_THRESHOLDS,
		designs,
		invitations: rankedInvitations,
	};
}

/** Validates the admin query, reads the routine and builds the report. */
export async function getEngagementRanking(
	query: EngagementRankingQuery,
): Promise<EngagementRankingReport> {
	const eventType = query.eventType.trim();
	if (!isEventType(eventType)) {
		throw new ApiError(400, 'bad_request', 'Tipo de evento inválido.');
	}
	const groupKey = query.groupKey?.trim() || 'themePreset';
	if (!isRankingGroupKey(groupKey)) {
		throw new ApiError(400, 'bad_request', 'Agrupación inválida.');
	}
	const metric = query.metric?.trim() || 'rsvpConversion';
	if (!isRankingMetric(metric)) {
		throw new ApiError(400, 'bad_request', 'Métrica inválida.');
	}
	let rows: EngagementRankingRow[];
	try {
		rows = await listInvitationEngagementRankingRpc(eventType, groupKey);
	} catch (error) {
		// Additive migration not applied yet in this environment: the routine is simply absent.
		if (
			error instanceof SupabaseHttpError &&
			(error.code === 'PGRST202' || error.status === 404)
		) {
			throw new ApiError(
				503,
				'service_unavailable',
				'El ranking todavía no está disponible.',
			);
		}
		throw error;
	}
	return buildEngagementRankingReport(rows, { eventType, groupKey, metric });
}
