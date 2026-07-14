/**
 * Tests for Meta Pixel event forwarding, initialization, queue behavior,
 * consent handling, and error/retry behavior.
 *
 * Verifies:
 * - Standard Meta events (PageView, ViewContent, Lead, Contact) are sent via
 *   fbq('track', ...) so they register as recognised conversion events.
 * - Internal events absent from META_EVENT_MAP are silently dropped.
 * - initMetaPixel() does NOT emit PageView during initialization — PageView comes
 *   from page_viewed forwarding or late-consent recovery.
 * - Events generated while the script is loading are queued and flushed exactly once.
 * - onerror does NOT mark the Pixel as loaded — it marks it as failed.
 * - A subsequent initMetaPixel() call after failure can retry the load.
 * - Late consent fires exactly one PageView for the current page.
 * - Pre-consent interactions are NOT replayed after consent.
 * - Repeated initMetaPixel() calls do not inject duplicate scripts.
 */

process.env.PUBLIC_META_PIXEL_ID = '191973769040678';
process.env.PUBLIC_META_PIXEL_ENABLED = 'true';

import { jest } from '@jest/globals';

/* ---------- Module mocks (declared before imports, applied per test) ---------- */

// These are module-level mocks that apply to the entire file for the top-level imports.
jest.mock('@/lib/tracking/meta-pixel-env', () => ({
	getPixelIdFromEnv: jest.fn(() => '191973769040678'),
	isPixelEnabledInEnv: jest.fn(() => true),
}));

jest.mock('@/lib/tracking/consent-client', () => ({
	readConsent: jest.fn(() => ({
		necessary: true as const,
		analytics: true,
		marketing: true,
		updatedAt: '2026-01-01T00:00:00.000Z',
	})),
	subscribeConsentChange: jest.fn(),
}));

jest.mock('@/lib/tracking/route-policy', () => {
	const classifyTrackingRoute = jest.fn(() => ({
		routeClass: 'commercial' as const,
		internalAllowed: true,
		gaAllowed: true,
		metaAllowed: true,
		reason: 'test',
	}));
	return { classifyTrackingRoute };
});

/* ---------- Module under test ---------- */

import { initMetaPixel, forwardToMetaPixel } from '@/lib/tracking/meta-pixel';

/* ---------- Helpers ---------- */

/**
 * JSDOM does not actually fetch scripts. Synthesize the onload callback to
 * transition the module-internal state to pixelLoaded=true.
 */
function firePixelOnLoad(): void {
	const scripts = document.querySelectorAll('script');
	for (const script of Array.from(scripts)) {
		const htmlScript = script as HTMLScriptElement;
		if (htmlScript.src && htmlScript.src.includes('fbevents.js')) {
			htmlScript.onload?.(new Event('load'));
			return;
		}
	}
}

/**
 * JSDOM does not actually fetch scripts. Synthesize the onerror callback to
 * transition the module-internal state to pixelFailed=true (NOT pixelLoaded=true).
 */
function firePixelOnError(): void {
	const scripts = document.querySelectorAll('script');
	for (const script of Array.from(scripts)) {
		const htmlScript = script as HTMLScriptElement;
		if (htmlScript.src && htmlScript.src.includes('fbevents.js')) {
			htmlScript.onerror?.(new Event('error'));
			return;
		}
	}
}

/** Set `window.fbq` to a Jest mock, return the mock. */
function setFbqMock(): jest.Mock {
	const mock = jest.fn();
	(window as unknown as Record<string, unknown>).fbq = mock;
	return mock;
}

/** Read the mock from `window.fbq`. */
function fbq(): jest.Mock {
	return (window as unknown as Record<string, unknown>).fbq as jest.Mock;
}

