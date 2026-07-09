/**
 * Meta CAPI Event Mapping Registry
 *
 * Maps internal tracking/commercial events to Meta CAPI events.
 * This is the single source of truth for what gets sent to Meta
 * and through which channel (Pixel, CAPI, or both).
 *
 * Safety invariant: the `purchase:order_id:deposit_paid` event_id
 * scheme ensures deduplication at Meta's end.
 *
 * Nothing in this module sends requests to Meta. All delivery
 * is gated by META_CAPI_DELIVERY_MODE in the delivery service.
 */

export type MetaEventName = 'PageView' | 'ViewContent' | 'Contact' | 'Lead' | 'Purchase';
export type DeliveryChannel = 'pixel' | 'capi' | 'both';

export interface MetaEventMapping {
	/** Internal tracking event name (from TRACKING_EVENT_NAMES) */
	internalEvent: string;
	/** Meta CAPI/Pixel event name */
	metaEvent: MetaEventName;
	/** Which channel(s) can deliver this event */
	channel: DeliveryChannel;
	/** Priority: primary conversion events are CAPI */
	priority: 'critical' | 'high' | 'normal' | 'low';
	/** Whether CAPI delivery is currently wired */
	capiReady: boolean;
	/** Human note about when this event fires */
	trigger: string;
}

/**
 * Canonical mapping from internal events to Meta events.
 * This is the reference table for all Meta-related development.
 *
 * Mapping guide:
 *   Pixel events: lightweight, high-volume, fire on every page view
 *   CAPI events: server-side, business-critical, fire on conversion
 *   Both: important engagement signals that benefit from both channels
 */
export const META_EVENT_MAPPINGS: MetaEventMapping[] = [
	{
		internalEvent: 'page_viewed',
		metaEvent: 'PageView',
		channel: 'pixel',
		priority: 'normal',
		capiReady: false,
		trigger: 'Every landing/demo page view via Pixel. Not sent via CAPI.',
	},
	{
		internalEvent: 'demo_viewed',
		metaEvent: 'ViewContent',
		channel: 'pixel',
		priority: 'high',
		capiReady: false,
		trigger: 'Every demo catalog page view. Pixel only; CAPI ready for future use.',
	},
	{
		internalEvent: 'whatsapp_contact_clicked',
		metaEvent: 'Contact',
		channel: 'pixel',
		priority: 'high',
		capiReady: false,
		trigger: 'WhatsApp CTA click on landing or demo page. Pixel + optional future CAPI.',
	},
	{
		internalEvent: 'lead_created',
		metaEvent: 'Lead',
		channel: 'both',
		priority: 'critical',
		capiReady: false,
		trigger: 'Lead created via contact form or WhatsApp intent. CAPI ready for future.',
	},
	{
		internalEvent: 'deposit_paid',
		metaEvent: 'Purchase',
		channel: 'capi',
		priority: 'critical',
		capiReady: true,
		trigger:
			'First deposit payment on a sales order. Creates meta_conversion_events outbox row with event_id = purchase:{order_id}:deposit_paid.',
	},
	{
		internalEvent: 'cta_clicked',
		metaEvent: 'Contact',
		channel: 'pixel',
		priority: 'normal',
		capiReady: false,
		trigger: 'Generic CTA click (non-WhatsApp). Pixel only.',
	},
];

/**
 * Get the Meta event mapping for a given internal event name.
 */
export function getMetaEventMapping(internalEvent: string): MetaEventMapping | undefined {
	return META_EVENT_MAPPINGS.find((m) => m.internalEvent === internalEvent);
}

/**
 * Get all CAPI-ready mappings (events that have server-side delivery wired).
 */
export function getCapiReadyMappings(): MetaEventMapping[] {
	return META_EVENT_MAPPINGS.filter((m) => m.capiReady);
}

/**
 * Get all mappings that use a specific delivery channel.
 */
export function getMappingsByChannel(channel: DeliveryChannel): MetaEventMapping[] {
	return META_EVENT_MAPPINGS.filter((m) => m.channel === channel || m.channel === 'both');
}
