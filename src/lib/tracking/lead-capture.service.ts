import { z } from 'zod';
import { DEMO_SHOWROOM_ITEMS } from '@/data/demo-showroom.data';
import { createCommercialCustomer } from '@/lib/commercial/customer.service';
import { enqueueBrowserConversionEvent } from '@/lib/commercial/meta-capi/service';
import { normalizeCommercialPhone } from '@/lib/commercial/phone';
import { ApiError } from '@/lib/rsvp/core/errors';
import { isAutomatedUserAgent } from '@/lib/rsvp/engagement/traffic-classifier';
import type { HostedDeployEnvironment } from '@/lib/server/deploy-identity';
import { getClientIp } from '@/lib/server/platform-request';
import { safeErr } from '@/lib/server/safe-error';
import { TrackingEventSchema } from '@/lib/tracking/event-contract';
import { shouldExcludeInternalTraffic } from '@/lib/tracking/internal-exclusion';
import {
	isLeadEventDateInRange,
	LEAD_CAPTURE_EVENT_TYPE_VALUES,
	LEAD_CAPTURE_FORM_ID,
	LEAD_CAPTURE_MIN_FILL_MS,
} from '@/lib/tracking/lead-capture';
import { createLeadCode } from '@/lib/tracking/lead-code';
import { findLeadByCode, upsertLead, type StoredLead } from '@/lib/tracking/lead.repository';
import { insertTrackingEvent, upsertVisitorSession } from '@/lib/tracking/repository';
import { classifyTrackingRoute } from '@/lib/tracking/route-policy';

const LEAD_CODE_PATTERN = /^CM-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;
const DEMO_SLUGS = new Set(DEMO_SHOWROOM_ITEMS.map((item) => item.slug));
/** Attempts to find a free lead code when the proposed one already belongs to someone else. */
const LEAD_CODE_ATTEMPTS = 3;

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.transform((value) => value || undefined);

export const LeadCaptureSchema = TrackingEventSchema.pick({
	sessionId: true,
	visitorId: true,
	routePath: true,
	source: true,
	medium: true,
	campaign: true,
	referrer: true,
	utmContent: true,
	utmTerm: true,
	metaAttribution: true,
	consentSnapshot: true,
}).extend({
	/** Shared with the browser Pixel Lead as `eventID`, so Meta deduplicates both copies. */
	eventId: z.uuid(),
	leadCode: z.string().trim().toUpperCase().regex(LEAD_CODE_PATTERN),
	eventType: z.enum(LEAD_CAPTURE_EVENT_TYPE_VALUES),
	eventDate: z
		.string()
		.trim()
		.refine((value) => isLeadEventDateInRange(value), 'Fecha fuera de rango.'),
	contactName: z.string().trim().min(2).max(80),
	celebrantNames: optionalText(120),
	phone: z
		.string()
		.trim()
		.max(30)
		.refine((value) => normalizeCommercialPhone(value) !== undefined, 'Teléfono inválido.'),
	demoSlug: optionalText(80).refine(
		(value) => value === undefined || DEMO_SLUGS.has(value),
		'Diseño desconocido.',
	),
	sourceArea: optionalText(80),
	ctaId: optionalText(80),
	/** Honeypot: hidden from people, filled by naive bots. */
	website: z.string().max(200).optional(),
	/** Milliseconds between opening the form and sending it. */
	elapsedMs: z.number().int().nonnegative().max(86_400_000),
});

export type LeadCaptureInput = z.output<typeof LeadCaptureSchema>;

export interface SubmitLeadCaptureInput {
	request: Request;
	deployEnvironment?: HostedDeployEnvironment | null;
	payload: unknown;
}

export type SubmitLeadCaptureResult =
	| { accepted: true; leadCode: string; tracked: boolean }
	/** Dropped silently: the response looks like a success so bots learn nothing. */
	| { accepted: false; leadCode: string; reason: 'honeypot' | 'too_fast' | 'automated_traffic' };

function parseLeadCapture(payload: unknown): LeadCaptureInput {
	const result = LeadCaptureSchema.safeParse(payload);
	if (!result.success) {
		throw new ApiError(400, 'validation_error', 'Revise los datos del formulario.', {
			fields: [...new Set(result.error.issues.map((issue) => String(issue.path[0])))],
		});
	}
	return result.data;
}

function detectBot(input: LeadCaptureInput, userAgent: string) {
	if (input.website?.trim()) return 'honeypot' as const;
	if (input.elapsedMs < LEAD_CAPTURE_MIN_FILL_MS) return 'too_fast' as const;
	if (isAutomatedUserAgent(userAgent)) return 'automated_traffic' as const;
	return undefined;
}

/**
 * Stores the lead under the proposed code when it is free or already this session's lead;
 * otherwise under a fresh code. A lead code is a session-bound continuation token, so a code
 * from another session (or any existing code without a tracked session) is never updated.
 */
async function storeCaptureLead(
	input: LeadCaptureInput,
	context: { sessionId?: string; sourceEventId?: string; marketing: boolean },
): Promise<{ lead: StoredLead; created: boolean }> {
	const phone = normalizeCommercialPhone(input.phone);
	let leadCode = input.leadCode;
	for (let attempt = 0; attempt < LEAD_CODE_ATTEMPTS; attempt += 1) {
		const existing = await findLeadByCode(leadCode);
		const reusable = existing && context.sessionId && existing.sessionId === context.sessionId;
		if (existing && !reusable) {
			leadCode = createLeadCode();
			continue;
		}
		const lead = await upsertLead({
			leadCode,
			sessionId: context.sessionId,
			sourceEventId: context.sourceEventId,
			channel: 'contact_form',
			name: input.contactName,
			phone: input.phone,
			phoneCountryCode: phone?.countryCode,
			phoneNational: phone?.national,
			phoneE164: phone?.e164,
			eventType: input.eventType,
			eventDate: input.eventDate,
			celebrantNames: input.celebrantNames,
			demoSlug: input.demoSlug,
			utmSource: input.source,
			utmMedium: input.medium,
			utmCampaign: input.campaign,
			metaAttribution: context.marketing ? input.metaAttribution : undefined,
			consentContact: true,
			consentMarketing: context.marketing,
		});
		return { lead, created: !existing };
	}
	throw new Error('Could not allocate a free lead code.');
}

