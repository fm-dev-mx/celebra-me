/**
 * GA4 forwarder — Basic Consent Mode.
 *
 * GA4 is never loaded before analytics consent is granted.
 * The gtag.js script is injected dynamically only after:
 *   1. production environment
 *   2. route policy allows GA4
 *   3. a measurement ID is configured
 *   4. analytics consent === true
 *   5. internal exclusion does not apply
 *
 * Once loaded, it forwards mapped first-party events as PII-safe GA4 events.
 * Uses the existing SAFE_EVENT_PROPERTY_KEYS allowlist for parameter safety.
 */

import {
	readConsent,
	subscribeConsentChange,
	type ConsentState,
} from '@/lib/tracking/consent-client';
import { classifyTrackingRoute } from '@/lib/tracking/route-policy';

declare global {
	interface Window {
		dataLayer?: Array<Record<string, unknown>>;
		gtag?: (...args: unknown[]) => void;
	}
}

let gaLoaded = false;
let gaLoading = false;
let measurementId = '';

/**
 * Resolve the GA4 measurement ID, preferring PUBLIC_GA_MEASUREMENT_ID
 * with fallback to PUBLIC_GOOGLE_ANALYTICS_ID.
 */
function resolveMeasurementId(): string {
	const ga4Id = import.meta.env.PUBLIC_GA_MEASUREMENT_ID?.trim();
	if (ga4Id) return ga4Id;
	const legacyId = import.meta.env.PUBLIC_GOOGLE_ANALYTICS_ID?.trim();
	return legacyId || '';
}

function routeAllowsGA(): boolean {
	return classifyTrackingRoute(window.location.pathname).gaAllowed;
}

function shouldLoad(): boolean {
	// Keep the internal-exclusion check simple: if body has no tracking route
	// class, the page itself decided tracking is not applicable.
	if (!document.body.dataset.trackingRouteClass) return false;
	if (!routeAllowsGA()) return false;
	return true;
}

/**
 * Dynamically load the gtag.js script. Safe to call multiple times.
 */
function loadGtagScript(): Promise<void> {
	if (gaLoaded) return Promise.resolve();
	if (gaLoading) {
		// Return a promise that resolves when the script loads.
		return new Promise((resolve) => {
			const checkLoaded = () => {
				if (gaLoaded) resolve();
				else setTimeout(checkLoaded, 100);
			};
			checkLoaded();
		});
	}

	gaLoading = true;
	return new Promise((resolve) => {
		const id = measurementId;
		if (!id) {
			gaLoaded = true;
			gaLoading = false;
			resolve();
			return;
		}

		// Initialize dataLayer
		window.dataLayer = window.dataLayer ?? [];
		function gtag(...args: unknown[]) {
			window.dataLayer?.push(args as unknown as Record<string, unknown>);
		}
		window.gtag = gtag as (...args: unknown[]) => void;
		gtag('js', new Date());
		gtag('config', id, { send_page_view: false });

		// Load the script
		const script = document.createElement('script');
		script.async = true;
		script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
		script.onload = () => {
			gaLoaded = true;
			gaLoading = false;
			resolve();
		};
		script.onerror = () => {
			// Loading failed silently — do not break the page.
			gaLoaded = true;
			gaLoading = false;
			resolve();
		};
		document.head.appendChild(script);
	});
}

/**
 * Initialize GA4: check gates, load script, and subscribe to consent changes.
 */
export function initGA4(): void {
	measurementId = resolveMeasurementId();
	if (!measurementId) return;
	if (!shouldLoad()) return;

	const consent = readConsent();
	if (consent.analytics) {
		void loadGtagScript();
	}

	// React to consent changes: load if newly granted.
	subscribeConsentChange((state: ConsentState) => {
		if (state.analytics && !gaLoaded && !gaLoading) {
			void loadGtagScript();
		}
		// If consent is withdrawn, we can stop forwarding custom events
		// but cannot unload the already-loaded script. Basic Consent Mode
		// means gtag('consent', 'default', ...) is not used; instead we
		// simply stop calling gtag('event', ...) when analytics=false.
	});
}

/**
 * Forward a first-party event to GA4 as a custom event.
 * Called only after analytics consent is verified externally.
 */
export function forwardToGA4(
	eventName: string,
	eventProperties: Record<string, string | number | boolean>,
): void {
	if (!gaLoaded) return;
	const consent = readConsent();
	if (!consent.analytics) return;

	const gtag = window.gtag;
	if (!gtag) return;

	// Map first-party event names to GA4 event names.
	const ga4EventName = mapEventName(eventName);
	if (!ga4EventName) return;

	// Strip any properties not in the safe allowlist.
	const safeParams = sanitizeForGA4(eventProperties);
	gtag('event', ga4EventName, safeParams);
}

const GA4_EVENT_MAP: Record<string, string> = {
	page_viewed: 'page_view',
	section_seen: 'section_view',
	scroll_depth_reached: 'scroll',
	cta_clicked: 'cta_click',
	package_viewed: 'view_item',
	demo_viewed: 'view_item',
	whatsapp_contact_clicked: 'contact',
	form_started: 'form_start',
	form_submitted: 'form_submit',
};

function mapEventName(firstPartyName: string): string | undefined {
	return GA4_EVENT_MAP[firstPartyName] ?? undefined;
}

// Deliberate subset of SAFE_EVENT_PROPERTY_KEYS from event-contract.ts.
const SAFE_GA4_KEYS = new Set([
	'page_type',
	'section_id',
	'visibility_bucket',
	'depth_bucket',
	'cta_id',
	'cta_location',
	'destination_type',
	'package_id',
	'demo_slug',
	'event_type',
	'is_demo',
	'form_id',
	'success',
	'lead_channel',
	'lead_source',
]);

function sanitizeForGA4(
	properties: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
	const result: Record<string, string | number | boolean> = {};
	for (const [key, value] of Object.entries(properties)) {
		if (!SAFE_GA4_KEYS.has(key)) continue;
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
