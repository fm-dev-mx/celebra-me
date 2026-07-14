import { createLeadCode } from '@/lib/tracking/lead-code';
import { readConsent } from '@/lib/tracking/consent-client';
import { initGA4, forwardToGA4 } from '@/lib/tracking/ga4-forwarder';
import { initMetaPixel, forwardToMetaPixel } from '@/lib/tracking/meta-pixel';
import {
	createMetaAttributionSnapshot,
	metaAttributionOrUndefined,
	type MetaAttribution,
} from '@/lib/tracking/meta-attribution';
import type { PublicTrackingEventName } from '@/lib/tracking/event-contract';

type ConsentSnapshot = {
	necessary: true;
	analytics: boolean;
	marketing: boolean;
};

type TrackingPayload = {
	sessionId: string;
	visitorId: string;
	eventName: PublicTrackingEventName;
	routePath: string;
	routeClass: string;
	source?: string;
	medium?: string;
	campaign?: string;
	// Captured from URL params; schema columns already exist in visitor_sessions.
	utmContent?: string;
	utmTerm?: string;
	// Original browser document.referrer — sent only on the first event of the session.
	// Never populated from HTTP request headers, which reflect the API call itself.
	referrer?: string;
	metaAttribution?: MetaAttribution;
	eventProperties: Record<string, string | number | boolean>;
	consentSnapshot: ConsentSnapshot;
};

declare global {
	interface Window {
		dataLayer?: Array<Record<string, unknown>>;
		gtag?: (...args: unknown[]) => void;
	}
}

const VISITOR_KEY = 'cm_visitor_id';
const SESSION_KEY = 'cm_session_id';
const UTM_KEY = 'cm_utm_snapshot';
const IGNORE_COOKIE = 'cm_ignore_tracking=true';
const SCROLL_BUCKETS = [25, 50, 75, 90, 100] as const;

/**
 * sessionStorage key for the canonical WhatsApp lead code.
 * Scoped to the tab (sessionStorage lifetime) so repeated WhatsApp clicks within the same
 * tab reuse the same lead_code, preventing duplicate lead creation on the server.
 */
const WHATSAPP_LEAD_KEY = 'cm_whatsapp_lead_code';

/**
 * sessionStorage key set after the first tracking event of a session.
 * Ensures first-touch attribution values (landing_path, referrer) are sent exactly once
 * per session and not overwritten by subsequent events.
 */
const SESSION_INIT_KEY = 'cm_session_initialized';

// Default promo/price/campaign when no data-promo-code is set on the anchor.
// Centralized so a campaign change touches one line, not four.
const DEFAULT_PROMO_CODE = 'LANZAMIENTO-899';
const DEFAULT_PROMO_PRICE = '899';
const DEFAULT_PROMO_CAMPAIGN = 'FINAL-LANZAMIENTO-899';

