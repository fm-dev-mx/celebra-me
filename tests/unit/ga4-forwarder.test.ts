// Mock the dependencies of ga4-forwarder
jest.mock('@/lib/tracking/consent-client', () => {
	const original = jest.requireActual('@/lib/tracking/consent-client');
	return {
		...original,
		readConsent: jest.fn(),
		subscribeConsentChange: jest.fn(),
	};
});

jest.mock('@/lib/tracking/route-policy', () => {
	const original = jest.requireActual('@/lib/tracking/route-policy');
	return {
		...original,
		classifyTrackingRoute: jest.fn(),
	};
});

jest.mock('@/lib/tracking/ga4-env', () => ({
	getGaMeasurementId: () => 'G-TEST',
	getLegacyAnalyticsId: () => '',
}));

describe('ga4-forwarder real implementation tests', () => {
	let consentListeners: Array<(state: any) => void> = [];
	let appendChildSpy: jest.SpyInstance;
	let initGA4: () => void;
	let forwardToGA4: (eventName: string, properties: any) => void;
	let mockReadConsent: jest.Mock;
	let mockSubscribeConsentChange: jest.Mock;
	let mockClassifyTrackingRoute: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.resetModules();

		// Load clean module instances
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const ga4Forwarder = require('@/lib/tracking/ga4-forwarder');
		initGA4 = ga4Forwarder.initGA4;
		forwardToGA4 = ga4Forwarder.forwardToGA4;

		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const consentClient = require('@/lib/tracking/consent-client');
		mockReadConsent = consentClient.readConsent;
		mockSubscribeConsentChange = consentClient.subscribeConsentChange;

		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const routePolicy = require('@/lib/tracking/route-policy');
		mockClassifyTrackingRoute = routePolicy.classifyTrackingRoute;

		consentListeners = [];
		window.dataLayer = [];
		delete (window as any).gtag;
		delete (window as any).google_tag_manager;
		document.body.innerHTML = '';
		document.body.dataset.trackingRouteClass = 'commercial';

		// Capture consent listeners
		mockSubscribeConsentChange.mockImplementation((listener) => {
			consentListeners.push(listener);
			return () => {
				consentListeners = consentListeners.filter((l) => l !== listener);
			};
		});

		// Mock route policy to allow GA
		mockClassifyTrackingRoute.mockReturnValue({
			routeClass: 'commercial',
			internalAllowed: true,
			gaAllowed: true,
			metaAllowed: true,
			reason: 'test',
		});

		// Intercept appendChild to simulate script loading
		appendChildSpy = jest.spyOn(document.head, 'appendChild').mockImplementation((node) => {
			if (node instanceof HTMLScriptElement) {
				try {
					const scriptUrl = new URL(node.src, 'https://localhost');
					if (
						scriptUrl.hostname === 'www.googletagmanager.com' ||
						scriptUrl.hostname === 'googletagmanager.com'
					) {
						// Simulate asynchronous script onload
						setTimeout(() => {
							if (node.onload) {
								(node.onload as any)();
							}
						}, 0);
					}
				} catch {
					// Non-parseable script URL
				}
			}
			return node;
		});
	});

	afterEach(() => {
		appendChildSpy.mockRestore();
	});

	it('supports persisted consent before load: initializes, queues page_viewed, flushes on load, and asserts exactly one page_view', async () => {
		// Mock consent granted initially
		mockReadConsent.mockReturnValue({
			necessary: true,
			analytics: true,
			marketing: false,
		});

		// Call the real initGA4
		initGA4();

		// Immediately, gaLoading is true, gaLoaded is false (since onload runs async).
		// Forward initial page_viewed event while loading
		forwardToGA4('page_viewed', { page_type: 'commercial' });

		// Wait for the simulated onload Promise to resolve
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Assertions
		expect(appendChildSpy).toHaveBeenCalled();
		expect(window.dataLayer).toBeDefined();

		const rawPageViewEvents =
			window.dataLayer?.filter(
				(item: any) =>
					Object.prototype.toString.call(item) === '[object Arguments]' &&
					item[0] === 'event' &&
					item[1] === 'page_view',
			) || [];
		expect(rawPageViewEvents.length).toBe(1);

		// Assert command types and order
		const dl = window.dataLayer as any[];
		expect(dl.length).toBe(3); // js, config, page_view

		// 1. js command
		expect(Object.prototype.toString.call(dl[0])).toBe('[object Arguments]');
		expect(Array.isArray(dl[0])).toBe(false);
		expect(dl[0][0]).toBe('js');

		// 2. config command
		expect(Object.prototype.toString.call(dl[1])).toBe('[object Arguments]');
		expect(Array.isArray(dl[1])).toBe(false);
		expect(dl[1][0]).toBe('config');
		expect(dl[1][1]).toBe('G-TEST');
		expect(dl[1][2]).toEqual({ send_page_view: false });

		// 3. page_view command
		expect(Object.prototype.toString.call(dl[2])).toBe('[object Arguments]');
		expect(Array.isArray(dl[2])).toBe(false);
		expect(dl[2][0]).toBe('event');
		expect(dl[2][1]).toBe('page_view');
		expect(dl[2][2]).toEqual({ page_type: 'commercial' });
	});

	it('supports consent granted after load: buffers page_viewed fallback and flushes exactly once', async () => {
		// Mock consent denied initially
		mockReadConsent.mockReturnValue({
			necessary: true,
			analytics: false,
			marketing: false,
		});

		// Run initialization
		initGA4();

		// Firing page_viewed pre-consent will not queue because gaLoading is false
		forwardToGA4('page_viewed', { page_type: 'commercial' });
		expect(window.dataLayer?.length).toBe(0);

		// Now simulate consent change to true, which starts loading
		mockReadConsent.mockReturnValue({
			necessary: true,
			analytics: true,
			marketing: false,
		});

		// Trigger observer to start loading
		consentListeners.forEach((listener) =>
			listener({ necessary: true, analytics: true, marketing: false }),
		);

		// Wait for load completion
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Assertions
		expect(window.dataLayer).toBeDefined();

		// Count page_view events
		const pageViewEvents =
			window.dataLayer?.filter(
				(item: any) =>
					Object.prototype.toString.call(item) === '[object Arguments]' &&
					item[0] === 'event' &&
					item[1] === 'page_view',
			) || [];
		expect(pageViewEvents.length).toBe(1);

		// Assert command types and order
		const dl = window.dataLayer as any[];
		expect(dl.length).toBe(3); // js, config, page_view (deferred fallback)

		// 1. js
		expect(Object.prototype.toString.call(dl[0])).toBe('[object Arguments]');
		expect(Array.isArray(dl[0])).toBe(false);

		// 2. config
		expect(Object.prototype.toString.call(dl[1])).toBe('[object Arguments]');
		expect(Array.isArray(dl[1])).toBe(false);

		// 3. page_view
		expect(Object.prototype.toString.call(dl[2])).toBe('[object Arguments]');
		expect(Array.isArray(dl[2])).toBe(false);
		expect(dl[2][0]).toBe('event');
		expect(dl[2][1]).toBe('page_view');
		expect(dl[2][2]).toEqual({ page_type: 'commercial' });
	});
});
