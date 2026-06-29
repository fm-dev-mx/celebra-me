import { z } from 'zod';
import { normalizeConsentSnapshot } from '@/lib/tracking/consent-policy';
import type { TrackingRouteClass } from '@/lib/tracking/route-policy';

export const TRACKING_EVENT_NAMES = [
	'page_viewed',
	'session_started',
	'session_ended',
	'section_seen',
	'scroll_depth_reached',
	'cta_clicked',
	'package_viewed',
	'demo_viewed',
	'whatsapp_contact_clicked',
	'form_started',
	'form_submitted',
	'lead_created',
	'quote_sent',
	'production_authorized',
	'production_started',
	'preview_delivered',
	'payment_pending',
	'payment_received',
	'invitation_activated',
	'converted_to_demo',
	'lost',
] as const;

export type TrackingEventName = (typeof TRACKING_EVENT_NAMES)[number];

export const TRACKING_ROUTE_CLASSES: TrackingRouteClass[] = [
	'commercial',
	'demo',
	'real_invitation',
	'personalized_invitation',
	'rsvp_guest_api',
	'dashboard_admin_auth',
	'generic_api',
	'unknown',
];

const SAFE_EVENT_PROPERTY_KEYS = new Set([
	'page_type',
	'section_id',
	'visibility_bucket',
	'depth_bucket',
	'cta_id',
	'cta_location',
	'destination_type',
	'package_id',
	'package_tier',
	'demo_slug',
	'event_type',
	'is_demo',
	'form_id',
	'success',
	'lead_channel',
	'lead_source',
	'lead_code',
]);

const UNSAFE_KEY_PATTERN =
	/(email|phone|whatsapp|nombre|name|message|comment|token|invite|guest|claim)/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LONG_PHONE_PATTERN = /(?:\+?\d[\s().-]*){10,}/;

export function hasUnsafeEventProperties(properties: Record<string, unknown>): boolean {
	return Object.entries(properties).some(([key, value]) => {
		if (UNSAFE_KEY_PATTERN.test(key)) return true;
		if (typeof value !== 'string') return false;
		return EMAIL_PATTERN.test(value) || LONG_PHONE_PATTERN.test(value);
	});
}

export function sanitizeEventProperties(
	properties: Record<string, unknown>,
): Record<string, string | number | boolean> {
	const sanitized: Record<string, string | number | boolean> = {};

	for (const [key, value] of Object.entries(properties)) {
		if (!SAFE_EVENT_PROPERTY_KEYS.has(key)) continue;
		if (typeof value === 'string') {
			sanitized[key] = value.trim().slice(0, 160);
			continue;
		}
		if (typeof value === 'number' && Number.isFinite(value)) {
			sanitized[key] = value;
			continue;
		}
		if (typeof value === 'boolean') {
			sanitized[key] = value;
		}
	}

	return sanitized;
}

const ConsentSnapshotSchema = z
	.object({
		necessary: z.boolean().optional(),
		analytics: z.boolean().optional(),
		marketing: z.boolean().optional(),
	})
	.transform(normalizeConsentSnapshot);

export const TrackingEventSchema = z.object({
	sessionId: z.uuid(),
	visitorId: z.string().trim().min(6).max(120),
	eventName: z.enum(TRACKING_EVENT_NAMES),
	occurredAt: z.iso.datetime().optional(),
	routePath: z.string().trim().min(1).max(300),
	routeClass: z.enum(TRACKING_ROUTE_CLASSES),
	source: z.string().trim().max(120).optional(),
	medium: z.string().trim().max(120).optional(),
	campaign: z.string().trim().max(180).optional(),
	eventProperties: z.record(z.string(), z.unknown()).default({}),
	consentSnapshot: ConsentSnapshotSchema.optional().transform(normalizeConsentSnapshot),
	isInternal: z.boolean().optional().default(false),
});

export type TrackingEventInput = z.input<typeof TrackingEventSchema>;
export type TrackingEvent = z.output<typeof TrackingEventSchema>;
