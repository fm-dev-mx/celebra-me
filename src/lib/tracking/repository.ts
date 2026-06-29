import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { ConsentSnapshot } from '@/lib/tracking/consent-policy';
import type { TrackingEventName } from '@/lib/tracking/event-contract';
import type { TrackingRouteClass } from '@/lib/tracking/route-policy';

export interface VisitorSessionInput {
	sessionId: string;
	visitorId: string;
	landingPath: string;
	referrer?: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
	utmContent?: string;
	utmTerm?: string;
	deviceType?: string;
	routeClass: TrackingRouteClass;
	isInternal: boolean;
	consentSnapshot: ConsentSnapshot;
}

export interface TrackingEventRepositoryInput {
	sessionId: string;
	visitorId: string;
	eventName: TrackingEventName;
	occurredAt?: string;
	routePath: string;
	routeClass: TrackingRouteClass;
	source?: string;
	medium?: string;
	campaign?: string;
	eventProperties: Record<string, string | number | boolean>;
	consentSnapshot: ConsentSnapshot;
	isInternal: boolean;
}

export interface InsertedTrackingEvent {
	id: string;
	eventName: TrackingEventName;
}

function emptyToUndefined(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

export async function upsertVisitorSession(input: VisitorSessionInput): Promise<void> {
	await supabaseRestRequest<unknown>({
		pathWithQuery: 'visitor_sessions?on_conflict=id',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=merge-duplicates,return=minimal',
		body: {
			id: input.sessionId,
			visitor_id: input.visitorId,
			last_seen_at: new Date().toISOString(),
			landing_path: input.landingPath,
			referrer: emptyToUndefined(input.referrer),
			utm_source: emptyToUndefined(input.utmSource),
			utm_medium: emptyToUndefined(input.utmMedium),
			utm_campaign: emptyToUndefined(input.utmCampaign),
			utm_content: emptyToUndefined(input.utmContent),
			utm_term: emptyToUndefined(input.utmTerm),
			device_type: emptyToUndefined(input.deviceType),
			route_class: input.routeClass,
			is_internal: input.isInternal,
			consent_snapshot: input.consentSnapshot,
		},
	});
}

export async function insertTrackingEvent(
	input: TrackingEventRepositoryInput,
): Promise<InsertedTrackingEvent> {
	const rows = await supabaseRestRequest<Array<{ id: string; event_name: TrackingEventName }>>({
		pathWithQuery: 'tracking_events?select=id,event_name',
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			session_id: input.sessionId,
			visitor_id: input.visitorId,
			event_name: input.eventName,
			occurred_at: input.occurredAt,
			route_path: input.routePath,
			route_class: input.routeClass,
			source: emptyToUndefined(input.source),
			medium: emptyToUndefined(input.medium),
			campaign: emptyToUndefined(input.campaign),
			event_properties: input.eventProperties,
			consent_snapshot: input.consentSnapshot,
			is_internal: input.isInternal,
		},
	});

	const row = rows[0];
	if (!row) {
		throw new Error('Tracking event insert did not return an event id.');
	}

	return {
		id: row.id,
		eventName: row.event_name,
	};
}
