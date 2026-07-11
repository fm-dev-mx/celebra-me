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
 *
 * An internal event queue buffers events that arrive during the brief window
 * between gtag.js starting to load and finishing. The queue is flushed after
 * the script loads, so consented events are never silently dropped because
 * gtag.js was still bootstrapping.
 *
 * Error recovery: if gtag.js fails to load, gaLoaded stays false and the
 * pending queue is discarded. A later re-initialization (e.g. on the next
 * page navigation, which triggers a fresh initGA4 call, or if consent is
 * withdrawn and re-granted) will attempt to load the script again. There is
 * no automatic retry during the same page lifecycle — the assumption is that
 * a script-load failure is transient and will resolve on the next navigation.
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

// Bounded event queue — absorbs events that arrive while gtag.js is loading
// but before it finishes. Flushed once the script becomes available.
const pendingEvents: Array<{
	eventName: string;
	eventProperties: Record<string, string | number | boolean>;
}> = [];
const MAX_PENDING_EVENTS = 30;

// Tracks whether a page_view has been forwarded to GA4 in the current page
// lifecycle. Prevents duplicate page_views when the deferred flush and the
// synchronous trackEvent path both attempt to forward one.
let pageViewForwarded = false;

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
		// Return a promise that resolves when the script loads OR when
		// loading is abandoned (error / cancellation). In the error case
		// the caller's .then(flushPendingEvents) is guarded by gaLoaded.
		return new Promise((resolve) => {
			const checkLoaded = () => {
				if (gaLoaded || !gaLoading) resolve();
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
			// Loading failed — do NOT set gaLoaded to true. Keep gaLoaded
			// false so that:
			//   1. flushPendingEvents (guarded by gaLoaded) is a no-op.
			//   2. queued events are discarded (they cannot be forwarded).
			//   3. a later initialization attempt can retry.
			gaLoading = false;
			pendingEvents.splice(0);
			resolve();
		};
		document.head.appendChild(script);
	});
}

/**
 * Replay any events that were queued while gtag.js was loading, then send a
 * deferred page_view if one was never forwarded (the initial page_viewed ran
 * before gtag.js was available).
 *
 * Safe to call multiple times — the second call is a no-op.
 */
function flushPendingEvents(): void {
	// Guard: if gtag.js never loaded (script.onerror), gaLoaded is false
	// and no events can be forwarded. The queue was already cleared by
	// the error handler.
	if (!gaLoaded) {
		pageViewForwarded = false;
		return;
	}

	// Replay queued events in FIFO order.
	const events = pendingEvents.splice(0);
	for (const { eventName, eventProperties } of events) {
		forwardToGA4(eventName, eventProperties);
	}

	// If the initial page_view was never forwarded (first visit where consent
	// was granted after page load, or gtag loaded synchronously before
	// trackEvent completed), forward it now.
	if (!pageViewForwarded) {
		forwardToGA4('page_viewed', {
			page_type: document.body.dataset.trackingRouteClass ?? '',
		});
	}
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
		void loadGtagScript().then(() => {
			flushPendingEvents();
		});
	}

	// React to consent changes: load if newly granted.
	subscribeConsentChange((state: ConsentState) => {
		if (state.analytics && !gaLoaded && !gaLoading) {
			void loadGtagScript().then(() => {
				flushPendingEvents();
			});
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
 *
 * When gtag.js is still loading, the event is enqueued for replay after
 * the script finishes. Events arriving before gtag.js has started loading
 * (pre-consent) are silently dropped — they represent interactions that
 * happened before analytics consent was granted.
 */
export function forwardToGA4(
	eventName: string,
	eventProperties: Record<string, string | number | boolean>,
): void {
	if (!gaLoaded) {
		// Only queue events during the active-loading window.
		// Pre-consent events (gaLoading = false) are never buffered.
		if (gaLoading && pendingEvents.length < MAX_PENDING_EVENTS) {
			pendingEvents.push({ eventName, eventProperties });
		}
		return;
	}

	const consent = readConsent();
	if (!consent.analytics) return;

	const gtag = window.gtag;
	if (!gtag) return;

	// Map first-party event names to GA4 event names.
	const ga4EventName = mapEventName(eventName);
	if (!ga4EventName) return;

	// Prevent duplicate page_view when the deferred flush runs before the
	// trackEvent path had a chance to forward the initial page_viewed.
	if (ga4EventName === 'page_view' && pageViewForwarded) return;

	// Strip any properties not in the safe allowlist.
	const safeParams = sanitizeForGA4(eventProperties);
	gtag('event', ga4EventName, safeParams);

	if (ga4EventName === 'page_view') {
		pageViewForwarded = true;
	}
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
	// lead_created is currently emitted server-side only, so the client-side GA4
	// forwarder cannot receive it yet. Re-enable when lead_created is dispatched
	// client-side or when server-side GA4 Measurement Protocol is implemented.
	// lead_created: 'generate_lead',
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