/** Stores the visitor session and the `form_submitted` event; returns the event ID. */
async function recordCaptureSubmission(
	input: LeadCaptureInput,
	context: {
		request: Request;
		routeClass: ReturnType<typeof classifyTrackingRoute>['routeClass'];
		marketing: boolean;
		userAgent: string;
	},
): Promise<string> {
	const { marketing, routeClass } = context;
	await upsertVisitorSession({
		sessionId: input.sessionId,
		visitorId: input.visitorId,
		landingPath: input.routePath,
		referrer: input.referrer,
		utmSource: input.source,
		utmMedium: input.medium,
		utmCampaign: input.campaign,
		utmContent: input.utmContent,
		utmTerm: input.utmTerm,
		routeClass,
		isInternal: false,
		consentSnapshot: input.consentSnapshot,
		metaAttribution: marketing ? input.metaAttribution : undefined,
		clientSignals: marketing
			? { ipAddress: getClientIp(context.request), userAgent: context.userAgent }
			: undefined,
	});
	const event = await insertTrackingEvent({
		eventId: input.eventId,
		sessionId: input.sessionId,
		visitorId: input.visitorId,
		eventName: 'form_submitted',
		routePath: input.routePath,
		routeClass,
		source: input.source,
		medium: input.medium,
		campaign: input.campaign,
		eventProperties: {
			form_id: LEAD_CAPTURE_FORM_ID,
			event_type: input.eventType,
			...(input.demoSlug ? { demo_slug: input.demoSlug } : {}),
			...(input.sourceArea ? { source_area: input.sourceArea } : {}),
			...(input.ctaId ? { cta_id: input.ctaId } : {}),
			event_id: input.eventId,
		},
		consentSnapshot: input.consentSnapshot,
		isInternal: false,
	});
	return event.id;
}

/**
 * «Aparta su fecha»: stores the lead and its customer, then (with consent) the `form_submitted`
 * tracking event and the server copy of the Meta Lead.
 *
 * The lead and customer are stored for every person, because they asked to be contacted. The
 * visitor session, the tracking event and the Meta Lead follow the same rules as tracking
 * ingestion: analytics or marketing consent, no internal traffic, and for Meta also Production,
 * a Meta-allowed route and marketing consent. Only the Meta Lead carries the customer, so its
 * delivery adds the hashed phone.
 */
export async function submitLeadCapture(
	params: SubmitLeadCaptureInput,
): Promise<SubmitLeadCaptureResult> {
	const input = parseLeadCapture(params.payload);
	const userAgent = params.request.headers.get('user-agent') ?? '';
	const botReason = detectBot(input, userAgent);
	if (botReason) return { accepted: false, leadCode: input.leadCode, reason: botReason };

	const routePolicy = classifyTrackingRoute(input.routePath);
	const consent = input.consentSnapshot;
	const marketing = consent.marketing === true;
	const excluded = shouldExcludeInternalTraffic({
		cookieHeader: params.request.headers.get('cookie'),
		routeClass: routePolicy.routeClass,
		deployEnvironment: params.deployEnvironment,
	}).exclude;
	const tracked =
		routePolicy.internalAllowed && !excluded && (consent.analytics || consent.marketing);

	const sourceEventId = tracked
		? await recordCaptureSubmission(input, {
				request: params.request,
				routeClass: routePolicy.routeClass,
				marketing,
				userAgent,
			})
		: undefined;

	const { lead, created } = await storeCaptureLead(input, {
		sessionId: tracked ? input.sessionId : undefined,
		sourceEventId,
		marketing,
	});

	const customerResult = await createCommercialCustomer({
		displayName: input.contactName,
		phone: input.phone,
		createdFromLeadId: lead.id,
	});
	const customerId =
		customerResult.outcome === 'conflict' ? undefined : customerResult.customer.id;

	if (tracked && created) {
		try {
			await insertTrackingEvent({
				sessionId: input.sessionId,
				visitorId: input.visitorId,
				eventName: 'lead_created',
				routePath: '/api/leads/capture',
				routeClass: 'commercial',
				eventProperties: { lead_code: lead.leadCode, lead_channel: 'contact_form' },
				consentSnapshot: { necessary: true, analytics: false, marketing: false },
				isInternal: false,
			});
		} catch {
			// Non-critical: the lead is already persisted.
		}
	}

	if (
		tracked &&
		sourceEventId &&
		marketing &&
		routePolicy.metaAllowed &&
		params.deployEnvironment === 'production'
	) {
		try {
			await enqueueBrowserConversionEvent({
				trigger: 'form_submitted',
				eventId: sourceEventId,
				sessionId: input.sessionId,
				eventSourcePath: input.routePath,
				customerId,
				leadId: lead.id,
			});
		} catch (enqueueError) {
			console.error('[lead-capture] Failed to queue the Meta Lead:', safeErr(enqueueError));
		}
	}

	return { accepted: true, leadCode: lead.leadCode, tracked };
}
