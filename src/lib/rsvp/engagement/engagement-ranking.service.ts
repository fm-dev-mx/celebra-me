/**
 * Administrator ranking over every published client invitation (phase 2.1).
 *
 * The database routine lists invitations with live guest aggregates (exact) and the ledger metrics
 * of their snapshot (measured since 2026-10-12). This module applies population filters, derives
 * facets from the data so new designs classify themselves, and ranks only what the comparison rules
 * allow: within one event type, eligible samples, enabled invitations, measurable conversion.
 * Spec: docs/domains/rsvp/engagement-analytics.md ("Confidence levels", "Ranking query v2").
 */
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	listInvitationEngagementRankingV2Rpc,
	type EngagementRankingV2Row,
} from '@/lib/rsvp/repositories/engagement.repository';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';
import {
	RANKING_ACTIVITY_STATES,
	RANKING_CONFIRMATION_MODES,
	RANKING_EVENT_STATUSES,
	RANKING_GROUP_KEYS,
	RANKING_METRICS,
	type ConversionMeasurability,
	type EngagementRankingReport,
	type RankingDesignGroup,
	type RankingFacets,
	type RankingFacetValue,
	type RankingFilters,
	type RankingGroupKey,
	type RankingInvitation,
	type RankingMetric,
	type RankingThresholds,
} from '@/interfaces/dashboard/engagement-ranking.interface';

/** Ledger collection start (v0.20.0-beta.1); measured figures do not exist before it. */
const ENGAGEMENT_COLLECTION_SINCE = '2026-10-12';

/** Mirrors the routine (guests) and the spec (groups); the app only withholds ranks. */
export const RANKING_THRESHOLDS: RankingThresholds = { sharedGuests: 20, groupInvitations: 5 };

const ALL_EVENT_TYPES = 'all';

export interface EngagementRankingQuery {
	eventType?: string | null;
	groupKey?: string | null;
	metric?: string | null;
	eventStatus?: string | null;
	activity?: string | null;
	fontFamily?: string | null;
	music?: string | null;
	confirmationMode?: string | null;
	includeDisabled?: string | null;
}

function includes<T extends string>(values: readonly T[], value: string): value is T {
	return (values as readonly string[]).includes(value);
}

