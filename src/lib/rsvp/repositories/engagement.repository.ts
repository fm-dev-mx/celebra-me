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
