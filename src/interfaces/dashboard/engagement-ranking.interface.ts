/**
 * Administrator ranking over every published client invitation (phase 2.1).
 * Shared by the admin API and the dashboard panel. No guest data ever travels here.
 * Spec: docs/domains/rsvp/engagement-analytics.md ("Confidence levels", "Ranking query v2").
 */

/** Grouping keys: the only design attributes that separate invitations today. */
export const RANKING_GROUP_KEYS = [
	'themePreset',
	'personalizedAccessVariant',
	'rsvpAccessMode',
] as const;
export type RankingGroupKey = (typeof RANKING_GROUP_KEYS)[number];

/**
 * Sortable metrics. `responseRate` is exact for every invitation and the default.
 * `conversionUpper` is an upper bound; `reopen_ratio` never ranks (spec).
 */
export const RANKING_METRICS = [
	'responseRate',
	'openRate',
	'completionRate',
	'conversionUpper',
	'medianSecondsToRespond',
] as const;
export type RankingMetric = (typeof RANKING_METRICS)[number];

export const RANKING_EVENT_STATUSES = ['upcoming', 'past', 'unknown'] as const;
export type RankingEventStatus = (typeof RANKING_EVENT_STATUSES)[number];

export const RANKING_ACTIVITY_STATES = ['measured', 'none'] as const;
export type RankingActivityState = (typeof RANKING_ACTIVITY_STATES)[number];

export const RANKING_CONFIRMATION_MODES = ['api', 'whatsapp', 'both'] as const;
type RankingConfirmationMode = (typeof RANKING_CONFIRMATION_MODES)[number];

/** Whether guest responses reach the database, so conversion can be measured. */
export type ConversionMeasurability = 'full' | 'partial' | 'none';

type RankingSampleState = 'eligible' | 'insufficient';

/** Population filters; every field is optional and filters combine (AND). */
export interface RankingFilters {
	eventStatus?: RankingEventStatus;
	activity?: RankingActivityState;
	fontFamily?: string;
	music?: 'with' | 'without';
	confirmationMode?: RankingConfirmationMode;
	includeDisabled?: boolean;
}

export interface RankingThresholds {
	/** Shared guests an invitation needs before its rates are compared. */
	sharedGuests: number;
	/** Comparable invitations a design group needs before it is ranked. */
	groupInvitations: number;
}

export interface RankingFacetValue {
	value: string;
	count: number;
}

/** Filter and grouping values present in the data, so new designs classify themselves. */
export interface RankingFacets {
	themePreset: RankingFacetValue[];
	personalizedAccessVariant: RankingFacetValue[];
	rsvpAccessMode: RankingFacetValue[];
	fontFamily: RankingFacetValue[];
	confirmationMode: RankingFacetValue[];
}

export interface RankingInvitation {
	invitationId: string;
	eventId: string | null;
	title: string;
	slug: string;
	eventType: string;
	eventDate: string | null;
	eventStatus: RankingEventStatus;
	activityState: RankingActivityState;
	publicAccess: 'enabled' | 'disabled';
	confirmationMode: string;
	conversionMeasurability: ConversionMeasurability;
	themePreset: string | null;
	personalizedAccessVariant: string | null;
	rsvpAccessMode: string | null;
	fontFamily: string | null;
	musicEnabled: boolean | null;
	snapshotKind: 'rolling' | 'final' | null;
	computedAt: string | null;
	/** Live counts (exact). */
	guestsTotal: number;
	guestsShared: number;
	guestsResponded: number;
	guestsRespondedSelf: number;
	guestsOpened: number;
	guestsOpenedInferred: number;
	responseRate: number | null;
	conversionUpper: number | null;
	shareLeadDays: number | null;
	reminderCoverage: number | null;
	/** Ledger metrics (measured, since 2026-10-12); null without activity. */
	openRate: number | null;
	completionRate: number | null;
	reopenRatio: number | null;
	medianSecondsToOpen: number | null;
	medianSecondsToRespond: number | null;
	mobileShare: number | null;
	groupValue: string | null;
	sampleState: RankingSampleState;
	/** Dense rank within the event type and ranked groups; null otherwise. */
	rank: number | null;
}

export interface RankingDesignGroup {
	eventType: string;
	/** Design attribute value; null when the invitation carries no value for the key. */
	groupValue: string | null;
	invitations: number;
	comparableInvitations: number;
	/** Medians over comparable invitations only; null when none is comparable. */
	responseRate: number | null;
	openRate: number | null;
	completionRate: number | null;
	conversionUpper: number | null;
	medianSecondsToRespond: number | null;
	shareLeadDays: number | null;
	reminderCoverage: number | null;
	/** Dense rank within the event type among groups that meet the thresholds. */
	rank: number | null;
}

export interface EngagementRankingReport {
	/** An event type, or `all`: listing spans types, ranks stay within each type. */
	eventType: string;
	groupKey: RankingGroupKey;
	metric: RankingMetric;
	filters: RankingFilters;
	/** Measured collection start: no ledger activity exists before this date. */
	since: string;
	thresholds: RankingThresholds;
	facets: RankingFacets;
	/** Invitations listed after filters, and published client invitations of the type. */
	totals: { listed: number; total: number };
	designs: RankingDesignGroup[];
	invitations: RankingInvitation[];
}