function flushPromises(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/* ================================================================
 * forwardToMetaPixel — standard event routing
 *
 * The module is initialized once in beforeAll with a successful load
 * so pixelLoaded=true for all tests in this describe block.
 * ================================================================ */

describe('forwardToMetaPixel', () => {
	beforeAll(() => {
		document.body.dataset.trackingRouteClass = 'commercial';
		initMetaPixel();
		// Use onload (not onerror) so the pixel is in a loaded state for these tests.
		firePixelOnLoad();
	});

	beforeEach(() => {
		setFbqMock();
	});

	/* ---- Standard-event routing ---- */

	it('forwards page_viewed as fbq("track", "PageView", ...)', () => {
		forwardToMetaPixel('page_viewed', { page_type: 'commercial' });
		expect(fbq()).toHaveBeenCalledWith('track', 'PageView', {
			content_category: 'page',
			content_name: 'commercial',
			source_area: 'commercial',
		});
	});

	it('forwards demo_viewed as fbq("track", "ViewContent", ...)', () => {
		forwardToMetaPixel('demo_viewed', {
			demo_slug: 'celestial-blue',
			event_type: 'xv',
			source_area: 'demo_showroom_featured',
		});
		expect(fbq()).toHaveBeenCalledWith('track', 'ViewContent', {
			content_category: 'demo',
			content_name: 'celestial-blue',
			event_type: 'xv',
			source_area: 'demo_showroom_featured',
		});
	});

	it('forwards package_viewed as fbq("track", "ViewContent", ...)', () => {
		forwardToMetaPixel('package_viewed', {
			package_id: 'premium',
			package_name: 'Premium',
			source_area: 'pricing',
		});
		expect(fbq()).toHaveBeenCalledWith('track', 'ViewContent', {
			content_category: 'package',
			content_name: 'Premium',
			source_area: 'pricing',
		});
	});

	it('forwards whatsapp_contact_clicked as fbq("track", "Contact", ...)', () => {
		forwardToMetaPixel('whatsapp_contact_clicked', {
			lead_code: 'CM-ABC123',
			package_name: 'Premium',
			source_area: 'pricing',
		});
		expect(fbq()).toHaveBeenCalledWith(
			'track',
			'Contact',
			{
				content_category: 'package',
				content_name: 'Premium',
				source_area: 'pricing',
			},
			{ eventID: 'CM-ABC123' },
		);
	});

	it('forwards successful form_submitted as fbq("track", "Lead", ...)', () => {
		forwardToMetaPixel('form_submitted', {
			form_id: 'contact',
			lead_code: 'CM-LEAD42',
			event_type: 'xv',
			source_area: 'contact',
		});
		expect(fbq()).toHaveBeenCalledWith(
			'track',
			'Lead',
			{
				content_category: 'lead_form',
				content_name: 'contact',
				event_type: 'xv',
				source_area: 'contact',
			},
			{ eventID: 'CM-LEAD42' },
		);
	});

	it('forwards lead_created as fbq("track", "Lead", ...) — future standard event', () => {
		forwardToMetaPixel('lead_created', {
			lead_channel: 'web',
			lead_source: 'organic',
		});
		expect(fbq()).toHaveBeenCalledWith('track', 'Lead', {
			content_category: 'lead_form',
			content_name: 'contact',
		});
	});

	/* ---- Non-mapped events are silently dropped ---- */

	it.each([
		'section_seen',
		'scroll_depth_reached',
		'cta_clicked',
		'form_started',
		'session_started',
		'session_ended',
		'converted_to_demo',
		'lost',
	])('drops %s — no fbq call when absent from META_EVENT_MAP', (eventName) => {
		forwardToMetaPixel(eventName, {});
		expect(fbq()).not.toHaveBeenCalled();
	});

	/* ---- PageView is emitted exactly once per forwardToMetaPixel call ---- */

	it('emits PageView exactly once per page_viewed call', () => {
		forwardToMetaPixel('page_viewed', {});
		expect(fbq()).toHaveBeenCalledTimes(1);
		expect(fbq()).toHaveBeenCalledWith('track', 'PageView', {
			content_category: 'page',
		});
	});

	it('has no duplicate PageView emission path — two page_viewed calls → two PageView calls', () => {
		forwardToMetaPixel('page_viewed', {});
		forwardToMetaPixel('page_viewed', {});
		expect(fbq()).toHaveBeenCalledTimes(2);
	});
});

/* ================================================================
 * initMetaPixel — PageView must NOT fire during init
 * ================================================================ */

describe('initMetaPixel', () => {
	beforeAll(() => {
		document.body.dataset.trackingRouteClass = 'commercial';
	});

	it('does not emit PageView during pixel initialization', () => {
		initMetaPixel();
		firePixelOnError();

		// The fbq stub (set by loadPixelScript) queues calls. Verify the queue
		// contains NO event calls (track / trackCustom).
		const stub = (window as unknown as Record<string, unknown>).fbq as {
			queue?: unknown[][];
		};
		const eventCalls = (stub.queue ?? []).filter(
			(args: unknown[]) =>
				typeof args[0] === 'string' && (args[0] === 'track' || args[0] === 'trackCustom'),
		);
		expect(eventCalls).toHaveLength(0);
	});
});

/* ================================================================
 * Pending-event queue [T4]
 *
 * Events generated while pixelLoading=true must be held in the
 * application-level pending queue and flushed exactly once after
 * a successful onload. They must NOT be re-dispatched on a second
 * flush or on failure.
 *
 * We use jest.isolateModules() to get a fresh module instance with
 * clean internal state (pixelLoaded=false, pixelLoading=false, etc.).
 * ================================================================ */

describe('pending-event queue [T4]', () => {
	it('[T4] queues events while loading and flushes them in order after onload', async () => {
		// Remove any existing pixel scripts so we get a clean inject.
		document.querySelectorAll('script[src*="fbevents.js"]').forEach((s) => s.remove());

		// We need a fresh module here because the cached module has pixelLoaded=true
		// from the forwardToMetaPixel describe's beforeAll. Use isolateModules to load
		// a fresh instance for this test.
		let freshInit: ((id?: string) => void) | undefined;
		let freshForward:
			| ((name: string, props: Record<string, string | number | boolean>) => void)
			| undefined;

		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const mod = require('@/lib/tracking/meta-pixel') as {
				initMetaPixel: () => void;
				forwardToMetaPixel: (
					name: string,
					props: Record<string, string | number | boolean>,
				) => void;
			};
			freshInit = mod.initMetaPixel;
			freshForward = mod.forwardToMetaPixel;
		});

		document.body.dataset.trackingRouteClass = 'commercial';
		freshInit?.();

		// Pixel is now in loading state. Replace fbq with a mock.
		const fbqMock = setFbqMock();

		// Dispatch events while loading — they should queue.
		freshForward?.('page_viewed', { page_type: 'commercial' });
		freshForward?.('whatsapp_contact_clicked', {
			lead_code: 'CM-QUEUED1',
			source_area: 'hero',
		});

		// No track/trackCustom calls yet.
		const preLoadCalls = fbqMock.mock.calls.filter(
			(call) => call[0] === 'track' || call[0] === 'trackCustom',
		);
		expect(preLoadCalls).toHaveLength(0);

		// Simulate onload — should flush the queue.
		const scripts = document.querySelectorAll('script[src*="fbevents.js"]');
		for (const script of Array.from(scripts)) {
			(script as HTMLScriptElement).onload?.(new Event('load'));
		}
		await flushPromises();

		// Both queued events must have been dispatched, in order.
		const trackCalls = fbqMock.mock.calls.filter(
			(call) => call[0] === 'track' || call[0] === 'trackCustom',
		);
		expect(trackCalls).toHaveLength(2);
		expect(trackCalls[0]?.[1]).toBe('PageView');
		expect(trackCalls[1]?.[1]).toBe('Contact');
	});

	it('[T4b] pending queue is not flushed after onerror — events are discarded', async () => {
		document.querySelectorAll('script[src*="fbevents.js"]').forEach((s) => s.remove());

		let freshInit: (() => void) | undefined;
		let freshForward:
			| ((name: string, props: Record<string, string | number | boolean>) => void)
			| undefined;

		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const mod = require('@/lib/tracking/meta-pixel') as {
				initMetaPixel: () => void;
				forwardToMetaPixel: (
					name: string,
					props: Record<string, string | number | boolean>,
				) => void;
			};
			freshInit = mod.initMetaPixel;
			freshForward = mod.forwardToMetaPixel;
		});

		document.body.dataset.trackingRouteClass = 'commercial';
		freshInit?.();

		const fbqMock = setFbqMock();

		// Queue an event while loading.
		freshForward?.('page_viewed', { page_type: 'commercial' });

		// Simulate onerror — queue must be discarded.
		const scripts = document.querySelectorAll('script[src*="fbevents.js"]');
		for (const script of Array.from(scripts)) {
			(script as HTMLScriptElement).onerror?.(new Event('error'));
		}
		await flushPromises();

		// No track calls because the queue was discarded and pixel is failed.
		const trackCalls = fbqMock.mock.calls.filter(
			(call) => call[0] === 'track' || call[0] === 'trackCustom',
		);
		expect(trackCalls).toHaveLength(0);
	});

	it('[T4c] pending queue is bounded to a maximum of 100 elements, dropping the oldest events', async () => {
		document.querySelectorAll('script[src*="fbevents.js"]').forEach((s) => s.remove());

		let freshInit: (() => void) | undefined;
		let freshForward:
			| ((name: string, props: Record<string, string | number | boolean>) => void)
			| undefined;

		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const mod = require('@/lib/tracking/meta-pixel') as {
				initMetaPixel: () => void;
				forwardToMetaPixel: (
					name: string,
					props: Record<string, string | number | boolean>,
				) => void;
			};
			freshInit = mod.initMetaPixel;
			freshForward = mod.forwardToMetaPixel;
		});

		document.body.dataset.trackingRouteClass = 'commercial';
		freshInit?.();

		const fbqMock = setFbqMock();

		// Enqueue 105 events.
		for (let index = 0; index < 105; index += 1) {
			freshForward?.('demo_viewed', {
				content_name: `demo-${index}`,
				source_area: 'pricing',
			});
		}

		// Simulate onload to flush queue.
		const scripts = document.querySelectorAll('script[src*="fbevents.js"]');
		for (const script of Array.from(scripts)) {
			(script as HTMLScriptElement).onload?.(new Event('load'));
		}
		await flushPromises();

		// Expected queue length is capped at 100.
		const trackCalls = fbqMock.mock.calls.filter(
			(call) => call[0] === 'track' || call[0] === 'trackCustom',
		);
		expect(trackCalls).toHaveLength(100);

		// The first 5 events (indices 0 to 4) should have been dropped.
		// The first flushed event must be index 5.
		expect(trackCalls[0]?.[2]).toEqual(expect.objectContaining({ content_name: 'demo-5' }));
		// The last flushed event must be index 104.
		expect(trackCalls[99]?.[2]).toEqual(expect.objectContaining({ content_name: 'demo-104' }));
	});
});

