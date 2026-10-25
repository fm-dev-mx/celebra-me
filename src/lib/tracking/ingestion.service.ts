import {
	enqueueBrowserConversionEvent,
	type BrowserConversionEventName,
} from '@/lib/commercial/meta-capi/service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { isAutomatedUserAgent } from '@/lib/rsvp/engagement/traffic-classifier';
import type { HostedDeployEnvironment } from '@/lib/server/deploy-identity';
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
import { getClientIp } from '@/lib/server/platform-request';
import { safeErr } from '@/lib/server/safe-error';

export interface IngestTrackingEventInput {
	request: Request;
	deployEnvironment?: HostedDeployEnvironment | null;
	payload: unknown;
}

/** First-party events the Meta Pixel sends as standard events that CAPI also delivers. */
const SERVER_META_EVENTS: Partial<Record<string, BrowserConversionEventName>> = {
	whatsapp_contact_clicked: 'Contact',
	form_submitted: 'Lead',
};

export type IngestTrackingEventResult =
	{ accepted: true; eventId: string } | { accepted: false; reason: string };

/** Mirror the Pixel: only Production, a Meta-allowed route and marketing consent queue a row. */
async function queueServerMetaEvent(input: {
	eventName: string;
	eventId: string;
	sessionId: string;
	routePath: string;
	marketingConsent: boolean;
	metaAllowed: boolean;
	deployEnvironment?: HostedDeployEnvironment | null;
}): Promise<void> {
	const serverMetaEvent = SERVER_META_EVENTS[input.eventName];
	if (
		!serverMetaEvent ||
		!input.marketingConsent ||
		!input.metaAllowed ||
		input.deployEnvironment !== 'production'
	) {
		return;
	}
	try {
		await enqueueBrowserConversionEvent({
			eventName: serverMetaEvent,
			eventId: input.eventId,
			sessionId: input.sessionId,
			eventSourcePath: input.routePath,
		});
	} catch (enqueueError) {
		console.error('[tracking] Failed to queue the Meta server event:', safeErr(enqueueError));
	}
}

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
		deployEnvironment: input.deployEnvironment,
	});
	if (exclusion.exclude) {
		return { accepted: false, reason: exclusion.reason ?? 'internal_traffic' };
	}

	// Crawlers, link-preview fetchers and headless browsers may accept cookies and
	// replay consent; drop them before any write so the sales funnel counts people only.
	const userAgent = input.request.headers.get('user-agent') ?? '';
	if (isAutomatedUserAgent(userAgent)) {
		return { accepted: false, reason: 'automated_traffic' };
	}

	const consentSnapshot = payload.consentSnapshot;
	if (!consentSnapshot.analytics && !consentSnapshot.marketing) {
		return { accepted: false, reason: 'consent_required' };
	}
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
		metaAttribution: consentSnapshot.marketing ? payload.metaAttribution : undefined,
		// Meta CAPI matching signals; the browser Pixel already sends both under the same consent.
		clientSignals: consentSnapshot.marketing
			? { ipAddress: getClientIp(input.request), userAgent }
			: undefined,
	});

	const event = await insertTrackingEvent({
		eventId: payload.eventId,
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

	await queueServerMetaEvent({
		eventName: payload.eventName,
		eventId: event.id,
		sessionId: payload.sessionId,
		routePath: payload.routePath,
		marketingConsent: consentSnapshot.marketing === true,
		metaAllowed: routePolicy.metaAllowed,
		deployEnvironment: input.deployEnvironment,
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
					metaAttribution: consentSnapshot.marketing
						? payload.metaAttribution
						: undefined,
				});
			} catch (leadError) {
				console.error(
					'[tracking] Failed to auto-create WhatsApp lead:',
					safeErr(leadError),
				);
			}
		}
	}

	return { accepted: true, eventId: event.id };
}
