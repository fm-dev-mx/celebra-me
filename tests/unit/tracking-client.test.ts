jest.mock('@/lib/tracking/ga4-forwarder', () => ({
	initGA4: jest.fn(),
	forwardToGA4: jest.fn(),
}));

jest.mock('@/lib/tracking/meta-pixel', () => ({
	initMetaPixel: jest.fn(),
	forwardToMetaPixel: jest.fn(),
}));

jest.mock('@/lib/tracking/consent-client', () => ({
	readConsent: jest.fn(() => ({
		necessary: true as const,
		analytics: true,
		marketing: true,
		updatedAt: '2026-07-07T00:00:00.000Z',
	})),
}));

import { MockIntersectionObserver } from '../helpers/intersection-observer';
import { initCommercialTracking } from '@/lib/tracking/client';

function flushPromises(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

function getTrackedPayloads(fetchMock: jest.Mock): Array<Record<string, unknown>> {
	return fetchMock.mock.calls.map((call) => {
		const init = call[1] as RequestInit | undefined;
		return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
	});
}

describe('initCommercialTracking package views', () => {
	const fetchMock = jest.fn(() => Promise.resolve({ ok: true }));

	beforeEach(() => {
		jest.clearAllMocks();
		MockIntersectionObserver.instances = [];
		window.history.replaceState({}, '', '/?fbclid=Click-123');
		document.body.innerHTML = `
			<section data-track-section="pricing">
				<article
					data-track-package-view
					data-package-id="premium"
					data-package-name="Premium"
					data-source-area="pricing"
				></article>
			</section>
		`;
		document.body.dataset.trackingRouteClass = 'commercial';
		Object.defineProperty(document, 'readyState', {
			configurable: true,
			value: 'complete',
		});
		Reflect.set(window, 'IntersectionObserver', MockIntersectionObserver);
		Reflect.set(globalThis, 'IntersectionObserver', MockIntersectionObserver);
		Reflect.set(globalThis, 'fetch', fetchMock);
		window.localStorage.clear();
		window.sessionStorage.clear();
	});

	it('sends Meta attribution as top-level payload data on commercial routes', async () => {
		Object.defineProperty(document, 'cookie', {
			configurable: true,
			value: '_fbp=fb.1.1710000000000.1234567890; _fbc=fb.1.1710000000000.Click-123',
		});

		initCommercialTracking();
		await flushPromises();

		const pageView = getTrackedPayloads(fetchMock).find(
			(payload) => payload.eventName === 'page_viewed',
		);
		expect(pageView).toEqual(
			expect.objectContaining({
				metaAttribution: {
					fbp: 'fb.1.1710000000000.1234567890',
					fbc: 'fb.1.1710000000000.Click-123',
					fbclid: 'Click-123',
				},
				eventProperties: { page_type: 'commercial' },
			}),
		);
		expect(pageView?.eventProperties).not.toHaveProperty('fbp');
		expect(pageView?.eventProperties).not.toHaveProperty('fbc');
		expect(pageView?.eventProperties).not.toHaveProperty('fbclid');
	});

	it('tracks package_viewed once with pricing metadata when a package card enters view', async () => {
		initCommercialTracking();

		const packageCard = document.querySelector('[data-track-package-view]');
		expect(packageCard).not.toBeNull();

		const packageObserver = MockIntersectionObserver.instances.find((observer) =>
			packageCard ? observer.observed.has(packageCard) : false,
		);
		expect(packageObserver).toBeDefined();

		packageObserver?.trigger(packageCard as Element, 0.6);
		await flushPromises();

		const payloads = getTrackedPayloads(fetchMock);
		expect(payloads).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					eventName: 'package_viewed',
					eventProperties: expect.objectContaining({
						package_id: 'premium',
						package_name: 'Premium',
						content_name: 'Premium',
						content_category: 'package',
						source_area: 'pricing',
					}),
				}),
			]),
		);
	});

	it('does not emit duplicate package_viewed events for the same card', async () => {
		initCommercialTracking();

		const packageCard = document.querySelector('[data-track-package-view]') as Element;
		const packageObserver = MockIntersectionObserver.instances.find((observer) =>
			observer.observed.has(packageCard),
		);

		packageObserver?.trigger(packageCard, 0.6);
		packageObserver?.trigger(packageCard, 0.8);
		await flushPromises();

		const packageEvents = getTrackedPayloads(fetchMock).filter(
			(payload) => payload.eventName === 'package_viewed',
		);

		expect(packageEvents).toHaveLength(1);
	});
});

