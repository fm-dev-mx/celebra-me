import { createLeadCode } from '@/lib/tracking/lead-code';
import { readConsent } from '@/lib/tracking/consent-client';
import { initGA4, forwardToGA4 } from '@/lib/tracking/ga4-forwarder';
import { initMetaPixel, forwardToMetaPixel } from '@/lib/tracking/meta-pixel';
import {
	createMetaAttributionSnapshot,
	metaAttributionOrUndefined,
	type MetaAttribution,
} from '@/lib/tracking/meta-attribution';

type TrackingEventName =
	| 'page_viewed'
	| 'section_seen'
	| 'scroll_depth_reached'
	| 'cta_clicked'
	| 'package_viewed'
	| 'demo_viewed'
	| 'form_started'
	| 'form_submitted'
	| 'whatsapp_contact_clicked';

type ConsentSnapshot = {
	necessary: true;
	analytics: boolean;
	marketing: boolean;
};

type TrackingPayload = {
	sessionId: string;
	visitorId: string;
	eventName: TrackingEventName;
	routePath: string;
	routeClass: string;
	source?: string;
	medium?: string;
	campaign?: string;
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
const FOLIO_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Default promo/price/campaign when no data-promo-code is set on the anchor.
// Centralized so a campaign change touches one line, not four.
const DEFAULT_PROMO_CODE = 'LANZAMIENTO-899';
const DEFAULT_PROMO_PRICE = '899';
const DEFAULT_PROMO_CAMPAIGN = 'FINAL-LANZAMIENTO-899';

// Match the folio format embedded in WhatsApp messages (see updateWhatsAppUrl).
const FOLIO_PATTERN = /CM-\d+-[A-Z0-9]{4}/i;

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

function createPromoFolio(priceSuffix: string): string {
	const values = new Uint8Array(4);
	if (crypto.getRandomValues) {
		crypto.getRandomValues(values);
	} else {
		values.forEach((_, index) => {
			values[index] = Math.floor(Math.random() * 256);
		});
	}

	const suffix = [...values]
		.map((value) => FOLIO_ALPHABET[value % FOLIO_ALPHABET.length])
		.join('');
	return `CM-${priceSuffix}-${suffix}`;
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

function getUtmSnapshot(): Record<string, string> {
	const params = new URLSearchParams(window.location.search);
	const current = {
		source: params.get('utm_source') ?? '',
		medium: params.get('utm_medium') ?? '',
		campaign: params.get('utm_campaign') ?? '',
	};

	if (current.source || current.medium || current.campaign) {
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
	eventName: TrackingEventName,
	properties: TrackingPayload['eventProperties'],
): void {
	window.dataLayer = window.dataLayer ?? [];
	window.dataLayer.push({
		event: eventName,
		...properties,
	});
}

async function trackEvent(
	eventName: TrackingEventName,
	eventProperties: TrackingPayload['eventProperties'] = {},
): Promise<void> {
	if (shouldIgnoreTracking()) return;

	const routeClass = document.body.dataset.trackingRouteClass;
	if (!routeClass) return;

	const utm = getUtmSnapshot();
	const metaAttribution = metaAttributionOrUndefined(getMetaAttributionSnapshot());
	const payload: TrackingPayload = {
		sessionId: getSessionId(),
		visitorId: getVisitorId(),
		eventName,
		routePath: window.location.pathname,
		routeClass,
		source: utm.source,
		medium: utm.medium,
		campaign: utm.campaign,
		metaAttribution,
		eventProperties,
		consentSnapshot: getConsentSnapshot(),
	};

	pushDataLayer(eventName, eventProperties);

	try {
		await fetch('/api/tracking/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			keepalive: true,
		});
	} catch {
		// Tracking must never break the page experience.
	}

	// Forward to consent-gated third-party integrations.
	forwardToGA4(eventName, eventProperties);
	forwardToMetaPixel(eventName, eventProperties);
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

function updateWhatsAppUrl(anchor: HTMLAnchorElement, folio: string, promoCode: string): void {
	const url = new URL(anchor.href);
	const baseMessage =
		url.searchParams.get('text') || 'Hola, quiero información sobre una invitación digital.';
	const messageParts = [baseMessage.trim()];
	if (!baseMessage.includes(`Cupón: ${promoCode}`)) {
		messageParts.push(`Cupón: ${promoCode}`);
	}
	if (!FOLIO_PATTERN.test(baseMessage)) {
		messageParts.push(`Folio: ${folio}`);
	}
	const message = messageParts.join('\n\n');
	url.searchParams.set('text', message);
	anchor.href = url.toString();
}

function getTrackedClickProperties(
	target: HTMLElement,
	leadCode: string,
	folio: string,
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
		folio,
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

		const eventName = target.dataset.trackEvent as TrackingEventName | undefined;
		if (!eventName) return;

		const isWhatsAppClick = eventName === 'whatsapp_contact_clicked';
		const leadCode = isWhatsAppClick ? createLeadCode() : '';

		let folio = '';
		let targetPromoCode = '';
		if (isWhatsAppClick && target instanceof HTMLAnchorElement) {
			// Reuse folio across repeated clicks on the same CTA so the same
			// WhatsApp thread is reachable from a single lead_code.
			if (target.dataset.trackedFolio) {
				folio = target.dataset.trackedFolio;
			} else {
				targetPromoCode = target.dataset.promoCode || DEFAULT_PROMO_CODE;
				const match = targetPromoCode.match(/(\d+)$/);
				const priceSuffix = match ? match[1] : DEFAULT_PROMO_PRICE;
				folio = createPromoFolio(priceSuffix);
				target.dataset.trackedFolio = folio;
			}
		}

		if (leadCode) {
			setContactHiddenFields(leadCode);
			if (target instanceof HTMLAnchorElement) {
				if (!targetPromoCode) {
					targetPromoCode = target.dataset.promoCode || DEFAULT_PROMO_CODE;
				}
				updateWhatsAppUrl(target, folio, targetPromoCode);
			}
		}

		void trackEvent(eventName, getTrackedClickProperties(target, leadCode, folio));
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
