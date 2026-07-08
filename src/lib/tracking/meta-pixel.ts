/**
 * Meta Pixel loader — Basic Consent Mode.
 *
 * Meta Pixel is never loaded before marketing consent is granted.
 * The fbevents.js script is injected dynamically only after:
 *   1. production environment
 *   2. route policy allows Meta
 *   3. PUBLIC_META_PIXEL_ID is set and PUBLIC_META_PIXEL_ENABLED=true
 *   4. marketing consent === true
 *   5. internal exclusion does not apply
 *
 * Only client-side events are implemented in this phase:
 *   - PageView  (from first-party page_viewed forwarding)
 *   - ViewContent
 *   - Contact
 *
 * Lead, Purchase, and CAPI are reserved for future phases.
 *
 * Automatic Advanced Matching / auto-config is explicitly disabled
 * so the Pixel never auto-collects form fields or PII from the page.
 *
 * PageView is NOT fired on init — it is sent once via the
 * first-party page_viewed event forwarding, guaranteeing exactly
 * one PageView per eligible page load after marketing consent.
 */

import {
	readConsent,
	subscribeConsentChange,
	type ConsentState,
} from '@/lib/tracking/consent-client';
import { classifyTrackingRoute } from '@/lib/tracking/route-policy';
import { getPixelIdFromEnv, isPixelEnabledInEnv } from '@/lib/tracking/meta-pixel-env';

declare global {
	interface Window {
		fbq: {
			(...args: unknown[]): void;
			callMethod?: (...args: unknown[]) => void;
			queue?: unknown[];
			loaded?: boolean;
			version?: string;
		};
		_fbq: unknown;
	}
}

let pixelLoaded = false;
let pixelLoading = false;
let pixelId = '';

function getPixelId(): string {
	return getPixelIdFromEnv();
}

function isPixelEnabled(): boolean {
	return isPixelEnabledInEnv();
}

function routeAllowsMeta(): boolean {
	return classifyTrackingRoute(window.location.pathname).metaAllowed;
}

function shouldLoad(): boolean {
	if (!document.body.dataset.trackingRouteClass) return false;
	if (!routeAllowsMeta()) return false;
	if (!pixelId) return false;
	if (!isPixelEnabled()) return false;
	return true;
}

/**
 * Dynamically load the Meta Pixel script. Safe to call multiple times.
 */
function loadPixelScript(): Promise<void> {
	if (pixelLoaded) return Promise.resolve();
	if (pixelLoading) {
		return new Promise((resolve) => {
			const checkLoaded = () => {
				if (pixelLoaded) resolve();
				else setTimeout(checkLoaded, 100);
			};
			checkLoaded();
		});
	}

	pixelLoading = true;
	return new Promise((resolve) => {
		const id = pixelId;

		// Create fbq function stub that queues calls until the real script loads.
		window.fbq = function fbq(...args: unknown[]) {
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			window.fbq.callMethod ? window.fbq.callMethod(...args) : window.fbq.queue?.push(args);
		} as typeof window.fbq;
		window._fbq = window.fbq;
		window.fbq.queue = [];
		window.fbq.loaded = true;
		window.fbq.version = '2.0';

		// Load the script
		const script = document.createElement('script');
		script.async = true;
		script.src = 'https://connect.facebook.net/en_US/fbevents.js';
		script.onload = () => {
			// Disable automatic advanced matching — prevents auto-collection
			// of form fields and PII from the page.
			window.fbq?.('set', 'autoConfig', false, id);
			// Initialize the pixel. PageView is NOT fired here; it is sent
			// via first-party page_viewed forwarding for exactly one event.
			window.fbq?.('init', id);
			pixelLoaded = true;
			pixelLoading = false;
			resolve();
		};
		script.onerror = () => {
			pixelLoaded = true;
			pixelLoading = false;
			resolve();
		};
		document.head.appendChild(script);
	});
}

/**
 * Initialize Meta Pixel: check gates and load script.
 * PageView is not fired here — it comes from first-party page_viewed
 * forwarding to guarantee exactly one PageView per page load.
 */
export function initMetaPixel(): void {
	pixelId = getPixelId();
	if (!pixelId) return;
	if (!shouldLoad()) return;

	const consent = readConsent();
	if (consent.marketing) {
		void loadPixelScript();
	}

	// React to consent changes: load if newly granted.
	subscribeConsentChange((state: ConsentState) => {
		if (state.marketing && !pixelLoaded && !pixelLoading) {
			void loadPixelScript();
		}
	});
}

/**
 * Track a Meta Pixel event. Called only after marketing consent is verified.
 * Standard Meta events (PageView, ViewContent, Lead, Contact) are sent via
 * fbq('track', ...). Any other mapped event is sent via fbq('trackCustom', ...)
 * and appears as a custom event in Events Manager.
 */
function trackMetaEvent(
	eventName: string,
	parameters?: Record<string, string | number | boolean>,
	options?: { eventID?: string },
): void {
	if (!pixelLoaded) return;
	const consent = readConsent();
	if (!consent.marketing) return;

	const method = STANDARD_META_EVENTS.has(eventName) ? 'track' : 'trackCustom';
	if (options?.eventID) {
		window.fbq?.(method, eventName, parameters ?? {}, options);
		return;
	}
	window.fbq?.(method, eventName, parameters ?? {});
}

/**
 * Forward a first-party event to Meta Pixel.
 * Exported for use by the client tracking module.
 */
export function forwardToMetaPixel(
	eventName: string,
	eventProperties: Record<string, string | number | boolean>,
): void {
	const metaEvent = mapToMetaEvent(eventName);
	if (!metaEvent) return;

	const payload = buildMetaPayload(eventName, eventProperties);
	trackMetaEvent(metaEvent, payload.parameters, payload.options);
}