/* ================================================================
 * Navigation-safe Meta Pixel dispatch [T10]
 *
 * Verifies:
 * - forwardToMetaPixel is called before fetch resolves for
 *   WhatsApp clicks.
 * - Invalid cached lead codes are discarded and replaced.
 * - The first-party fetch is NOT awaited, completing synchronously.
 * ================================================================ */

describe('navigation-safe Meta Pixel dispatch [T10]', () => {
	const forwardToMetaPixelMock = jest.requireMock('@/lib/tracking/meta-pixel') as {
		forwardToMetaPixel: jest.Mock;
	};

	beforeEach(() => {
		jest.clearAllMocks();
		MockIntersectionObserver.instances = [];
		window.history.replaceState({}, '', '/');
		document.body.innerHTML = `
			<a
				href="https://wa.me/521234567890?text=Hola"
				data-track-event="whatsapp_contact_clicked"
				data-track-cta="hero_whatsapp"
			>WhatsApp</a>
		`;
		document.body.dataset.trackingRouteClass = 'commercial';
		Object.defineProperty(document, 'readyState', {
			configurable: true,
			value: 'complete',
		});
		Reflect.set(window, 'IntersectionObserver', MockIntersectionObserver);
		Reflect.set(globalThis, 'IntersectionObserver', MockIntersectionObserver);
		window.localStorage.clear();
		window.sessionStorage.clear();
	});

	it('[T10] forwardToMetaPixel is called before fetch resolves for WhatsApp clicks', () => {
		// Fetch never resolves to simulate outbound navigation abandonment.
		const neverResolvingFetch = jest.fn(() => new Promise<Response>(() => {}));
		Reflect.set(globalThis, 'fetch', neverResolvingFetch);
		initCommercialTracking();
		const anchor = document.querySelector(
			'a[data-track-event="whatsapp_contact_clicked"]',
		) as HTMLAnchorElement;
		// Prevent jsdom navigation.
		anchor.addEventListener('click', (e) => e.preventDefault(), { once: true });
		anchor.click();
		// Synchronous check: no await needed - forwardToMetaPixel must already be called.
		expect(forwardToMetaPixelMock.forwardToMetaPixel).toHaveBeenCalledWith(
			'whatsapp_contact_clicked',
			expect.objectContaining({ cta_id: 'hero_whatsapp' }),
		);
		expect(neverResolvingFetch).toHaveBeenCalled();
	});

	it('discards invalid or stale cached lead codes from sessionStorage', async () => {
		initCommercialTracking();
		const anchor = document.querySelector(
			'a[data-track-event="whatsapp_contact_clicked"]',
		) as HTMLAnchorElement;
		anchor.addEventListener('click', (e) => e.preventDefault());

		// Put an invalid format code in sessionStorage.
		window.sessionStorage.setItem('cm_whatsapp_lead_code', 'CM-INVALID-123456');

		anchor.click();
		await flushPromises();

		// The sessionStorage value must be replaced by a valid canonical code.
		const code = window.sessionStorage.getItem('cm_whatsapp_lead_code');
		expect(code).toMatch(/^CM-[A-Z0-9]{6}$/i);
		expect(code).not.toBe('CM-INVALID-123456');
	});

	it('does not await the first-party fetch response, completing execution synchronously', async () => {
		// Mock fetch to never resolve.
		const neverResolvingFetch = jest.fn(() => new Promise<Response>(() => {}));
		Reflect.set(globalThis, 'fetch', neverResolvingFetch);

		initCommercialTracking();

		// Firing page_viewed (triggered by initCommercialTracking) will call trackEvent.
		// Since trackEvent is synchronous, the fetch call is initiated immediately.
		expect(neverResolvingFetch).toHaveBeenCalled();

		// Since fetch is never resolved, the sessionInitialized flag must NOT be set yet.
		expect(window.sessionStorage.getItem('cm_session_initialized')).toBeNull();
	});
});
