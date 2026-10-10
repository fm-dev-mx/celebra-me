import { supabaseRestRequest } from './supabase';
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