/* ================================================================
 * onerror behavior [T6]
 * ================================================================ */

describe('onerror sets pixel as failed, not loaded [T6]', () => {
	it('[T6] onerror does not mark Pixel as loaded — subsequent events are dropped', async () => {
		document.querySelectorAll('script[src*="fbevents.js"]').forEach((s) => s.remove());

		let freshInit: (() => void) | undefined;
		let freshForward:
			| ((name: string, props: Record<string, string | number | boolean>) => void)
			| undefined;

		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const mod = require('@/lib/tracking/meta-pixel') as {
				initMetaPixel: () => void;
				forwardToMetaPixel: (
					name: string,
					props: Record<string, string | number | boolean>,
				) => void;
			};
			freshInit = mod.initMetaPixel;
			freshForward = mod.forwardToMetaPixel;
		});

		document.body.dataset.trackingRouteClass = 'commercial';
		freshInit?.();

		// Simulate onerror.
		const scripts = document.querySelectorAll('script[src*="fbevents.js"]');
		for (const script of Array.from(scripts)) {
			(script as HTMLScriptElement).onerror?.(new Event('error'));
		}
		await flushPromises();

		const fbqMock = setFbqMock();

		// Subsequent event calls must be silently dropped.
		freshForward?.('page_viewed', { page_type: 'commercial' });
		const trackCalls = fbqMock.mock.calls.filter(
			(call) => call[0] === 'track' || call[0] === 'trackCustom',
		);
		expect(trackCalls).toHaveLength(0);
	});
});

