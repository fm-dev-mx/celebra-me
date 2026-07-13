import { ApiError } from '@/lib/rsvp/core/errors';
import {
	hasUnsafeEventProperties,
	PublicTrackingEventSchema,
	sanitizeEventProperties,
	type PublicTrackingEvent,
} from '@/lib/tracking/event-contract';
import { shouldExcludeInternalTraffic } from '@/lib/tracking/internal-exclusion';
import { createLeadFromTrackingEvent } from '@/lib/tracking/lead.service';
import { insertTrackingEvent, upsertVisitorSession } from '@/lib/tracking/repository';
import { classifyTrackingRoute } from '@/lib/tracking/route-policy';

export interface IngestTrackingEventInput {
	request: Request;
	vercelEnv?: string;
	payload: unknown;
}

export type IngestTrackingEventResult =
	| { accepted: true; eventId: string }
	| { accepted: false; reason: string };

function parseTrackingPayload(payload: unknown): PublicTrackingEvent {
	const result = PublicTrackingEventSchema.safeParse(payload);
	if (!result.success) {
		throw new ApiError(400, 'bad_request', 'Tracking event payload is invalid.', {
			issues: result.error.issues,
		});
	}
	return result.data;
}

export async function ingestTrackingEvent(
	input: IngestTrackingEventInput,
): Promise<IngestTrackingEventResult> {
	const payload = parseTrackingPayload(input.payload);
	const routePolicy = classifyTrackingRoute(payload.routePath);

	if (!routePolicy.internalAllowed) {
		return { accepted: false, reason: 'route_not_allowed' };
	}

	const rawEventProperties = payload.eventProperties ?? {};

	if (hasUnsafeEventProperties(rawEventProperties)) {
		throw new ApiError(400, 'bad_request', 'Tracking event contains unsafe properties.');
	}

	const exclusion = shouldExcludeInternalTraffic({
		cookieHeader: input.request.headers.get('cookie'),
		routeClass: routePolicy.routeClass,
		vercelEnv: input.vercelEnv,
	});
	if (exclusion.exclude) {
		return { accepted: false, reason: exclusion.reason ?? 'internal_traffic' };
	}

	const consentSnapshot = payload.consentSnapshot;
	const eventProperties = sanitizeEventProperties(rawEventProperties);

	await upsertVisitorSession({
		sessionId: payload.sessionId,
		visitorId: payload.visitorId,
		landingPath: payload.routePath,
		// Use the browser-sent document.referrer — NOT the HTTP Referer header on this
		// API request, which always reflects the page itself rather than the external source.
		referrer: payload.referrer,
		utmSource: payload.source,
		utmMedium: payload.medium,
		utmCampaign: payload.campaign,
		utmContent: payload.utmContent,
		utmTerm: payload.utmTerm,
		routeClass: routePolicy.routeClass,
		isInternal: false,
		consentSnapshot,
		metaAttribution: payload.metaAttribution,
	});

	const event = await insertTrackingEvent({
		sessionId: payload.sessionId,
		visitorId: payload.visitorId,
		eventName: payload.eventName,
		occurredAt: payload.occurredAt,
		routePath: payload.routePath,
		routeClass: routePolicy.routeClass,
		source: payload.source,
		medium: payload.medium,
		campaign: payload.campaign,
		eventProperties,
		consentSnapshot,
		isInternal: false,
	});

	// Auto-create a WhatsApp channel lead when a whatsapp_contact_clicked
	// event carries a non-empty lead_code. This bridges the attribution gap
	// between anonymous visitor/session and identifiable commercial intent.
	if (payload.eventName === 'whatsapp_contact_clicked') {
		const leadCode =
			typeof eventProperties['lead_code'] === 'string' &&
			eventProperties['lead_code'].trim().length > 0
				? eventProperties['lead_code']
				: undefined;
		if (leadCode) {
			try {
				await createLeadFromTrackingEvent({
					leadCode,
					sessionId: payload.sessionId,
					sourceEventId: event.id,
					channel: 'whatsapp',
					visitorId: payload.visitorId,
					utmSource: payload.source,
					utmMedium: payload.medium,
					utmCampaign: payload.campaign,
					metaAttribution: payload.metaAttribution,
				});
			} catch (leadError) {
				console.error('[tracking] Failed to auto-create WhatsApp lead:', leadError);
			}
		}
	}

	return { accepted: true, eventId: event.id };
}
