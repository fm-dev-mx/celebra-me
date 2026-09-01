jest.mock('@/lib/tracking/repository', () => ({
	upsertVisitorSession: jest.fn(),
	insertTrackingEvent: jest.fn(),
}));

jest.mock('@/lib/tracking/lead.service', () => ({
	createLeadFromTrackingEvent: jest.fn(),
}));

import { ingestTrackingEvent } from '@/lib/tracking/ingestion.service';
import { INTERNAL_TRACKING_EVENT_NAMES } from '@/lib/tracking/event-contract';
import { createLeadFromTrackingEvent } from '@/lib/tracking/lead.service';
import { insertTrackingEvent, upsertVisitorSession } from '@/lib/tracking/repository';

const mockUpsertVisitorSession = upsertVisitorSession as jest.MockedFunction<
	typeof upsertVisitorSession
>;
const mockInsertTrackingEvent = insertTrackingEvent as jest.MockedFunction<
	typeof insertTrackingEvent
>;
const mockCreateLeadFromTrackingEvent = createLeadFromTrackingEvent as jest.MockedFunction<
	typeof createLeadFromTrackingEvent
>;

beforeEach(() => {
	jest.clearAllMocks();
	mockUpsertVisitorSession.mockResolvedValue(undefined);
	mockInsertTrackingEvent.mockResolvedValue({
		id: 'event-id',
		eventName: 'cta_clicked',
	});
	mockCreateLeadFromTrackingEvent.mockResolvedValue({
		id: 'lead-id',
		leadCode: 'CM-ABC123',
		status: 'new',
		sessionId: 'session-id',
	});
});

function makeRequest(path = '/'): Request {
	return new Request(`https://www.celebra-me.com${path}`, {
		headers: { cookie: '' },
	});
}