function toNumber(value: string | number | null | undefined): number | null {
	if (value === null || value === undefined) return null;
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function nested(design: Record<string, unknown> | null, ...path: string[]): unknown {
	let current: unknown = design;
	for (const key of path) {
		if (!current || typeof current !== 'object') return null;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

function measurabilityOf(mode: string): ConversionMeasurability {
	if (mode === 'whatsapp') return 'none';
	if (mode === 'both') return 'partial';
	return 'full';
}

function toInvitation(row: EngagementRankingV2Row, groupKey: RankingGroupKey): RankingInvitation {
	const design = row.design;
	const music = nested(design, 'music', 'enabled');
	const item: RankingInvitation = {
		invitationId: row.invitation_id,
		eventId: row.event_id,
		title: row.title,
		slug: row.slug,
		eventType: row.event_type,
		eventDate: row.event_date,
		eventStatus: row.event_status,
		activityState: row.activity_state,
		publicAccess: row.public_access,
		confirmationMode: row.confirmation_mode,
		conversionMeasurability: measurabilityOf(row.confirmation_mode),
		themePreset: asString(nested(design, 'themePreset')),
		personalizedAccessVariant: asString(nested(design, 'personalizedAccessVariant')),
		rsvpAccessMode: asString(nested(design, 'rsvp', 'accessMode')),
		fontFamily: asString(nested(design, 'fontFamily')),
		musicEnabled: typeof music === 'boolean' ? music : null,
		snapshotKind: row.snapshot_kind,
		computedAt: row.computed_at,
		guestsTotal: row.guests_total,
		guestsShared: row.guests_shared,
		guestsResponded: row.guests_responded,
		guestsRespondedSelf: row.guests_responded_self,
		guestsOpened: row.guests_opened,
		guestsOpenedInferred: row.guests_opened_inferred,
		responseRate: toNumber(row.response_rate),
		// Without measured opens every inferred open is a responder, so the bound is a trivial 100 %.
		conversionUpper:
			measurabilityOf(row.confirmation_mode) === 'none' || row.guests_opened === 0
				? null
				: toNumber(row.conversion_upper),
		shareLeadDays: row.share_lead_days,
		reminderCoverage: toNumber(row.reminder_coverage),
		openRate: toNumber(row.open_rate),
		completionRate: toNumber(row.completion_rate),
		reopenRatio: toNumber(row.reopen_ratio),
		medianSecondsToOpen: toNumber(row.median_seconds_to_open),
		medianSecondsToRespond: toNumber(row.median_seconds_to_respond),
		mobileShare: toNumber(row.mobile_share),
		groupValue: null,
		sampleState: row.sample_state,
		rank: null,
	};
	return { ...item, groupValue: item[groupKey] };
}

function matchesFilters(item: RankingInvitation, filters: RankingFilters): boolean {
	if (!filters.includeDisabled && item.publicAccess === 'disabled') return false;
	if (filters.eventStatus && item.eventStatus !== filters.eventStatus) return false;
	if (filters.activity && item.activityState !== filters.activity) return false;
	if (filters.fontFamily && item.fontFamily !== filters.fontFamily) return false;
	if (filters.music === 'with' && item.musicEnabled !== true) return false;
	if (filters.music === 'without' && item.musicEnabled === true) return false;
	if (filters.confirmationMode && item.confirmationMode !== filters.confirmationMode)
		return false;
	return true;
}

function facet(
	items: readonly RankingInvitation[],
	pick: (item: RankingInvitation) => string | null,
) {
	const counts = new Map<string, number>();
	for (const item of items) {
		const value = pick(item);
		if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([value, count]): RankingFacetValue => ({ value, count }))
		.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function facetsOf(items: readonly RankingInvitation[]): RankingFacets {
	return {
		themePreset: facet(items, (item) => item.themePreset),
		personalizedAccessVariant: facet(items, (item) => item.personalizedAccessVariant),
		rsvpAccessMode: facet(items, (item) => item.rsvpAccessMode),
		fontFamily: facet(items, (item) => item.fontFamily),
		confirmationMode: facet(items, (item) => item.confirmationMode),
	};
}

/** Lower time to respond is better; every rate is better when higher. */
const LOWER_IS_BETTER: ReadonlySet<RankingMetric> = new Set(['medianSecondsToRespond']);

function compareByMetric(metric: RankingMetric) {
	const direction = LOWER_IS_BETTER.has(metric) ? 1 : -1;
	return (a: number | null, b: number | null): number => {
		if (a === null && b === null) return 0;
		if (a === null) return 1;
		if (b === null) return -1;
		return (a - b) * direction;
	};
}

export function median(values: readonly number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

const RESPONSE_METRICS: ReadonlySet<RankingMetric> = new Set(['responseRate', 'conversionUpper']);

/** Comparable for the metric: eligible sample, enabled, and the metric is measurable. */
function isComparable(item: RankingInvitation, metric: RankingMetric): boolean {
	if (item.sampleState !== 'eligible' || item.publicAccess !== 'enabled') return false;
	// Replies sent over WhatsApp never reach the database: response-based rates are understated.
	if (RESPONSE_METRICS.has(metric) && item.conversionMeasurability !== 'full') return false;
	return item[metric] !== null;
}

function medianOf(
	items: readonly RankingInvitation[],
	pick: (item: RankingInvitation) => number | null,
) {
	return median(items.map(pick).filter((value): value is number => value !== null));
}

function groupKeyOf(eventType: string, groupValue: string | null): string {
	return `${eventType}\u0000${groupValue ?? ''}`;
}

function buildGroups(
	items: readonly RankingInvitation[],
	metric: RankingMetric,
): RankingDesignGroup[] {
	const buckets = new Map<string, RankingInvitation[]>();
	for (const item of items) {
		const key = groupKeyOf(item.eventType, item.groupValue);
		buckets.set(key, [...(buckets.get(key) ?? []), item]);
	}
	const groups = [...buckets.values()].map((members): RankingDesignGroup => {
		const comparable = members.filter((item) => isComparable(item, metric));
		return {
			eventType: members[0]!.eventType,
			groupValue: members[0]!.groupValue,
			invitations: members.length,
			comparableInvitations: comparable.length,
			responseRate: medianOf(comparable, (item) => item.responseRate),
			openRate: medianOf(comparable, (item) => item.openRate),
			completionRate: medianOf(comparable, (item) => item.completionRate),
			conversionUpper: medianOf(comparable, (item) => item.conversionUpper),
			medianSecondsToRespond: medianOf(comparable, (item) => item.medianSecondsToRespond),
			shareLeadDays: medianOf(comparable, (item) => item.shareLeadDays),
			reminderCoverage: medianOf(comparable, (item) => item.reminderCoverage),
			rank: null,
		};
	});
	const compare = compareByMetric(metric);
	const ranked = (group: RankingDesignGroup) =>
		group.comparableInvitations >= RANKING_THRESHOLDS.groupInvitations ? group[metric] : null;
	groups.sort(
		(a, b) =>
			a.eventType.localeCompare(b.eventType) ||
			Number(ranked(b) !== null) - Number(ranked(a) !== null) ||
			compare(ranked(a), ranked(b)),
	);
	return withDenseRanks(groups, (group) => group.eventType, ranked);
}

/** Dense rank per event type over a sorted list: equal values share a rank. */
function withDenseRanks<T extends { rank: number | null }>(
	items: T[],
	typeOf: (item: T) => string,
	valueOf: (item: T) => number | null,
): T[] {
	let currentType: string | null = null;
	let rank = 0;
	let previous: number | null = null;
	return items.map((item) => {
		if (typeOf(item) !== currentType) {
			currentType = typeOf(item);
			rank = 0;
			previous = null;
		}
		const value = valueOf(item);
		if (value === null) return { ...item, rank: null };
		if (value !== previous) {
			rank += 1;
			previous = value;
		}
		return { ...item, rank };
	});
}

/** Builds the report from routine rows; exported for tests, the API uses `getEngagementRanking`. */
export function buildEngagementRankingReport(
	rows: readonly EngagementRankingV2Row[],
	query: {
		eventType: string;
		groupKey: RankingGroupKey;
		metric: RankingMetric;
		filters: RankingFilters;
	},
): EngagementRankingReport {
	const all = rows.map((row) => toInvitation(row, query.groupKey));
	const listed = all.filter((item) => matchesFilters(item, query.filters));
	const designs = buildGroups(listed, query.metric);
	const compare = compareByMetric(query.metric);
	// Invitations rank within their event type on their own sample; the five-invitation rule
	// applies to design-group comparisons only.
	const rankValue = (item: RankingInvitation) =>
		isComparable(item, query.metric) ? item[query.metric] : null;
	const sorted = [...listed].sort(
		(a, b) =>
			a.eventType.localeCompare(b.eventType) ||
			Number(isComparable(b, query.metric)) - Number(isComparable(a, query.metric)) ||
			compare(a[query.metric], b[query.metric]) ||
			a.slug.localeCompare(b.slug),
	);
	return {
		eventType: query.eventType,
		groupKey: query.groupKey,
		metric: query.metric,
		filters: query.filters,
		since: ENGAGEMENT_COLLECTION_SINCE,
		thresholds: RANKING_THRESHOLDS,
		facets: facetsOf(all),
		totals: { listed: listed.length, total: all.length },
		designs,
		invitations: withDenseRanks(sorted, (item) => item.eventType, rankValue),
	};
}

function optionalEnum<T extends string>(
	value: string | null | undefined,
	allowed: readonly T[],
	label: string,
): T | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	if (!includes(allowed, trimmed)) throw new ApiError(400, 'bad_request', `${label} inválido.`);
	return trimmed;
}

/** Validates the admin query; unknown values are rejected before any read. */
export function parseEngagementRankingQuery(query: EngagementRankingQuery) {
	const eventType = query.eventType?.trim() || ALL_EVENT_TYPES;
	if (eventType !== ALL_EVENT_TYPES && !includes(EVENT_TYPES, eventType)) {
		throw new ApiError(400, 'bad_request', 'Tipo de evento inválido.');
	}
	const groupKey =
		optionalEnum(query.groupKey, RANKING_GROUP_KEYS, 'Agrupación') ?? 'themePreset';
	const metric = optionalEnum(query.metric, RANKING_METRICS, 'Métrica') ?? 'responseRate';
	const music = optionalEnum(query.music, ['with', 'without'] as const, 'Filtro de música');
	const fontFamily = query.fontFamily?.trim() || undefined;
	if (fontFamily && fontFamily.length > 80) {
		throw new ApiError(400, 'bad_request', 'Tipografía inválida.');
	}
	const includeDisabled = query.includeDisabled?.trim();
	if (includeDisabled && includeDisabled !== 'true' && includeDisabled !== 'false') {
		throw new ApiError(400, 'bad_request', 'Filtro de acceso inválido.');
	}
	const filters: RankingFilters = {
		eventStatus: optionalEnum(query.eventStatus, RANKING_EVENT_STATUSES, 'Estado del evento'),
		activity: optionalEnum(query.activity, RANKING_ACTIVITY_STATES, 'Actividad'),
		fontFamily,
		music,
		confirmationMode: optionalEnum(
			query.confirmationMode,
			RANKING_CONFIRMATION_MODES,
			'Modo de confirmación',
		),
		includeDisabled: includeDisabled === 'true',
	};
	return { eventType, groupKey, metric, filters };
}

/** Validates the admin query, reads the routine and builds the report. */
export async function getEngagementRanking(
	query: EngagementRankingQuery,
): Promise<EngagementRankingReport> {
	const parsed = parseEngagementRankingQuery(query);
	let rows: EngagementRankingV2Row[];
	try {
		rows = await listInvitationEngagementRankingV2Rpc(
			parsed.eventType === ALL_EVENT_TYPES ? null : parsed.eventType,
		);
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
	return buildEngagementRankingReport(rows, parsed);
}