function randomId(prefix: string): string {
	if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
	return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function fallbackUuid(): string {
	const values = new Uint8Array(16);
	crypto.getRandomValues(values);
	values[6] = (values[6] & 0x0f) | 0x40;
	values[8] = (values[8] & 0x3f) | 0x80;
	const hex = [...values].map((value) => value.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getVisitorId(): string {
	const existing = localStorage.getItem(VISITOR_KEY);
	if (existing) return existing;
	const visitorId = randomId('visitor');
	localStorage.setItem(VISITOR_KEY, visitorId);
	return visitorId;
}

function getSessionId(): string {
	const existing = sessionStorage.getItem(SESSION_KEY);
	if (existing) return existing;
	const sessionId = crypto.randomUUID ? crypto.randomUUID() : fallbackUuid();
	sessionStorage.setItem(SESSION_KEY, sessionId);
	return sessionId;
}

function getConsentSnapshot(): ConsentSnapshot {
	const state = readConsent();
	return {
		necessary: true,
		analytics: state.analytics,
		marketing: state.marketing,
	};
}

/**
 * Read UTM parameters from the URL, then fall back to the session snapshot.
 * Also captures utm_content and utm_term which are stored in visitor_sessions
 * schema columns but were previously not captured client-side.
 */
function getUtmSnapshot(): Record<string, string> {
	const params = new URLSearchParams(window.location.search);
	const current = {
		source: params.get('utm_source') ?? '',
		medium: params.get('utm_medium') ?? '',
		campaign: params.get('utm_campaign') ?? '',
		content: params.get('utm_content') ?? '',
		term: params.get('utm_term') ?? '',
	};

	if (current.source || current.medium || current.campaign || current.content || current.term) {
		sessionStorage.setItem(UTM_KEY, JSON.stringify(current));
		return current;
	}

	try {
		return JSON.parse(sessionStorage.getItem(UTM_KEY) ?? '{}') as Record<string, string>;
	} catch {
		return {};
	}
}

function getMetaAttributionSnapshot(): MetaAttribution {
	return createMetaAttributionSnapshot({
		url: new URL(window.location.href),
		cookie: document.cookie,
	});
}

function shouldIgnoreTracking(): boolean {
	return document.cookie.split(';').some((cookie) => cookie.trim() === IGNORE_COOKIE);
}

function pushDataLayer(
	eventName: PublicTrackingEventName,
	properties: TrackingPayload['eventProperties'],
): void {
	window.dataLayer = window.dataLayer ?? [];
	window.dataLayer.push({
		event: eventName,
		...properties,
	});
}

/**
 * Returns the original browser referrer for first-touch attribution, or undefined on
 * subsequent events within the same session.
 *
 * The browser's document.referrer is only meaningful on the initial page load: it reflects
 * the external site from which the visitor arrived. On subsequent pages within the same
 * session, document.referrer is the previous internal page, which would overwrite the
 * first-touch external referrer stored in visitor_sessions.
 *
 * We use SESSION_INIT_KEY in sessionStorage as the guard. On the first event the key is
 * absent and we capture document.referrer; after that we return undefined so the server
 * does not receive a value to overwrite.
 */
function getFirstTouchReferrer(): string | undefined {
	try {
		const alreadyInitialized = sessionStorage.getItem(SESSION_INIT_KEY) !== null;
		if (alreadyInitialized) return undefined;
		// Capture the referrer before setting the flag, so callers see the value.
		const referrer = document.referrer || undefined;
		return referrer;
	} catch {
		return undefined;
	}
}

/** Mark the session as initialized so first-touch data is not re-sent on subsequent events. */
function markSessionInitialized(): void {
	try {
		sessionStorage.setItem(SESSION_INIT_KEY, '1');
	} catch {
		// sessionStorage unavailable — degrade gracefully.
	}
}

function trackEvent(
	eventName: PublicTrackingEventName,
	eventProperties: TrackingPayload['eventProperties'] = {},
): void {
	if (shouldIgnoreTracking()) return;

	const routeClass = document.body.dataset.trackingRouteClass;
	if (!routeClass) return;

	const utm = getUtmSnapshot();
	const metaAttribution = metaAttributionOrUndefined(getMetaAttributionSnapshot());
	const firstTouchReferrer = getFirstTouchReferrer();

	const payload: TrackingPayload = {
		sessionId: getSessionId(),
		visitorId: getVisitorId(),
		eventName,
		routePath: window.location.pathname,
		routeClass,
		source: utm.source,
		medium: utm.medium,
		campaign: utm.campaign,
		utmContent: utm.content || undefined,
		utmTerm: utm.term || undefined,
		referrer: firstTouchReferrer,
		metaAttribution,
		eventProperties,
		consentSnapshot: getConsentSnapshot(),
	};

	pushDataLayer(eventName, eventProperties);

	// Synchronously forward to GA4 and Meta Pixel BEFORE any async network operations.
	// This guarantees that outbound navigation events (like WhatsApp clicks) are tracked
	// immediately without being suspended or cancelled by microtask delays.
	forwardToGA4(eventName, eventProperties);
	forwardToMetaPixel(eventName, eventProperties);

	try {
		// Use keepalive: true to ensure the request is completed in the background
		// by the browser after page unload. We do not await this fetch so that
		// subsequent page navigation is never blocked or delayed.
		void fetch('/api/tracking/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			keepalive: true,
		})
			.then((response) => {
				// Mark the session as initialized only on successful delivery.
				// If the first request fails, subsequent events will retry sending
				// first-touch attribution parameters.
				if (response.ok) {
					markSessionInitialized();
				}
			})
			.catch(() => {
				// Tracking failures must never break the page experience.
			});
	} catch {
		// Degrade gracefully if keepalive fetch is not supported/throws.
	}
}

function setContactHiddenFields(leadCode: string): void {
	const utm = getUtmSnapshot();
	const metaAttribution = getMetaAttributionSnapshot();
	document.querySelectorAll('form[data-commercial-contact-form]').forEach((form) => {
		if (!(form instanceof HTMLFormElement)) return;
		const values: Record<string, string> = {
			sessionId: getSessionId(),
			visitorId: getVisitorId(),
			leadCode,
			utmSource: utm.source ?? '',
			utmMedium: utm.medium ?? '',
			utmCampaign: utm.campaign ?? '',
			fbp: metaAttribution.fbp ?? '',
			fbc: metaAttribution.fbc ?? '',
			fbclid: metaAttribution.fbclid ?? '',
		};
		Object.entries(values).forEach(([name, value]) => {
			const field = form.elements.namedItem(name);
			if (field instanceof HTMLInputElement) field.value = value;
		});
	});
}

function getOrCreateFormLeadCode(form: HTMLFormElement, fallbackLeadCode: string): string {
	const field = form.elements.namedItem('leadCode');
	if (!(field instanceof HTMLInputElement)) return fallbackLeadCode;

	const currentLeadCode = field.value.trim();
	if (currentLeadCode) return currentLeadCode;

	const nextLeadCode = fallbackLeadCode || createLeadCode();
	field.value = nextLeadCode;
	return nextLeadCode;
}

function bindSectionVisibility(): void {
	if (!('IntersectionObserver' in window)) return;

	const seen = new Set<string>();
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting || entry.intersectionRatio < 0.4) return;
				const element = entry.target;
				if (!(element instanceof HTMLElement)) return;
				const sectionId = element.dataset.trackSection;
				if (!sectionId || seen.has(sectionId)) return;
				seen.add(sectionId);
				void trackEvent('section_seen', {
					section_id: sectionId,
					visibility_bucket: 50,
				});
			});
		},
		{ threshold: [0.4, 0.6] },
	);

	document
		.querySelectorAll('[data-track-section]')
		.forEach((element) => observer.observe(element));
}