describe('ingestTrackingEvent', () => {
	it('persists approved commercial events with sanitized properties', async () => {
		const result = await ingestTrackingEvent({
			request: makeRequest(),
			vercelEnv: 'production',
			payload: {
				sessionId: '11111111-1111-4111-8111-111111111111',
				visitorId: 'visitor_123456',
				eventName: 'cta_clicked',
				routePath: '/',
				routeClass: 'commercial',
				eventProperties: {
					cta_id: 'hero_whatsapp',
					ignored: { nested: true },
				},
				consentSnapshot: { necessary: true, analytics: true, marketing: false },
			},
		});

		expect(result).toEqual({ accepted: true, eventId: 'event-id' });
		expect(mockUpsertVisitorSession).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: '11111111-1111-4111-8111-111111111111',
				visitorId: 'visitor_123456',
				landingPath: '/',
				routeClass: 'commercial',
				isInternal: false,
			}),
		);
		expect(mockInsertTrackingEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventName: 'cta_clicked',
				eventProperties: { cta_id: 'hero_whatsapp' },
				isInternal: false,
			}),
		);
	});

	it('persists Meta attribution on commercial sessions without copying it into event properties', async () => {
		const result = await ingestTrackingEvent({
			request: makeRequest(),
			vercelEnv: 'production',
			payload: {
				sessionId: '77777777-7777-4777-8777-777777777777',
				visitorId: 'visitor_meta_user',
				eventName: 'page_viewed',
				routePath: '/',
				routeClass: 'commercial',
				metaAttribution: {
					fbp: 'fb.1.1710000000000.1234567890',
					fbc: 'fb.1.1710000000000.Click-123',
					fbclid: 'Click-123',
				},
				eventProperties: { page_type: 'commercial' },
				consentSnapshot: { necessary: true, analytics: true, marketing: true },
			},
		});

		expect(result).toEqual({ accepted: true, eventId: 'event-id' });
		expect(mockUpsertVisitorSession).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: '77777777-7777-4777-8777-777777777777',
				metaAttribution: {
					fbp: 'fb.1.1710000000000.1234567890',
					fbc: 'fb.1.1710000000000.Click-123',
					fbclid: 'Click-123',
				},
			}),
		);
		expect(mockInsertTrackingEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventProperties: { page_type: 'commercial' },
			}),
		);
	});

	it('ignores events on excluded real invitation routes', async () => {
		const result = await ingestTrackingEvent({
			request: makeRequest(),
			vercelEnv: 'production',
			payload: {
				sessionId: '11111111-1111-4111-8111-111111111111',
				visitorId: 'visitor_123456',
				eventName: 'page_viewed',
				routePath: '/xv/valentina-hernandez',
				routeClass: 'real_invitation',
				eventProperties: {},
				consentSnapshot: { necessary: true, analytics: true, marketing: false },
			},
		});

		expect(result).toEqual({ accepted: false, reason: 'route_not_allowed' });
		expect(mockUpsertVisitorSession).not.toHaveBeenCalled();
		expect(mockInsertTrackingEvent).not.toHaveBeenCalled();
		expect(mockCreateLeadFromTrackingEvent).not.toHaveBeenCalled();
	});

	it('rejects PII-like event properties', async () => {
		await expect(
			ingestTrackingEvent({
				request: makeRequest(),
				vercelEnv: 'production',
				payload: {
					sessionId: '11111111-1111-4111-8111-111111111111',
					visitorId: 'visitor_123456',
					eventName: 'cta_clicked',
					routePath: '/',
					routeClass: 'commercial',
					eventProperties: { email: 'client@example.com' },
					consentSnapshot: { necessary: true, analytics: true, marketing: false },
				},
			}),
		).rejects.toThrow('Tracking event contains unsafe properties.');
		expect(mockInsertTrackingEvent).not.toHaveBeenCalled();
		expect(mockCreateLeadFromTrackingEvent).not.toHaveBeenCalled();
	});

	it.each(INTERNAL_TRACKING_EVENT_NAMES)(
		'rejects the server-owned %s event before persistence',
		async (eventName) => {
			await expect(
				ingestTrackingEvent({
					request: makeRequest(),
					vercelEnv: 'production',
					payload: {
						sessionId: '11111111-1111-4111-8111-111111111111',
						visitorId: 'visitor_123456',
						eventName,
						routePath: '/',
						routeClass: 'commercial',
						eventProperties: {},
						consentSnapshot: { necessary: true, analytics: true, marketing: false },
					},
				}),
			).rejects.toThrow('Tracking event payload is invalid.');

			expect(mockUpsertVisitorSession).not.toHaveBeenCalled();
			expect(mockInsertTrackingEvent).not.toHaveBeenCalled();
		},
	);

	describe('WhatsApp lead auto-creation', () => {
		it('auto-creates a lead when whatsapp_contact_clicked carries a lead_code', async () => {
			mockInsertTrackingEvent.mockResolvedValue({
				id: 'whatsapp-event-id',
				eventName: 'whatsapp_contact_clicked',
			});

			const result = await ingestTrackingEvent({
				request: makeRequest(),
				vercelEnv: 'production',
				payload: {
					sessionId: '44444444-4444-4444-8444-444444444444',
					visitorId: 'visitor_wa_user',
					eventName: 'whatsapp_contact_clicked',
					routePath: '/',
					routeClass: 'commercial',
					eventProperties: {
						cta_id: 'contact_whatsapp',
						lead_code: 'CM-WHATSAPP01',
					},
					source: 'facebook',
					medium: 'paid',
					campaign: 'summer_campaign',
					consentSnapshot: { necessary: true, analytics: true, marketing: false },
				},
			});

			expect(result).toEqual({ accepted: true, eventId: 'whatsapp-event-id' });
			expect(mockCreateLeadFromTrackingEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					leadCode: 'CM-WHATSAPP01',
					sessionId: '44444444-4444-4444-8444-444444444444',
					sourceEventId: 'whatsapp-event-id',
					channel: 'whatsapp',
					visitorId: 'visitor_wa_user',
					utmSource: 'facebook',
					utmMedium: 'paid',
					utmCampaign: 'summer_campaign',
				}),
			);
		});

		it('does not auto-create a lead for non-WhatsApp events even with lead_code', async () => {
			await ingestTrackingEvent({
				request: makeRequest(),
				vercelEnv: 'production',
				payload: {
					sessionId: '55555555-5555-4555-8555-555555555555',
					visitorId: 'visitor_cta_user',
					eventName: 'cta_clicked',
					routePath: '/',
					routeClass: 'commercial',
					eventProperties: {
						cta_id: 'hero_email',
						lead_code: 'CM-EMAIL01',
					},
					consentSnapshot: { necessary: true, analytics: true, marketing: false },
				},
			});

			expect(mockCreateLeadFromTrackingEvent).not.toHaveBeenCalled();
		});

		it('does not auto-create a lead when whatsapp_contact_clicked has no lead_code', async () => {
			mockInsertTrackingEvent.mockResolvedValue({
				id: 'wa-event-no-code',
				eventName: 'whatsapp_contact_clicked',
			});

			await ingestTrackingEvent({
				request: makeRequest(),
				vercelEnv: 'production',
				payload: {
					sessionId: '66666666-6666-4666-8666-666666666666',
					visitorId: 'visitor_wa_no_code',
					eventName: 'whatsapp_contact_clicked',
					routePath: '/',
					routeClass: 'commercial',
					eventProperties: {
						cta_id: 'contact_whatsapp',
					},
					consentSnapshot: { necessary: true, analytics: true, marketing: false },
				},
			});

			expect(mockCreateLeadFromTrackingEvent).not.toHaveBeenCalled();
		});

		it('copies sanitized Meta attribution into auto-created WhatsApp leads', async () => {
			mockInsertTrackingEvent.mockResolvedValue({
				id: 'whatsapp-event-id',
				eventName: 'whatsapp_contact_clicked',
			});

			await ingestTrackingEvent({
				request: makeRequest(),
				vercelEnv: 'production',
				payload: {
					sessionId: '99999999-9999-4999-8999-999999999999',
					visitorId: 'visitor_wa_meta_user',
					eventName: 'whatsapp_contact_clicked',
					routePath: '/',
					routeClass: 'commercial',
					metaAttribution: {
						fbp: 'fb.1.1710000000000.1234567890',
						fbc: 'fb.1.1710000000000.Click-123',
						fbclid: 'Click-123',
					},
					eventProperties: {
						cta_id: 'contact_whatsapp',
						lead_code: 'CM-WHMETA1',
					},
					consentSnapshot: { necessary: true, analytics: true, marketing: true },
				},
			});

			expect(mockCreateLeadFromTrackingEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					leadCode: 'CM-WHMETA1',
					metaAttribution: {
						fbp: 'fb.1.1710000000000.1234567890',
						fbc: 'fb.1.1710000000000.Click-123',
						fbclid: 'Click-123',
					},
				}),
			);
		});
	});
});