/**
 * Standard Meta Pixel events that are recognized conversion events in
 * Events Manager. Mapped first-party events whose target is in this set
 * are sent via fbq('track', ...). All other mapped events are sent via
 * fbq('trackCustom', ...) and appear as custom events.
 */
const STANDARD_META_EVENTS = new Set(['PageView', 'ViewContent', 'Lead', 'Contact']);

const META_EVENT_MAP: Record<string, string> = {
	page_viewed: 'PageView',
	demo_viewed: 'ViewContent',
	package_viewed: 'ViewContent',
	whatsapp_contact_clicked: 'Contact',
	form_submitted: 'Lead',
	// lead_created is currently server-side only; mapped here for
	// code-level versioning of the tracking contract.
	lead_created: 'Lead',
};

function mapToMetaEvent(firstPartyName: string): string | undefined {
	return META_EVENT_MAP[firstPartyName] ?? undefined;
}

// Only non-PII, low-cardinality identifiers. No names, emails, phones,
// message text, guest data, invite IDs, tokens, or claim codes.
const SAFE_META_KEYS = new Set(['content_name', 'content_category', 'event_type', 'source_area']);

function sanitizeForMeta(
	properties: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
	const result: Record<string, string | number | boolean> = {};
	for (const [key, value] of Object.entries(properties)) {
		if (!SAFE_META_KEYS.has(key)) continue;
		if (typeof value === 'string') {
			result[key] = value.slice(0, 160);
		} else if (typeof value === 'number' && Number.isFinite(value)) {
			result[key] = value;
		} else if (typeof value === 'boolean') {
			result[key] = value;
		}
	}
	return result;
}

function pickNonEmptyString(
	...values: Array<string | number | boolean | undefined>
): string | undefined {
	for (const value of values) {
		if (typeof value !== 'string') continue;
		const trimmed = value.trim();
		if (trimmed) return trimmed;
	}
	return undefined;
}

function buildPageViewPayload(properties: Record<string, string | number | boolean>) {
	const parameters: Record<string, string | number | boolean> = {
		content_category: 'page',
	};
	const pageType = pickNonEmptyString(properties.page_type);
	if (pageType) {
		parameters.content_name = pageType;
		parameters.source_area = pageType;
	}
	return parameters;
}

function buildDemoViewPayload(properties: Record<string, string | number | boolean>) {
	const parameters: Record<string, string | number | boolean> = {
		content_category: 'demo',
	};
	const demoSlug = pickNonEmptyString(properties.content_name, properties.demo_slug);
	const eventType = pickNonEmptyString(properties.event_type);
	const sourceArea = pickNonEmptyString(properties.source_area);
	if (demoSlug) parameters.content_name = demoSlug;
	if (eventType) parameters.event_type = eventType;
	if (sourceArea) parameters.source_area = sourceArea;
	return parameters;
}

function buildPackageViewPayload(properties: Record<string, string | number | boolean>) {
	const parameters: Record<string, string | number | boolean> = {
		content_category: 'package',
	};
	const packageName = pickNonEmptyString(
		properties.content_name,
		properties.package_name,
		properties.package_id,
	);
	const sourceArea = pickNonEmptyString(properties.source_area);
	if (packageName) parameters.content_name = packageName;
	if (sourceArea) parameters.source_area = sourceArea;
	return parameters;
}

function buildContactPayload(properties: Record<string, string | number | boolean>) {
	const parameters: Record<string, string | number | boolean> = {
		content_category: 'contact',
	};
	const packageName = pickNonEmptyString(properties.package_name, properties.package_id);
	const demoSlug = pickNonEmptyString(properties.demo_slug);
	const eventType = pickNonEmptyString(properties.event_type);
	const sourceArea = pickNonEmptyString(properties.source_area);
	if (packageName) {
		parameters.content_category = 'package';
		parameters.content_name = packageName;
	} else if (demoSlug) {
		parameters.content_category = 'demo';
		parameters.content_name = demoSlug;
	}
	if (eventType) parameters.event_type = eventType;
	if (sourceArea) parameters.source_area = sourceArea;
	return parameters;
}

function buildLeadPayload(properties: Record<string, string | number | boolean>) {
	const parameters: Record<string, string | number | boolean> = {
		content_category: 'lead_form',
		content_name: pickNonEmptyString(properties.form_id) ?? 'contact',
	};
	const eventType = pickNonEmptyString(properties.event_type);
	const sourceArea = pickNonEmptyString(properties.source_area);
	if (eventType) parameters.event_type = eventType;
	if (sourceArea) parameters.source_area = sourceArea;
	return parameters;
}

function buildMetaPayload(
	eventName: string,
	properties: Record<string, string | number | boolean>,
): {
	parameters: Record<string, string | number | boolean>;
	options?: { eventID?: string };
} {
	const eventId = pickNonEmptyString(properties.event_id, properties.lead_code);
	let base: Record<string, string | number | boolean> = {};

	switch (eventName) {
		case 'page_viewed':
			base = buildPageViewPayload(properties);
			break;
		case 'demo_viewed':
			base = buildDemoViewPayload(properties);
			break;
		case 'package_viewed':
			base = buildPackageViewPayload(properties);
			break;
		case 'whatsapp_contact_clicked':
			base = buildContactPayload(properties);
			break;
		case 'form_submitted':
		case 'lead_created':
			base = buildLeadPayload(properties);
			break;
		default:
			break;
	}

	const parameters = sanitizeForMeta(base);
	return eventId ? { parameters, options: { eventID: eventId } } : { parameters };
}