function bindScrollDepth(): void {
	const reached = new Set<number>();
	const handleScroll = () => {
		const scrollable = document.documentElement.scrollHeight - window.innerHeight;
		if (scrollable <= 0) return;
		const depth = Math.round((window.scrollY / scrollable) * 100);
		SCROLL_BUCKETS.forEach((bucket) => {
			if (depth < bucket || reached.has(bucket)) return;
			reached.add(bucket);
			void trackEvent('scroll_depth_reached', { depth_bucket: bucket });
		});
	};
	window.addEventListener('scroll', handleScroll, { passive: true });
	handleScroll();
}

/**
 * Rewrite the WhatsApp URL to include the canonical lead_code in the message text.
 *
 * The canonical CM-XXXXXX lead_code is embedded directly in the WhatsApp message so
 * customers can quote it when contacting the host, and operators can search it in the CRM.
 * Previously a separate folio format (CM-899-XXXX) was used, which could not be resolved
 * back to the lead stored under the canonical code.
 */
function updateWhatsAppUrl(anchor: HTMLAnchorElement, leadCode: string, promoCode: string): void {
	const url = new URL(anchor.href);
	const baseMessage =
		url.searchParams.get('text') || 'Hola, quiero información sobre una invitación digital.';
	const messageParts = [baseMessage.trim()];
	if (!baseMessage.includes(`Cupón: ${promoCode}`)) {
		messageParts.push(`Cupón: ${promoCode}`);
	}
	// Embed the canonical lead_code so the customer's WhatsApp message and the CRM record
	// share the same identifier. Pattern: CM-XXXXXX (6 alphanumeric chars, no price suffix).
	const CANONICAL_LEAD_CODE_PATTERN = /CM-[A-Z0-9]{6}(?!\d)/i;
	if (!CANONICAL_LEAD_CODE_PATTERN.test(baseMessage)) {
		messageParts.push(`Folio: ${leadCode}`);
	}
	const message = messageParts.join('\n\n');
	url.searchParams.set('text', message);
	anchor.href = url.toString();
}

/**
 * Get or create the session-scoped WhatsApp lead code.
 *
 * On the first WhatsApp click within the session, a new CM-XXXXXX code is created,
 * stored in sessionStorage, and returned. Subsequent clicks within the same tab reuse
 * the stored code, preventing duplicate lead creation on the server.
 *
 * Storage lifetime: tab (sessionStorage). Clearing storage or opening a new tab
 * starts a fresh lead code on the next WhatsApp click.
 */
const CANONICAL_LEAD_CODE_EXACT = /^CM-[A-Z0-9]{6}$/i;

function getOrCreateWhatsAppLeadCode(): string {
	try {
		const existing = sessionStorage.getItem(WHATSAPP_LEAD_KEY);
		if (existing && CANONICAL_LEAD_CODE_EXACT.test(existing)) {
			return existing.toUpperCase();
		}
		const code = createLeadCode();
		sessionStorage.setItem(WHATSAPP_LEAD_KEY, code);
		return code;
	} catch {
		// sessionStorage unavailable — generate a code for this click only (no persistence).
		return createLeadCode();
	}
}

function getTrackedClickProperties(
	target: HTMLElement,
	leadCode: string,
): TrackingPayload['eventProperties'] {
	// event_type se lee del propio anchor; cae a 'general' cuando el CTA
	// no pertenece a un selector de evento (Pricing, ProductProof, etc.).
	const eventType = target.dataset.eventType ?? 'general';
	return {
		cta_id: target.dataset.trackCta ?? '',
		cta_label: target.dataset.trackLabel ?? target.textContent?.trim().slice(0, 120) ?? '',
		cta_location: target.dataset.trackSection ?? '',
		destination: target.dataset.trackDestination ?? target.dataset.trackIntent ?? '',
		destination_type: target.dataset.trackIntent ?? '',
		event_type: eventType,
		package_id: target.dataset.packageInterest ?? '',
		package_name: target.dataset.packageName ?? '',
		source_area: target.dataset.trackSection ?? '',
		promo_code: target.dataset.promoCode ?? '',
		campaign_code: target.dataset.campaignCode ?? '',
		value: Number(target.dataset.trackValue ?? 0) || 0,
		currency: target.dataset.trackCurrency ?? '',
		demo_slug: target.dataset.demoSlug ?? '',
		lead_code: leadCode,
	};
}

