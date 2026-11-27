/**
 * Tracking event names, kept apart from `event-contract.ts` so the browser client does not ship
 * the Zod schemas that only the ingestion endpoint needs. This module must stay import-free.
 */
export const PUBLIC_TRACKING_EVENT_NAMES = [
	'page_viewed',
	'section_seen',
	'scroll_depth_reached',
	'cta_clicked',
	'package_viewed',
	'demo_viewed',
	'whatsapp_contact_clicked',
	'form_started',
	'form_submitted',
] as const;

/**
 * Browser-only funnel events: pushed to the dataLayer and forwarded to GA4, never posted to
 * /api/tracking/events. Storing one first-party needs `tracking_events_event_name_check` widened
 * by a migration first; until then the ingestion schema keeps rejecting it.
 */
export const CLIENT_ONLY_TRACKING_EVENT_NAMES = ['envelope_opened'] as const;

export const INTERNAL_TRACKING_EVENT_NAMES = [
	'session_started',
	'session_ended',
	'lead_created',
	'order_created',
	'deposit_paid',
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

export const TRACKING_EVENT_NAMES = [
	...PUBLIC_TRACKING_EVENT_NAMES,
	...INTERNAL_TRACKING_EVENT_NAMES,
] as const;

export type TrackingEventName = (typeof TRACKING_EVENT_NAMES)[number];
export type PublicTrackingEventName = (typeof PUBLIC_TRACKING_EVENT_NAMES)[number];
export type ClientOnlyTrackingEventName = (typeof CLIENT_ONLY_TRACKING_EVENT_NAMES)[number];
