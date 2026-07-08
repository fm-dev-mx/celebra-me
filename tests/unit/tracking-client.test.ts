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

		const packageEvents = getTrackedPayloads(fetchMock)
			.filter((payload) => payload.eventName === 'package_viewed');

		expect(packageEvents).toHaveLength(1);
	});
});