function bindPackageViews(): void {
	if (!('IntersectionObserver' in window)) return;

	const seen = new Set<string>();
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting || entry.intersectionRatio < 0.4) return;
				if (!(entry.target instanceof HTMLElement)) return;

				const packageId = entry.target.dataset.packageId ?? '';
				const packageName = entry.target.dataset.packageName ?? packageId;
				if (!packageId || seen.has(packageId)) return;

				seen.add(packageId);
				void trackEvent('package_viewed', {
					package_id: packageId,
					package_name: packageName,
					content_name: packageName,
					content_category: 'package',
					source_area: entry.target.dataset.sourceArea ?? 'pricing',
				});
			});
		},
		{ threshold: [0.4, 0.6] },
	);

	document
		.querySelectorAll<HTMLElement>('[data-track-package-view]')
		.forEach((element) => observer.observe(element));
}

function bindClicks(): void {
	document.addEventListener('click', (event) => {
		const target =
			event.target instanceof Element ? event.target.closest('[data-track-event]') : null;
		if (!(target instanceof HTMLElement)) return;

		const eventName = target.dataset.trackEvent as PublicTrackingEventName | undefined;
		if (!eventName) return;

		const isWhatsAppClick = eventName === 'whatsapp_contact_clicked';

		// For WhatsApp clicks, resolve the session-scoped lead code. All repeated clicks
		// within the same tab reuse the same code, preventing duplicate lead creation.
		// Non-WhatsApp clicks do not generate a lead code here.
		const leadCode = isWhatsAppClick ? getOrCreateWhatsAppLeadCode() : '';

		if (isWhatsAppClick && target instanceof HTMLAnchorElement && leadCode) {
			const targetPromoCode = target.dataset.promoCode || DEFAULT_PROMO_CODE;
			// Update the WhatsApp message to include the canonical lead_code so the customer
			// can quote it and the operator can search it directly in the CRM.
			updateWhatsAppUrl(target, leadCode, targetPromoCode);
			setContactHiddenFields(leadCode);
		}

		void trackEvent(eventName, getTrackedClickProperties(target, leadCode));
	});
}

function bindForms(): void {
	document.querySelectorAll('form[data-commercial-contact-form]').forEach((form) => {
		if (!(form instanceof HTMLFormElement)) return;
		const leadCode = createLeadCode();
		setContactHiddenFields(leadCode);

		let started = false;
		form.addEventListener(
			'input',
			() => {
				if (started) return;
				started = true;
				void trackEvent('form_started', { form_id: 'contact' });
			},
			{ passive: true },
		);
		form.addEventListener('commercial-contact-submitted', () => {
			const currentLeadCode = getOrCreateFormLeadCode(form, leadCode);
			const eventTypeField = form.elements.namedItem('eventType');
			const eventType =
				eventTypeField instanceof HTMLInputElement ||
				eventTypeField instanceof HTMLSelectElement
					? eventTypeField.value.trim()
					: '';
			void trackEvent('form_submitted', {
				form_id: 'contact',
				lead_code: currentLeadCode,
				event_id: currentLeadCode,
				event_type: eventType,
				source_area: 'contact',
				promo_code: DEFAULT_PROMO_CODE,
				campaign_code: DEFAULT_PROMO_CAMPAIGN,
				value: Number(DEFAULT_PROMO_PRICE),
				currency: 'MXN',
			});
		});
	});
}

export function initCommercialTracking(): void {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initCommercialTracking, { once: true });
		return;
	}

	if (!document.body.dataset.trackingRouteClass || shouldIgnoreTracking()) return;
	const routeClass = document.body.dataset.trackingRouteClass;

	// Initialize third-party integrations gated by consent.
	initGA4();
	initMetaPixel();

	void trackEvent('page_viewed', { page_type: routeClass });
	if (routeClass === 'demo') {
		const [, eventType = '', demoSlug = ''] = window.location.pathname.split('/');
		void trackEvent('demo_viewed', {
			demo_slug: demoSlug,
			event_type: eventType,
			content_name: demoSlug,
			content_category: 'demo',
			source_area: 'demo_page',
		});
	}
	bindSectionVisibility();
	bindPackageViews();
	bindScrollDepth();
	bindClicks();
	bindForms();
}
