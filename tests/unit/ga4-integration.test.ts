/**
 * Integration tests for GA4 forwarder behavior through initCommercialTracking.
 *
 * Verifies that forwardToGA4 is called with the correct event names and
 * parameters when analytics consent is granted.
 */
import { MockIntersectionObserver } from '../helpers/intersection-observer';

const mockInitGA4 = jest.fn();
const mockForwardToGA4 = jest.fn();

jest.mock('@/lib/tracking/ga4-forwarder', () => ({
	initGA4: mockInitGA4,
	forwardToGA4: mockForwardToGA4,
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

import { initCommercialTracking } from '@/lib/tracking/client';

function flushPromises(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

describe('GA4 forwarder integration', () => {
	const fetchMock = jest.fn(() => Promise.resolve({ ok: true }));

	beforeEach(() => {
		jest.clearAllMocks();
		MockIntersectionObserver.instances = [];
		window.history.replaceState({}, '', '/');
		document.body.innerHTML = `
			<section data-track-section="hero"></section>
			<section data-track-section="pricing">
				<article
					data-track-package-view
					data-package-id="premium"
					data-package-name="Premium"
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

	it('calls initGA4 and forwardToGA4 with page_viewed on init', async () => {
		initCommercialTracking();
		await flushPromises();

		expect(mockInitGA4).toHaveBeenCalledTimes(1);
		expect(mockForwardToGA4).toHaveBeenCalledWith(
			'page_viewed',
			expect.objectContaining({ page_type: 'commercial' }),
		);
	});

	it('forwards section_seen to GA4 when section enters viewport', async () => {
		initCommercialTracking();
		await flushPromises();

		const section = document.querySelector('[data-track-section="hero"]') as Element;
		const sectionObserver = MockIntersectionObserver.instances.find((observer) =>
			observer.observed.has(section),
		);
		sectionObserver?.trigger(section, 0.6);
		await flushPromises();

		expect(mockForwardToGA4).toHaveBeenCalledWith(
			'section_seen',
			expect.objectContaining({
				section_id: 'hero',
				visibility_bucket: 50,
			}),
		);
	});

	it('forwards exactly one page_viewed per init call', async () => {
		initCommercialTracking();
		await flushPromises();

		const pageViewCalls = mockForwardToGA4.mock.calls.filter(
			([name]) => name === 'page_viewed',
		);
		expect(pageViewCalls).toHaveLength(1);
	});

	it('forwards scroll_depth_reached to GA4', async () => {
		// Set up scroll dimensions before init so the initial handleScroll
		// fires with the correct depth.
		window.scrollY = 500;
		Object.defineProperty(document.documentElement, 'scrollHeight', {
			configurable: true,
			value: 2000,
		});
		Object.defineProperty(window, 'innerHeight', {
			configurable: true,
			value: 800,
		});

		initCommercialTracking();
		await flushPromises();

		expect(mockForwardToGA4).toHaveBeenCalledWith(
			'scroll_depth_reached',
			expect.objectContaining({ depth_bucket: 25 }),
		);
	});

	it('forwards CTA clicks to GA4', async () => {
		initCommercialTracking();
		await flushPromises();

		const cta = document.createElement('a');
		cta.dataset.trackEvent = 'cta_clicked';
		cta.dataset.trackCta = 'hero-cta';
		cta.dataset.trackSection = 'hero';
		cta.dataset.trackIntent = 'whatsapp';
		cta.href = '#';
		document.body.appendChild(cta);
		cta.click();
		await flushPromises();

		expect(mockForwardToGA4).toHaveBeenCalledWith(
			'cta_clicked',
			expect.objectContaining({
				cta_id: 'hero-cta',
				cta_location: 'hero',
			}),
		);
	});

	it('does not call forwardToGA4 when route class is absent', async () => {
		delete document.body.dataset.trackingRouteClass;
		initCommercialTracking();
		await flushPromises();

		expect(mockForwardToGA4).not.toHaveBeenCalled();
	});

	it('preserves event properties through the GA4 pipeline', async () => {
		initCommercialTracking();
		await flushPromises();

		const pageViewCall = mockForwardToGA4.mock.calls.find(
			([name]) => name === 'page_viewed',
		);
		expect(pageViewCall).toBeDefined();
		const [, properties] = pageViewCall as [string, Record<string, unknown>];
		expect(properties).toHaveProperty('page_type', 'commercial');
		// Verify no PII leaks through
		expect(properties).not.toHaveProperty('visitorId');
		expect(properties).not.toHaveProperty('sessionId');
	});
});
