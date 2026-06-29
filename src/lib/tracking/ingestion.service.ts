import { ApiError } from '@/lib/rsvp/core/errors';
import { normalizeConsentSnapshot } from '@/lib/tracking/consent-policy';
import {
	hasUnsafeEventProperties,
	sanitizeEventProperties,
	TrackingEventSchema,
	type TrackingEventInput,
} from '@/lib/tracking/event-contract';
import { shouldExcludeInternalTraffic } from '@/lib/tracking/internal-exclusion';
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

function parseTrackingPayload(payload: unknown): TrackingEventInput {
	const result = TrackingEventSchema.safeParse(payload);
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

	const consentSnapshot = normalizeConsentSnapshot(payload.consentSnapshot);
	const eventProperties = sanitizeEventProperties(rawEventProperties);

	await upsertVisitorSession({
		sessionId: payload.sessionId,
		visitorId: payload.visitorId,
		landingPath: payload.routePath,
		referrer: input.request.headers.get('referer') ?? undefined,
		utmSource: payload.source,
		utmMedium: payload.medium,
		utmCampaign: payload.campaign,
		routeClass: routePolicy.routeClass,
		isInternal: false,
		consentSnapshot,
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

	return { accepted: true, eventId: event.id };
}
