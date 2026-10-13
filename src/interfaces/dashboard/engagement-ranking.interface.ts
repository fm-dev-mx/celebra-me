/**
 * Administrator ranking over permanent engagement snapshots (phase 2).
 * Shared by the admin API and the dashboard panel. No guest data ever travels here.
 * Spec: docs/domains/rsvp/engagement-analytics.md ("Ranking query (phase 2)").
 */

export const RANKING_GROUP_KEYS = [
	'themePreset',
	'templateId',
	'fontFamily',
	'visualProfileId',
	'personalizedAccessVariant',
	'rsvpConfirmationMode',
	'rsvpAccessMode',
	'musicEnabled',
] as const;
export type RankingGroupKey = (typeof RANKING_GROUP_KEYS)[number];

/** Sortable metrics. `reopen_ratio` is deliberately absent: the spec forbids ranking on it. */
export const RANKING_METRICS = [
	'rsvpConversion',
	'openRate',
	'completionRate',
	'medianSecondsToRespond',
] as const;
export type RankingMetric = (typeof RANKING_METRICS)[number];

type RankingSampleState = 'eligible' | 'insufficient';

export interface RankingThresholds {
	/** Shared guests an invitation needs before its rates are compared. */
	sharedGuests: number;
	/** Eligible invitations a design group needs before it is ranked. */
	groupInvitations: number;
}

export interface RankingInvitation {
	eventId: string | null;
	invitationProjectId: string | null;
	title: string | null;
	slug: string | null;
	eventDate: string | null;
	eventDeleted: boolean;
	snapshotKind: 'rolling' | 'final';
	computedAt: string;
	guestsTotal: number;
	guestsShared: number;
	guestsOpened: number;
	guestsResponded: number;
	opensTotal: number;
	openRate: number | null;
	completionRate: number | null;
	rsvpConversion: number | null;
	reopenRatio: number | null;
	medianSecondsToOpen: number | null;
	medianSecondsToRespond: number | null;
	mobileShare: number | null;
	shareLeadDays: number | null;
	reminderCoverage: number | null;
	groupValue: string | null;
	sampleState: RankingSampleState;
	/** Dense rank among eligible invitations of ranked groups; null otherwise. */
	rank: number | null;
}

export interface RankingDesignGroup {
	/** Design attribute value; null when the snapshot carried no design data. */
	groupValue: string | null;
	invitations: number;
	eligibleInvitations: number;
	/** Medians over eligible invitations only; null when none is eligible. */
	openRate: number | null;
	completionRate: number | null;
	rsvpConversion: number | null;
	medianSecondsToRespond: number | null;
	shareLeadDays: number | null;
	reminderCoverage: number | null;
	/** Dense rank by the requested metric among groups that meet the thresholds. */
	rank: number | null;
}

export interface EngagementRankingReport {
	eventType: string;
	groupKey: RankingGroupKey;
	metric: RankingMetric;
	/** Collection start: no engagement exists before this date. */
	since: string;
	thresholds: RankingThresholds;
	designs: RankingDesignGroup[];
	invitations: RankingInvitation[];
}
