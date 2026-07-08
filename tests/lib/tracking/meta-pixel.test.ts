/**
 * Tests for Meta Pixel event forwarding.
 *
 * Verifies:
 * - Standard Meta events (PageView, ViewContent, Lead, Contact) are sent via
 *   fbq('track', ...) so they register as recognised conversion events.
 * - Non-standard mapped events (if any are added later) route through
 *   fbq('trackCustom', ...) and appear as custom events.
 * - Internal events that are absent from META_EVENT_MAP are silently dropped.
 * - initMetaPixel() does NOT emit PageView — that comes exclusively from the
 *   page_viewed → forwardToMetaPixel path.
 */

process.env.PUBLIC_META_PIXEL_ID = '191973769040678';
process.env.PUBLIC_META_PIXEL_ENABLED = 'true';

import { jest } from '@jest/globals';

/* ---------- Module mocks ---------- */

// Mock the env adapter so tests never parse import.meta (unsupported in CJS).
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
 * JSDOM does not actually fetch scripts, so the fbevents.js script's onerror
 * handler never fires. We must synthesise the error to transition the
 * module-internal `pixelLoaded` flag from false → true.
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

/* ================================================================
 * forwardToMetaPixel
 * ================================================================ */

describe('forwardToMetaPixel', () => {
	beforeAll(() => {
		document.body.dataset.trackingRouteClass = 'commercial';
		initMetaPixel();
		firePixelOnError();
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
