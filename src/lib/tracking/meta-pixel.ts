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
 * Browser events:
 *   - PageView    (from first-party page_viewed forwarding, or late-consent catch-up)
 *   - ViewContent (demo_viewed, package_viewed)
 *   - Contact     (whatsapp_contact_clicked; the conversion ads optimize for), followed by the
 *                 custom WhatsAppClick copy so earlier custom conversions keep counting
 *   - Lead        (form_submitted from the «Aparta su fecha» capture form)
 *
 * Every event of one activation carries the first-party technical UUID as `eventID`.
 * Purchase is sent only server-side through the Conversions API
 * (src/lib/commercial/meta-capi/service.ts).
 *
 * Automatic Advanced Matching / auto-config is explicitly disabled
 * so the Pixel never auto-collects form fields or PII from the page.
 * Manual match keys:
 *   - `external_id`: the SHA-256 of the first-party visitor ID, the value the Conversions API
 *     sends for the same browser.
 *   - `ph`: after the «Aparta su fecha» form, the SHA-256 of the phone's E.164 digits, the value
 *     the Conversions API sends for the lead's customer. Only the hash is stored, in first-party
 *     localStorage, with marketing consent and for PHONE_MATCH_TTL_MS; withdrawing consent
 *     deletes it (consent-client.ts). It applies from the next Pixel initialization on.
 *
 * Pending-event queue:
 *   Events generated after marketing consent but before fbevents.js finishes loading are
 *   held in `pendingEvents`. They flush exactly once after a successful `onload`, in order.
 *   On script failure, the queue is discarded and the Pixel is marked unavailable.
 *
 * Late-consent PageView:
 *   When consent is granted after page load, exactly one PageView is fired for the current
 *   pathname after the Pixel initializes. A guard prevents duplicate PageViews if consent
 *   fires or initMetaPixel() is called more than once.
 *
 * Error and retry:
 *   `onerror` sets pixelFailed = true (NOT pixelLoaded). Subsequent trackMetaEvent calls
 *   are silently dropped until a successful retry. A later initMetaPixel() call can retry
 *   loading because pixelLoaded remains false. Duplicate script injection is prevented by
 *   checking for an existing fbevents.js <script> before appending a new one.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { normalizeCommercialPhone } from '@/lib/commercial/phone';
