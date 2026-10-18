import { supabaseRestRequest } from './supabase';
import type { DashboardEngagementSummary } from '@/interfaces/dashboard/guest.interface';
import type { DeviceClass, ServerTrafficClass } from '@/lib/rsvp/engagement/taxonomy';

/** One event in the snake_case shape record_guest_engagement_events_public expects. */
export interface EngagementEventRow {
	client_event_id: string;
	schema_version: number;
	event_name: string;
	occurred_at: string;
	page_view_id: string | null;
	traffic_class: ServerTrafficClass;
	device_class: DeviceClass;
	properties: Record<string, unknown>;
}

export type EngagementRecordResult =
	| { status: 'ok'; accepted: number; duplicates: number; rejected: number }
	| { status: 'not_found' };

export async function recordGuestEngagementEventsRpc(
	inviteId: string,
	events: EngagementEventRow[],
	viewerUserId: string | null,
): Promise<EngagementRecordResult> {
	return await supabaseRestRequest<EngagementRecordResult>({
		pathWithQuery: 'rpc/record_guest_engagement_events_public',
		method: 'POST',
		useServiceRole: true,
		body: {
			p_invite_id: inviteId,
			p_events: events,
			p_viewer_user_id: viewerUserId,
		},
	});
}

/** Host funnel under RLS (security invoker): the host token decides which guests count. */
export async function getEventEngagementSummary(
	eventId: string,
	hostAccessToken: string,
): Promise<DashboardEngagementSummary> {
	const summary = await supabaseRestRequest<DashboardEngagementSummary>({
		pathWithQuery: 'rpc/get_event_engagement_summary',
		method: 'POST',
		authToken: hostAccessToken,
		body: { p_event_id: eventId },
	});
	return {
		...summary,
		medianSecondsToOpen:
			summary.medianSecondsToOpen === null ? null : Number(summary.medianSecondsToOpen),
	};
}

export interface EngagementSnapshotCandidate {
	event_id: string;
	invitation_project_id: string | null;
	snapshot_kind: 'rolling' | 'final';
}

export async function listEngagementSnapshotCandidatesRpc(): Promise<
	EngagementSnapshotCandidate[]
> {
	return await supabaseRestRequest<EngagementSnapshotCandidate[]>({
		pathWithQuery: 'rpc/list_engagement_snapshot_candidates',
		method: 'POST',
		useServiceRole: true,
		body: {},
	});
}

export async function computeInvitationEngagementSnapshotRpc(
	eventId: string,
	kind: 'rolling' | 'final',
	design: Record<string, unknown> | null,
	designSchemaVersion: number | null,
): Promise<{ status: 'ok' | 'unchanged' | 'not_found' }> {
	return await supabaseRestRequest<{ status: 'ok' | 'unchanged' | 'not_found' }>({
		pathWithQuery: 'rpc/compute_invitation_engagement_snapshot',
		method: 'POST',
		useServiceRole: true,
		body: {
			p_event_id: eventId,
			p_kind: kind,
			p_design: design,
			p_design_schema_version: designSchemaVersion,
		},
	});
}

export async function anonymizeGuestEngagementEventsRpc(batchSize: number): Promise<number> {
	return await supabaseRestRequest<number>({
		pathWithQuery: 'rpc/anonymize_guest_engagement_events',
		method: 'POST',
		useServiceRole: true,
		body: { p_batch: batchSize },
	});
}

/** Raw row of list_invitation_engagement_ranking_v2; numerics arrive as strings from PostgREST. */
export interface EngagementRankingV2Row {
	invitation_id: string;
	event_id: string | null;
	title: string;
	slug: string;
	event_type: string;
	event_date: string | null;
	event_status: 'upcoming' | 'past' | 'unknown';
	activity_state: 'measured' | 'none';
	public_access: 'enabled' | 'disabled';
	confirmation_mode: string;
	design: Record<string, unknown> | null;
	snapshot_kind: 'rolling' | 'final' | null;
	computed_at: string | null;
	guests_total: number;
	guests_shared: number;
	guests_responded: number;
	guests_responded_self: number;
	guests_opened: number;
	guests_opened_inferred: number;
	response_rate: string | number | null;
	conversion_upper: string | number | null;
	open_rate: string | number | null;
	completion_rate: string | number | null;
	reopen_ratio: string | number | null;
	median_seconds_to_open: string | number | null;
	median_seconds_to_respond: string | number | null;
	mobile_share: string | number | null;
	share_lead_days: number | null;
	reminder_coverage: string | number | null;
	sample_state: 'eligible' | 'insufficient';
}

/** Admin-only ranking v2 rows (service role): every published client invitation. */
export async function listInvitationEngagementRankingV2Rpc(
	eventType: string | null,
): Promise<EngagementRankingV2Row[]> {
	return await supabaseRestRequest<EngagementRankingV2Row[]>({
		pathWithQuery: 'rpc/list_invitation_engagement_ranking_v2',
		method: 'POST',
		useServiceRole: true,
		body: { p_event_type: eventType },
	});
}

/** Historical estimate rows (service role): legacy telemetry cleaned per method version. */
export interface HistoricalEstimateRow {
	invitation_id: string;
	event_id: string;
	title: string;
	slug: string;
	event_type: string;
	event_date: string | null;
	method_version: number;
	computed_at: string;
	guests_total: number;
	guests_shared: number;
	guests_viewed: number;
	guests_responded_self: number;
	opened_lower: number;
	opened_upper: number;
	visits_estimate: number;
	visits_per_viewer: string | number | null;
	conversion_lower: string | number | null;
	views_counted: number;
	views_before_share: number;
	views_within_preview_window: number;
	guests_unshared: number;
	guests_unshared_viewed: number;
	guests_unshared_responded_self: number;
}

export async function listEngagementHistoricalEstimatesRpc(
	eventType: string | null,
	methodVersion: number,
): Promise<HistoricalEstimateRow[]> {
	return await supabaseRestRequest<HistoricalEstimateRow[]>({
		pathWithQuery: 'rpc/list_engagement_historical_estimates',
		method: 'POST',
		useServiceRole: true,
		body: { p_event_type: eventType, p_method_version: methodVersion },
	});
}