/* ================================================================
 * Retry after failure [T7]
 * ================================================================ */

describe('retry after script failure [T7]', () => {
	it('[T7] initMetaPixel can retry loading after a previous onerror (automatic DOM script tag cleanup)', async () => {
		document.querySelectorAll('script[src*="fbevents.js"]').forEach((s) => s.remove());

		let freshInit: (() => void) | undefined;
		let freshForward:
			| ((name: string, props: Record<string, string | number | boolean>) => void)
			| undefined;

		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const mod = require('@/lib/tracking/meta-pixel') as {
				initMetaPixel: () => void;
				forwardToMetaPixel: (
					name: string,
					props: Record<string, string | number | boolean>,
				) => void;
			};
			freshInit = mod.initMetaPixel;
			freshForward = mod.forwardToMetaPixel;
		});

		document.body.dataset.trackingRouteClass = 'commercial';

		// First attempt — fails.
		freshInit?.();
		const firstScripts = document.querySelectorAll('script[src*="fbevents.js"]');
		expect(firstScripts).toHaveLength(1);
		const failedScript = firstScripts[0] as HTMLScriptElement;
		// Tag the failed script to prove it gets removed.
		(failedScript as any).isFailedScript = true;

		// Fire onerror on first attempt.
		failedScript.onerror?.(new Event('error'));
		await flushPromises();

		// Second attempt — should retry, cleaning up the dead script automatically.
		freshInit?.();

		// A new script must be in the DOM, and the old one must be gone.
		const retryScripts = document.querySelectorAll('script[src*="fbevents.js"]');
		expect(retryScripts).toHaveLength(1);
		expect((retryScripts[0] as any).isFailedScript).toBeUndefined();

		// Simulate successful load on retry.
		const fbqMock = setFbqMock();
		for (const script of Array.from(retryScripts)) {
			(script as HTMLScriptElement).onload?.(new Event('load'));
		}
		await flushPromises();

		// After successful retry, events are forwarded.
		freshForward?.('page_viewed', { page_type: 'commercial' });
		const trackCalls = fbqMock.mock.calls.filter(
			(call) => call[0] === 'track' || call[0] === 'trackCustom',
		);
		expect(trackCalls).toHaveLength(1);
		expect(trackCalls[0]?.[1]).toBe('PageView');
	});
});