import {
	META_PHONE_MATCH_STORAGE_KEY,
	readConsent,
	subscribeConsentChange,
	VISITOR_STORAGE_KEY,
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

type PendingMetaEvent = {
	metaEvent: string;
	parameters: Record<string, string | number | boolean>;
	options: { eventID?: string } | undefined;
};

let pixelLoaded = false;
let pixelLoading = false;
let pixelFailed = false;
let pixelId = '';

/** Events queued while the script is loading. Flushed exactly once on successful load. */
const pendingEvents: PendingMetaEvent[] = [];

/**
 * Path for which a late-consent PageView has already been sent.
 * Empty string means no late-consent PageView has been sent yet.
 * Prevents duplicate PageViews when consent fires more than once.
 */
let pageViewSentForPath = '';

function routeAllowsMeta(): boolean {
	return classifyTrackingRoute(window.location.pathname).metaAllowed;
}

function environmentAllowsMeta(): boolean {
	return document.body.dataset.metaDeliveryBlocked !== 'true';
}

function shouldLoad(): boolean {
	if (!environmentAllowsMeta()) return false;
	if (!document.body.dataset.trackingRouteClass) return false;
	if (!routeAllowsMeta()) return false;
	if (!pixelId) return false;
	if (!isPixelEnabledInEnv()) return false;
	return true;
}

function sha256Hex(value: string): string {
	const digest = sha256(new TextEncoder().encode(value));
	return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 hex of the stored first-party visitor ID, normalized like `hashSha256` in the CAPI
 * service (trim, lowercase) so the browser and server copies carry the same `external_id`.
 */
export function hashVisitorIdForMeta(visitorId: string): string {
	return sha256Hex(visitorId.trim().toLowerCase());
}

/** How long the hashed phone stays usable after the form: Meta's own `_fbp` cookie lifetime. */
export const PHONE_MATCH_TTL_MS = 90 * 86_400_000;

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * SHA-256 hex of the phone's E.164 digits (country code included, no `+`), the same value
 * `normalizeAndHashPhone` in the CAPI service sends for the customer's `phone_e164`.
 */
export function hashPhoneForMeta(phone: string): string | undefined {
	const normalized = normalizeCommercialPhone(phone);
	return normalized ? sha256Hex(normalized.e164.replace(/\D/g, '')) : undefined;
}

/**
 * Store the hashed phone from a submitted «Aparta su fecha» form so later Pixel initializations
 * in this browser send it as `ph`. Without marketing consent nothing is stored.
 */
export function rememberMetaPhoneMatchKey(phone: string, now = Date.now()): void {
	if (!readConsent().marketing) return;
	const hash = hashPhoneForMeta(phone);
	if (!hash) return;
	try {
		localStorage.setItem(
			META_PHONE_MATCH_STORAGE_KEY,
			JSON.stringify({ ph: hash, expiresAt: now + PHONE_MATCH_TTL_MS }),
		);
	} catch {
		// Storage can be blocked; the Pixel keeps working with its other match keys.
	}
}

/** The stored hashed phone while consent holds and it has not expired; otherwise deletes it. */
export function readMetaPhoneMatchKey(now = Date.now()): string | undefined {
	try {
		const raw = localStorage.getItem(META_PHONE_MATCH_STORAGE_KEY);
		if (!raw) return undefined;
		const parsed = JSON.parse(raw) as { ph?: unknown; expiresAt?: unknown };
		const usable =
			readConsent().marketing &&
			typeof parsed.ph === 'string' &&
			SHA256_HEX.test(parsed.ph) &&
			typeof parsed.expiresAt === 'number' &&
			parsed.expiresAt > now;
		if (usable) return parsed.ph as string;
		localStorage.removeItem(META_PHONE_MATCH_STORAGE_KEY);
	} catch {
		// Blocked storage or a corrupted value: send no phone.
	}
	return undefined;
}

function readVisitorExternalId(): string | undefined {
	try {
		const visitorId = localStorage.getItem(VISITOR_STORAGE_KEY)?.trim();
		return visitorId ? hashVisitorIdForMeta(visitorId) : undefined;
	} catch {
		// Storage can be blocked; the Pixel still works without the match key.
		return undefined;
	}
}

/** Flush the pending-event queue. Called once after successful onload. */
function flushPendingEvents(): void {
	const toFlush = pendingEvents.splice(0);
	for (const entry of toFlush) {
		const method = STANDARD_META_EVENTS.has(entry.metaEvent) ? 'track' : 'trackCustom';
		if (entry.options?.eventID) {
			window.fbq?.(method, entry.metaEvent, entry.parameters, entry.options);
		} else {
			window.fbq?.(method, entry.metaEvent, entry.parameters);
		}
	}
}

/**
 * Dynamically load the Meta Pixel script. Safe to call multiple times.
 *
 * State machine:
 *   - pixelLoaded=false, pixelLoading=false, pixelFailed=false → start loading
 *   - pixelLoaded=false, pixelLoading=true                     → return a waiter promise
 *   - pixelLoaded=true                                         → already loaded, resolve
 *   - pixelFailed=true (implies !pixelLoaded)                  → reset failed flag, retry
 *
 * Duplicate script injection is prevented by checking for an existing fbevents.js <script>
 * before appending a new one. This protects against concurrent calls that both pass the
 * pixelLoading guard before either sets pixelLoading = true.
 */
function loadPixelScript(): Promise<void> {
	if (pixelLoaded) return Promise.resolve();

	if (pixelLoading) {
		// Another call is already in flight. Return a promise that resolves (or rejects)
		// when the loading state changes. We poll at 50 ms to stay bounded.
		return new Promise<void>((resolve, reject) => {
			const check = () => {
				if (pixelLoaded) return resolve();
				if (pixelFailed) return reject(new Error('Meta Pixel script failed to load'));
				if (!pixelLoading) return resolve(); // Should not happen but safe fallback
				setTimeout(check, 50);
			};
			check();
		});
	}

	// If a previous load attempt failed, clean up the dead script element from the DOM
	// so that we can create a fresh one to trigger a real browser retry.
	if (pixelFailed) {
		pixelFailed = false;
		const existingScript = document.querySelector(
			'script[src*="connect.facebook.net"][src*="fbevents.js"]',
		);
		if (existingScript) {
			existingScript.remove();
		}
	}

	pixelLoading = true;

	return new Promise<void>((resolve, reject) => {
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

		// Prevent duplicate script injection if a previous attempt already appended the tag.
		const existingScript = document.querySelector(
			'script[src*="connect.facebook.net"][src*="fbevents.js"]',
		);

		const script =
			existingScript instanceof HTMLScriptElement
				? existingScript
				: (() => {
						const el = document.createElement('script');
						el.async = true;
						el.src = 'https://connect.facebook.net/en_US/fbevents.js';
						return el;
					})();

		script.onload = () => {
			// Disable automatic advanced matching — prevents auto-collection
			// of form fields and PII from the page.
			window.fbq?.('set', 'autoConfig', false, id);
			// Initialize the pixel with the manual match keys: hashed visitor ID and phone.
			const matchKeys: Record<string, string> = {};
			const externalId = readVisitorExternalId();
			if (externalId) matchKeys.external_id = externalId;
			const phoneHash = readMetaPhoneMatchKey();
			if (phoneHash) matchKeys.ph = phoneHash;
			if (Object.keys(matchKeys).length > 0) {
				window.fbq?.('init', id, matchKeys);
			} else {
				window.fbq?.('init', id);
			}
			pixelLoaded = true;
			pixelLoading = false;
			pixelFailed = false;
			// Flush queued events before resolving so callers see the pixel as ready.
			flushPendingEvents();
			resolve();
		};

		script.onerror = () => {
			// Mark the pixel as unavailable, NOT as loaded. Setting pixelLoaded = true here
			// was the original bug: it allowed subsequent event calls to invoke the broken
			// fbq stub and blocked retry by making initMetaPixel() think it was done.
			pixelLoaded = false;
			pixelLoading = false;
			pixelFailed = true;
			// Discard queued events — they cannot be delivered after a terminal failure.
			pendingEvents.splice(0);
			reject(new Error('Meta Pixel script failed to load'));
		};

		if (!existingScript) {
			document.head.appendChild(script);
		}
	});
}

/**
 * Initialize Meta Pixel: check gates and load script.
 *
 * On initial page load with marketing consent, triggers script loading.
 * On late consent (granted after page load), loads the script and fires one PageView
 * for the current page — the only safe recovery for events that occurred before consent.
 * Pre-consent interactions (scroll, section views, etc.) are NOT replayed.
 */
export function initMetaPixel(): void {
	pixelId = getPixelIdFromEnv();
	if (!pixelId) return;
	if (!shouldLoad()) return;

	const consent = readConsent();
	if (consent.marketing && !pixelLoaded && !pixelLoading) {
		void loadPixelScript().catch(() => {
			// Failure recorded in pixelFailed; callers check that flag.
		});
	}

	// React to consent changes: load the Pixel if newly granted,
	// then fire exactly one PageView for the current page.
	subscribeConsentChange((state: ConsentState) => {
		if (!state.marketing) return; // Consent rejected or withdrawn — no action.
		if (!shouldLoad()) return; // Route check or configuration check failed.
		if (pixelLoaded || pixelLoading) return; // Already in flight or done.

		const currentPath = window.location.pathname;

		void loadPixelScript()
			.then(() => {
				// Send a late-consent PageView for the current page.
				// This is the only pre-consent interaction we replay: the page itself.
				// Scroll events, section views, and click interactions are NOT replayed.
				if (pageViewSentForPath !== currentPath) {
					pageViewSentForPath = currentPath;
					const method = 'track';
					window.fbq?.(method, 'PageView', { content_category: 'page' });
				}
			})
			.catch(() => {
				// Script load failed; the error is already recorded in pixelFailed.
			});
	});
}

/**
 * Track a Meta Pixel event. Called only after marketing consent is verified.
 *
 * If the Pixel is still loading, the event is held in the pending queue and will be
 * flushed exactly once after the script loads successfully.
 *
 * If the Pixel has permanently failed (pixelFailed), the event is dropped silently.
 *
 * Standard Meta events (PageView, ViewContent, Lead, Contact) are sent via
 * fbq('track', ...). Any other mapped event is sent via fbq('trackCustom', ...)
 * and appears as a custom event in Events Manager.
 */
function trackMetaEvent(
	eventName: string,
	parameters?: Record<string, string | number | boolean>,
	options?: { eventID?: string },
): void {
	const consent = readConsent();
	if (!consent.marketing) return;
	if (!environmentAllowsMeta()) return;
	if (!routeAllowsMeta()) return; // Respect route boundaries and do not track on disallowed pages.

	if (pixelFailed) {
		// Terminal failure path — drop silently. No marketing events after failure.
		return;
	}

	if (pixelLoading) {
		// Enforce a maximum queue size to prevent uncontrolled memory growth if loading hangs.
		if (pendingEvents.length >= 100) {
			pendingEvents.shift(); // Drop the oldest event to make room
		}
		// Script is in flight — queue the event for flush after onload.
		pendingEvents.push({
			metaEvent: eventName,
			parameters: parameters ?? {},
			options,
		});
		return;
	}

	if (!pixelLoaded) return;

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
	for (const copy of META_EVENT_COPIES[eventName] ?? []) {
		trackMetaEvent(copy, payload.parameters, payload.options);
	}
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

/**
 * Custom events sent right after the mapped standard event with the same parameters and
 * `eventID`. Meta deduplicates by event name plus ID, so a copy never merges with its
 * standard event. WhatsAppClick keeps custom conversions created before Contact returned.
 */
const META_EVENT_COPIES: Record<string, readonly string[]> = {
	whatsapp_contact_clicked: ['WhatsAppClick'],
};

function mapToMetaEvent(firstPartyName: string): string | undefined {
	return META_EVENT_MAP[firstPartyName] ?? undefined;
}

// Only non-PII, low-cardinality identifiers. No names, emails, phones,
// message text, guest data, invite IDs, tokens, or claim codes.
const SAFE_META_KEYS = new Set([
	'content_name',
	'content_category',
	'event_type',
	'source_area',
	'demo_slug',
	'cta_id',
	'cta_location',
	'destination_type',
]);

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
	if (demoSlug) parameters.demo_slug = demoSlug;
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
	// Consultation codes are private CRM correlation data, never provider event IDs.
	const candidateId = pickNonEmptyString(properties.event_id);
	const eventId =
		candidateId &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateId)
			? candidateId
			: undefined;
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
			base = {
				...buildContactPayload(properties),
				...Object.fromEntries(
					['demo_slug', 'cta_id', 'cta_location', 'destination_type']
						.filter((key) => typeof properties[key] === 'string')
						.map((key) => [key, properties[key]]),
				),
			};
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