/* ================================================================
 * Attribution referrer [T3, T4b]
 *
 * - [T3] The landing_path/referrer sent to upsertVisitorSession comes from
 *        the payload (client-sent document.referrer), not from the HTTP
 *        request Referer header on the API call.
 * - [T4b] request.headers.get("referer") is NOT used as the referrer.
 * ================================================================ */

describe('Attribution referrer from payload, not request Referer header [T3, T4b]', () => {
	function makeRequestWithReferer(referer: string, path = '/'): Request {
		return new Request(`https://www.celebra-me.com${path}`, {
			headers: { cookie: '', referer },
		});
	}

	beforeEach(() => {
		jest.clearAllMocks();
		mockUpsertVisitorSession.mockResolvedValue(undefined);
		mockInsertTrackingEvent.mockResolvedValue({
			id: 'event-id',
			eventName: 'page_viewed',
		});
	});

	it('[T3] referrer from payload is passed to upsertVisitorSession', async () => {
		await ingestTrackingEvent({
			request: makeRequestWithReferer('https://api-call-self-ref.celebra-me.com/api/tracking/events'),
			vercelEnv: 'production',
			payload: {
				sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
				visitorId: 'visitor_ref_test',
				eventName: 'page_viewed',
				routePath: '/',
				routeClass: 'commercial',
				// Browser-captured document.referrer: the real external source.
				referrer: 'https://www.facebook.com/',
				eventProperties: {},
				consentSnapshot: { necessary: true, analytics: true, marketing: false },
			},
		});

		expect(mockUpsertVisitorSession).toHaveBeenCalledWith(
			expect.objectContaining({
				referrer: 'https://www.facebook.com/',
			}),
		);
	});

	it('[T4b] request HTTP Referer header is NOT used as the referrer', async () => {
		await ingestTrackingEvent({
			// The HTTP Referer on the POST is typically the page itself, not the external source.
			request: makeRequestWithReferer('https://www.celebra-me.com/'),
			vercelEnv: 'production',
			payload: {
				sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
				visitorId: 'visitor_noref_test',
				eventName: 'page_viewed',
				routePath: '/',
				routeClass: 'commercial',
				// No referrer in payload (second+ event in session).
				eventProperties: {},
				consentSnapshot: { necessary: true, analytics: true, marketing: false },
			},
		});

		// The session upsert should receive undefined for referrer,
		// NOT the HTTP Referer header value 'https://www.celebra-me.com/'.
		expect(mockUpsertVisitorSession).toHaveBeenCalledWith(
			expect.objectContaining({
				referrer: undefined,
			}),
		);
	});

	it('[T3b] utmContent and utmTerm from payload are forwarded to upsertVisitorSession', async () => {
		await ingestTrackingEvent({
			request: makeRequestWithReferer(''),
			vercelEnv: 'production',
			payload: {
				sessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
				visitorId: 'visitor_utm_ext',
				eventName: 'page_viewed',
				routePath: '/',
				routeClass: 'commercial',
				utmContent: 'banner-hero',
				utmTerm: 'invitacion digital',
				eventProperties: {},
				consentSnapshot: { necessary: true, analytics: true, marketing: false },
			},
		});

		expect(mockUpsertVisitorSession).toHaveBeenCalledWith(
			expect.objectContaining({
				utmContent: 'banner-hero',
				utmTerm: 'invitacion digital',
			}),
		);
	});
});