/* ================================================================
 * Late consent [T8] and no pre-consent replay [T9]
 *
 * These tests use jest.isolateModules + require to get a fresh module state
 * (pixelLoaded=false). They do NOT use jest.doMock inside isolateModules
 * (which does not override an existing jest.mock). Instead, they use
 * jest.requireMock to access the outer mocked consent-client and configure
 * it via mockImplementation before requiring the isolated module.
 * ================================================================ */

describe('late consent PageView [T8] and no pre-consent replay [T9]', () => {
	it('[T8] late consent fires exactly one PageView for the current page', async () => {
		document.querySelectorAll('script[src*="fbevents.js"]').forEach((s) => s.remove());

		type ConsentMod = {
			readConsent: any;
			subscribeConsentChange: any;
		};
		type PixelMod = {
			initMetaPixel: () => void;
		};

		// Configure the outer consent-client mock to:
		// (a) readConsent returns marketing=false initially, then true after consent.
		// (b) subscribeConsentChange captures the subscriber for manual triggering.
		const consentMod = jest.requireMock('@/lib/tracking/consent-client') as ConsentMod;

		let capturedConsentListener: any = null;

		consentMod.readConsent.mockReturnValue({
			necessary: true as const,
			analytics: false,
			marketing: false,
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
		consentMod.subscribeConsentChange.mockImplementation((fn: any) => {
			capturedConsentListener = fn;
			return () => {
				capturedConsentListener = null;
			};
		});

		let freshInit: (() => void) | undefined;

		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const mod = require('@/lib/tracking/meta-pixel') as PixelMod;
			freshInit = mod.initMetaPixel;
		});

		document.body.dataset.trackingRouteClass = 'commercial';
		// initMetaPixel sees marketing=false — does not load script yet.
		// subscribeConsentChange registers the subscriber (captured above).
		freshInit?.();

		// Trigger late consent.
		capturedConsentListener?.({
			necessary: true as const,
			analytics: true,
			marketing: true,
			updatedAt: '2026-01-01T00:01:00.000Z',
		});

		// loadPixelScript has been triggered. Replace fbq with a mock before onload fires.
		const fbqMock = setFbqMock();

		const scripts = document.querySelectorAll('script[src*="fbevents.js"]');
		for (const script of Array.from(scripts)) {
			(script as HTMLScriptElement).onload?.(new Event('load'));
		}
		await flushPromises();

		// Restore outer mock to default behavior.
		consentMod.readConsent.mockReturnValue({
			necessary: true as const,
			analytics: true,
			marketing: true,
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
		consentMod.subscribeConsentChange.mockImplementation(jest.fn());

		// Exactly one PageView for the current pathname must be emitted.
		const pageViewCalls = fbqMock.mock.calls.filter(
			(call) => call[0] === 'track' && call[1] === 'PageView',
		);
		expect(pageViewCalls).toHaveLength(1);
	});

	it('[T9] pre-consent scroll/section events are not replayed after consent', async () => {
		document.querySelectorAll('script[src*="fbevents.js"]').forEach((s) => s.remove());

		type ConsentMod = {
			readConsent: any;
			subscribeConsentChange: any;
		};
		type PixelMod = {
			initMetaPixel: () => void;
			forwardToMetaPixel: (
				name: string,
				props: Record<string, string | number | boolean>,
			) => void;
		};

		const consentMod = jest.requireMock('@/lib/tracking/consent-client') as ConsentMod;

		let capturedConsentListener: any = null;

		consentMod.readConsent.mockReturnValue({
			necessary: true as const,
			analytics: false,
			marketing: false,
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
		consentMod.subscribeConsentChange.mockImplementation((fn: any) => {
			capturedConsentListener = fn;
			return () => {
				capturedConsentListener = null;
			};
		});

		let freshInit: (() => void) | undefined;
		let freshForward:
			| ((name: string, props: Record<string, string | number | boolean>) => void)
			| undefined;

		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const mod = require('@/lib/tracking/meta-pixel') as PixelMod;
			freshInit = mod.initMetaPixel;
			freshForward = mod.forwardToMetaPixel;
		});

		document.body.dataset.trackingRouteClass = 'commercial';
		freshInit?.();

		// Pre-consent interactions — readConsent returns marketing=false so these are dropped.
		// They must NOT queue in pendingEvents (pixel not loading, not loaded, just failed/not started).
		freshForward?.('scroll_depth_reached', { depth_bucket: 50 });
		freshForward?.('section_seen', { section_id: 'pricing' });

		// Grant consent — triggers subscriber.
		capturedConsentListener?.({
			necessary: true as const,
			analytics: true,
			marketing: true,
			updatedAt: '2026-01-01T00:01:00.000Z',
		});

		const fbqMock = setFbqMock();
		const scripts = document.querySelectorAll('script[src*="fbevents.js"]');
		for (const script of Array.from(scripts)) {
			(script as HTMLScriptElement).onload?.(new Event('load'));
		}
		await flushPromises();

		// Restore outer mock.
		consentMod.readConsent.mockReturnValue({
			necessary: true as const,
			analytics: true,
			marketing: true,
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
		consentMod.subscribeConsentChange.mockImplementation(jest.fn());

		// Only the late-consent PageView must be present — no scroll or section events.
		const allTrackCalls = fbqMock.mock.calls.filter(
			(call) => call[0] === 'track' || call[0] === 'trackCustom',
		);
		const nonPageViewCalls = allTrackCalls.filter((call) => call[1] !== 'PageView');
		expect(nonPageViewCalls).toHaveLength(0);
	});
});

/* ================================================================
 * No duplicate script injection [T11]
 * ================================================================ */

describe('no duplicate script injection [T11]', () => {
	it('[T11] repeated initMetaPixel calls do not inject duplicate fbevents.js scripts', async () => {
		// Use the cached module (pixelLoaded=true from the first describe).
		// Calling initMetaPixel multiple times must not inject more scripts.
		document.querySelectorAll('script[src*="fbevents.js"]').forEach((s) => s.remove());

		// Call three times.
		initMetaPixel();
		initMetaPixel();
		initMetaPixel();

		await flushPromises();

		const scripts = document.querySelectorAll('script[src*="fbevents.js"]');
		// At most one script (could be 0 if pixelLoaded=true from earlier — that's fine too).
		expect(scripts.length).toBeLessThanOrEqual(1);
	});
});

/* ================================================================
 * Route boundaries and consent constraints
 *
 * Verifies that Meta Pixel events and script loads are prevented on
 * ineligible routes (metaAllowed = false).
 * ================================================================ */

describe('route boundaries for Meta Pixel', () => {
	beforeEach(() => {
		document.querySelectorAll('script[src*="fbevents.js"]').forEach((s) => s.remove());
	});

	it('does not forward or queue events on ineligible routes', async () => {
		type PixelMod = {
			initMetaPixel: () => void;
			forwardToMetaPixel: (
				name: string,
				props: Record<string, string | number | boolean>,
			) => void;
		};

		// Mock the route-policy to classify the route as ineligible for Meta tracking.
		const routePolicyMod = jest.requireMock('@/lib/tracking/route-policy') as {
			classifyTrackingRoute: jest.Mock;
		};
		routePolicyMod.classifyTrackingRoute.mockReturnValue({
			routeClass: 'personalized_invitation' as const,
			internalAllowed: false,
			gaAllowed: false,
			metaAllowed: false,
			reason: 'test_ineligible',
		});

		let freshInit: (() => void) | undefined;
		let freshForward:
			| ((name: string, props: Record<string, string | number | boolean>) => void)
			| undefined;

		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const mod = require('@/lib/tracking/meta-pixel') as PixelMod;
			freshInit = mod.initMetaPixel;
			freshForward = mod.forwardToMetaPixel;
		});

		document.body.dataset.trackingRouteClass = 'personalized_invitation';
		freshInit?.();

		// No script should be injected since the route is ineligible.
		expect(document.querySelector('script[src*="fbevents.js"]')).toBeNull();

		const fbqMock = setFbqMock();

		// Attempt to forward an event — it must be dropped and NOT queued or forwarded.
		freshForward?.('page_viewed', { page_type: 'personalized_invitation' });
		expect(fbqMock).not.toHaveBeenCalled();

		// Restore route-policy mock.
		routePolicyMod.classifyTrackingRoute.mockReturnValue({
			routeClass: 'commercial' as const,
			internalAllowed: true,
			gaAllowed: true,
			metaAllowed: true,
			reason: 'test',
		});
	});

	it('does not trigger late-consent script load on ineligible routes', async () => {
		type ConsentMod = {
			readConsent: jest.Mock;
			subscribeConsentChange: jest.Mock;
		};
		type PixelMod = {
			initMetaPixel: () => void;
		};

		const consentMod = jest.requireMock('@/lib/tracking/consent-client') as ConsentMod;
		const routePolicyMod = jest.requireMock('@/lib/tracking/route-policy') as {
			classifyTrackingRoute: jest.Mock;
		};

		let capturedConsentListener: any = null;

		consentMod.readConsent.mockReturnValue({
			necessary: true as const,
			analytics: false,
			marketing: false,
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
		consentMod.subscribeConsentChange.mockImplementation((fn: any) => {
			capturedConsentListener = fn;
			return () => {
				capturedConsentListener = null;
			};
		});

		// Classify route as ineligible.
		routePolicyMod.classifyTrackingRoute.mockReturnValue({
			routeClass: 'personalized_invitation' as const,
			internalAllowed: false,
			gaAllowed: false,
			metaAllowed: false,
			reason: 'test_ineligible',
		});

		let freshInit: (() => void) | undefined;

		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const mod = require('@/lib/tracking/meta-pixel') as PixelMod;
			freshInit = mod.initMetaPixel;
		});

		document.body.dataset.trackingRouteClass = 'personalized_invitation';
		freshInit?.();

		// Trigger consent change.
		capturedConsentListener?.({
			necessary: true as const,
			analytics: true,
			marketing: true,
			updatedAt: '2026-01-01T00:01:00.000Z',
		});

		await flushPromises();

		// Still no script should be injected since the route is ineligible.
		expect(document.querySelector('script[src*="fbevents.js"]')).toBeNull();

		// Restore mocks.
		consentMod.readConsent.mockReturnValue({
			necessary: true as const,
			analytics: true,
			marketing: true,
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
		consentMod.subscribeConsentChange.mockImplementation(jest.fn());
		routePolicyMod.classifyTrackingRoute.mockReturnValue({
			routeClass: 'commercial' as const,
			internalAllowed: true,
			gaAllowed: true,
			metaAllowed: true,
			reason: 'test',
		});
	});
});
