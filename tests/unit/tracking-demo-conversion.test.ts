jest.mock('@/lib/tracking/ga4-forwarder', () => ({ initGA4: jest.fn(), forwardToGA4: jest.fn() }));
jest.mock('@/lib/tracking/meta-pixel', () => ({
	initMetaPixel: jest.fn(),
	forwardToMetaPixel: jest.fn(),
}));
jest.mock('@/lib/tracking/consent-client', () => ({ readConsent: jest.fn() }));
import { readConsent } from '@/lib/tracking/consent-client';
import { initCommercialTracking } from '@/lib/tracking/client';
import { hasUnsafeEventProperties } from '@/lib/tracking/event-contract';

const consent = jest.mocked(readConsent);
const fetchMock = jest.fn(async () => ({ ok: true }));
const grant = (analytics: boolean, marketing: boolean) =>
	consent.mockReturnValue({
		necessary: true,
		analytics,
		marketing,
		updatedAt: '2026-09-25T00:00:00Z',
	});
const payloads = () =>
	fetchMock.mock.calls.map((args) =>
		JSON.parse(String((args as unknown as [string, RequestInit])[1].body)),
	);
beforeEach(() => {
	jest.clearAllMocks();
	document.body.replaceWith(document.createElement('body'));
	document.body.dataset.trackingRouteClass = 'demo';
	document.body.innerHTML =
		'<a href="https://wa.me/123?text=Exact%20style" data-track-event="whatsapp_contact_clicked" data-preserve-message="true" data-demo-slug="demo-xv-celestial-blue" data-track-cta="demo_quote_gallery">Cotizar</a>';
	Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
	window.history.replaceState({}, '', '/xv/demo-xv-celestial-blue');
	localStorage.clear();
	sessionStorage.clear();
	Reflect.set(globalThis, 'fetch', fetchMock);
	grant(true, true);
});
it('emits one view per navigation and one event per activation after repeated initialization', () => {
	initCommercialTracking();
	initCommercialTracking();
	const link = document.querySelector('a')!;
	const original = link.href;
	link.addEventListener('click', (e) => e.preventDefault());
	link.click();
	expect(link.href).toBe(original);
	expect(payloads().filter((p) => p.eventName === 'demo_viewed')).toHaveLength(1);
	expect(payloads().filter((p) => p.eventName === 'whatsapp_contact_clicked')).toHaveLength(1);
	expect(payloads().filter((p) => p.eventName === 'cta_clicked')).toHaveLength(0);
	expect(payloads().every((p) => p.eventId === p.eventProperties.event_id)).toBe(true);
});
it('keeps navigation available without consent and does not reconstruct a pre-consent view', () => {
	grant(false, false);
	initCommercialTracking();
	const link = document.querySelector('a')!;
	link.addEventListener('click', (e) => e.preventDefault());
	link.click();
	expect(fetchMock).not.toHaveBeenCalled();
	expect(localStorage.length).toBe(0);
	expect(sessionStorage.length).toBe(0);
	grant(true, false);
	link.click();
	expect(payloads().map((p) => p.eventName)).toEqual(['whatsapp_contact_clicked']);
	expect(payloads()[0].metaAttribution).toBeUndefined();
	grant(false, false);
	link.click();
	expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('accepts digit-heavy UUIDs while still rejecting phone numbers in properties', () => {
	expect(hasUnsafeEventProperties({ event_id: '11111111-1111-4111-8111-111111111111' })).toBe(
		false,
	);
	expect(hasUnsafeEventProperties({ event_id: '+521234567890' })).toBe(true);
});
