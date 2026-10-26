jest.mock('@/lib/tracking/repository', () => ({
	upsertVisitorSession: jest.fn(),
	insertTrackingEvent: jest.fn(),
}));

jest.mock('@/lib/tracking/lead.service', () => ({
	createLeadFromTrackingEvent: jest.fn(),
}));

jest.mock('@/lib/tracking/lead.repository', () => ({
	findSessionLeadCustomerId: jest.fn(),
}));

jest.mock('@/lib/commercial/meta-capi/service', () => ({
	...jest.requireActual<object>('@/lib/commercial/meta-capi/service'),
	enqueueBrowserConversionEvent: jest.fn(),
}));

import { enqueueBrowserConversionEvent } from '@/lib/commercial/meta-capi/service';

import { ingestTrackingEvent } from '@/lib/tracking/ingestion.service';
import { INTERNAL_TRACKING_EVENT_NAMES } from '@/lib/tracking/event-contract';
import { findSessionLeadCustomerId } from '@/lib/tracking/lead.repository';
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

const mockFindSessionLeadCustomerId = findSessionLeadCustomerId as jest.MockedFunction<
	typeof findSessionLeadCustomerId
>;

const mockEnqueueBrowserConversionEvent = enqueueBrowserConversionEvent as jest.MockedFunction<
	typeof enqueueBrowserConversionEvent
>;

beforeEach(() => {
	jest.clearAllMocks();
	mockEnqueueBrowserConversionEvent.mockResolvedValue(undefined);
	mockFindSessionLeadCustomerId.mockResolvedValue(null);
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

const BROWSER_USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function makeRequest(path = '/', userAgent = BROWSER_USER_AGENT): Request {
	return new Request(`https://www.celebra-me.com${path}`, {
		headers: { cookie: '', 'user-agent': userAgent },
	});
}

describe('ingestTrackingEvent', () => {
	it('persists approved commercial events with sanitized properties', async () => {
		const result = await ingestTrackingEvent({
			request: makeRequest(),
			deployEnvironment: 'production',
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

	it('keeps a valid consent decision time on the session snapshot and drops other formats', async () => {
		const send = (decidedAt: string) =>
			ingestTrackingEvent({
				request: makeRequest(),
				deployEnvironment: 'production',
				payload: {
					sessionId: '77777777-7777-4777-8777-777777777777',
					visitorId: 'visitor_meta_user',
					eventName: 'page_viewed',
					routePath: '/',
					routeClass: 'commercial',
					eventProperties: { page_type: 'commercial' },
					consentSnapshot: {
						necessary: true,
						analytics: true,
						marketing: true,
						decidedAt,
					},
				},
			});

		await send('2026-10-25T12:00:00.000Z');
		expect(mockUpsertVisitorSession).toHaveBeenLastCalledWith(
			expect.objectContaining({
				consentSnapshot: {
					necessary: true,
					analytics: true,
					marketing: true,
					decidedAt: '2026-10-25T12:00:00.000Z',
				},
			}),
		);
		await expect(send('2026-10-25 12:00')).rejects.toThrow();
	});

	it('persists Meta attribution on commercial sessions without copying it into event properties', async () => {
		const result = await ingestTrackingEvent({
			request: makeRequest(),
			deployEnvironment: 'production',
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

	it('keeps the client IP and user agent on the session only with marketing consent', async () => {
		const payload = {
			sessionId: '88888888-8888-4888-8888-888888888888',
			visitorId: 'visitor_signals',
			eventName: 'page_viewed',
			routePath: '/',
			routeClass: 'commercial',
			eventProperties: { page_type: 'commercial' },
		};
		const request = () =>
			new Request('https://www.celebra-me.com/', {
				headers: {
					cookie: '',
					'user-agent': BROWSER_USER_AGENT,
					'x-forwarded-for': '203.0.113.7, 10.0.0.1',
				},
			});

		await ingestTrackingEvent({
			request: request(),
			deployEnvironment: 'production',
			payload: {
				...payload,
				consentSnapshot: { necessary: true, analytics: true, marketing: true },
			},
		});
		expect(mockUpsertVisitorSession).toHaveBeenLastCalledWith(
			expect.objectContaining({
				clientSignals: { ipAddress: '203.0.113.7', userAgent: BROWSER_USER_AGENT },
			}),
		);

		await ingestTrackingEvent({
			request: request(),
			deployEnvironment: 'production',
			payload: {
				...payload,
				consentSnapshot: { necessary: true, analytics: true, marketing: false },
			},
		});
		expect(mockUpsertVisitorSession).toHaveBeenLastCalledWith(
			expect.objectContaining({ clientSignals: undefined }),
		);
	});

	describe('Meta server events', () => {
		const clickEventId = '99999999-9999-4999-8999-999999999999';
		const clickPayload = (marketing: boolean, eventName = 'whatsapp_contact_clicked') => ({
			eventId: clickEventId,
			sessionId: '88888888-8888-4888-8888-888888888888',
			visitorId: 'visitor_click',
			eventName,
			routePath: '/demos/xv',
			routeClass: 'demo',
			eventProperties: { event_id: clickEventId, source_area: 'hero' },
			consentSnapshot: { necessary: true, analytics: true, marketing },
		});

		beforeEach(() => {
			mockInsertTrackingEvent.mockResolvedValue({
				id: clickEventId,
				eventName: 'whatsapp_contact_clicked',
			});
		});

		it('queues a WhatsApp click as Contact with the Pixel eventID', async () => {
			await ingestTrackingEvent({
				request: makeRequest('/demos/xv'),
				deployEnvironment: 'production',
				payload: clickPayload(true),
			});
			expect(mockEnqueueBrowserConversionEvent).toHaveBeenCalledWith({
				trigger: 'whatsapp_contact_clicked',
				eventId: clickEventId,
				sessionId: '88888888-8888-4888-8888-888888888888',
				eventSourcePath: '/demos/xv',
			});
		});

		it('adds the customer of a consented lead from the same session', async () => {
			mockFindSessionLeadCustomerId.mockResolvedValue('customer-1');
			await ingestTrackingEvent({
				request: makeRequest('/demos/xv'),
				deployEnvironment: 'production',
				payload: clickPayload(true, 'page_viewed'),
			});
			expect(mockFindSessionLeadCustomerId).toHaveBeenCalledWith(
				'88888888-8888-4888-8888-888888888888',
			);
			expect(mockEnqueueBrowserConversionEvent).toHaveBeenCalledWith({
				trigger: 'page_viewed',
				eventId: clickEventId,
				sessionId: '88888888-8888-4888-8888-888888888888',
				eventSourcePath: '/demos/xv',
				customerId: 'customer-1',
			});
		});

		it('still queues the event when the customer lookup fails', async () => {
			jest.spyOn(console, 'error').mockImplementation(() => undefined);
			mockFindSessionLeadCustomerId.mockRejectedValue(new Error('lookup failed'));
			await ingestTrackingEvent({
				request: makeRequest('/demos/xv'),
				deployEnvironment: 'production',
				payload: clickPayload(true, 'page_viewed'),
			});
			expect(mockEnqueueBrowserConversionEvent).toHaveBeenCalledWith(
				expect.not.objectContaining({ customerId: expect.anything() }),
			);
		});

		it('looks up no customer without marketing consent', async () => {
			await ingestTrackingEvent({
				request: makeRequest('/demos/xv'),
				deployEnvironment: 'production',
				payload: clickPayload(false, 'page_viewed'),
			});
			expect(mockFindSessionLeadCustomerId).not.toHaveBeenCalled();
			expect(mockEnqueueBrowserConversionEvent).not.toHaveBeenCalled();
		});

		it('queues a form submission as Lead', async () => {
			await ingestTrackingEvent({
				request: makeRequest('/demos/xv'),
				deployEnvironment: 'production',
				payload: clickPayload(true, 'form_submitted'),
			});
			expect(mockEnqueueBrowserConversionEvent).toHaveBeenCalledWith(
				expect.objectContaining({ trigger: 'form_submitted', eventId: clickEventId }),
			);
		});

		it.each(['page_viewed', 'demo_viewed', 'package_viewed'])(
			'queues %s with the Pixel eventID for the server PageView or ViewContent',
			async (eventName) => {
				await ingestTrackingEvent({
					request: makeRequest('/demos/xv'),
					deployEnvironment: 'production',
					payload: clickPayload(true, eventName),
				});
				expect(mockEnqueueBrowserConversionEvent).toHaveBeenCalledWith({
					trigger: eventName,
					eventId: clickEventId,
					sessionId: '88888888-8888-4888-8888-888888888888',
					eventSourcePath: '/demos/xv',
				});
			},
		);

		it('queues no page view without marketing consent or on a route Meta may not see', async () => {
			await ingestTrackingEvent({
				request: makeRequest('/demos/xv'),
				deployEnvironment: 'production',
				payload: clickPayload(false, 'page_viewed'),
			});
			await ingestTrackingEvent({
				request: makeRequest('/xv/valentina-hernandez'),
				deployEnvironment: 'production',
				payload: {
					...clickPayload(true, 'page_viewed'),
					routePath: '/xv/valentina-hernandez',
					routeClass: 'real_invitation',
				},
			});
			expect(mockEnqueueBrowserConversionEvent).not.toHaveBeenCalled();
		});

		it('queues nothing without marketing consent, outside Production or for other events', async () => {
			await ingestTrackingEvent({
				request: makeRequest('/demos/xv'),
				deployEnvironment: 'production',
				payload: clickPayload(false),
			});
			await ingestTrackingEvent({
				request: makeRequest('/demos/xv'),
				deployEnvironment: 'preview',
				payload: clickPayload(true),
			});
			await ingestTrackingEvent({
				request: makeRequest('/demos/xv'),
				deployEnvironment: 'production',
				payload: clickPayload(true, 'cta_clicked'),
			});
			expect(mockEnqueueBrowserConversionEvent).not.toHaveBeenCalled();
		});

		it('keeps the event accepted when queueing fails', async () => {
			mockEnqueueBrowserConversionEvent.mockRejectedValueOnce(new Error('insert failed'));
			const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
			await expect(
				ingestTrackingEvent({
					request: makeRequest('/demos/xv'),
					deployEnvironment: 'production',
					payload: clickPayload(true),
				}),
			).resolves.toEqual({ accepted: true, eventId: clickEventId });
			expect(consoleError).toHaveBeenCalledWith(
				'[tracking] Failed to queue the Meta server event:',
				expect.objectContaining({ code: 'Error' }),
			);
		});
	});

	it('ignores events on excluded real invitation routes', async () => {
		const result = await ingestTrackingEvent({
			request: makeRequest(),
			deployEnvironment: 'production',
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
				deployEnvironment: 'production',
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
					deployEnvironment: 'production',
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

	describe('automated traffic', () => {
		const commercialPayload = {
			sessionId: '11111111-1111-4111-8111-111111111111',
			visitorId: 'visitor_123456',
			eventName: 'page_viewed',
			routePath: '/',
			routeClass: 'commercial',
			eventProperties: {},
			consentSnapshot: { necessary: true, analytics: true, marketing: true },
		};

		it.each([
			[
				'Googlebot',
				'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
			],
			['an empty user agent', ''],
			['the WhatsApp link-preview fetcher', 'WhatsApp/2.23.20.0'],
		])('drops %s before any write', async (_label, userAgent) => {
			const result = await ingestTrackingEvent({
				request: makeRequest('/', userAgent),
				deployEnvironment: 'production',
				payload: commercialPayload,
			});

			expect(result).toEqual({ accepted: false, reason: 'automated_traffic' });
			expect(mockUpsertVisitorSession).not.toHaveBeenCalled();
			expect(mockInsertTrackingEvent).not.toHaveBeenCalled();
			expect(mockCreateLeadFromTrackingEvent).not.toHaveBeenCalled();
		});

		it('accepts a regular iPhone browser', async () => {
			const result = await ingestTrackingEvent({
				request: makeRequest(
					'/',
					'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
				),
				deployEnvironment: 'production',
				payload: commercialPayload,
			});

			expect(result).toEqual({ accepted: true, eventId: 'event-id' });
			expect(mockUpsertVisitorSession).toHaveBeenCalledTimes(1);
			expect(mockInsertTrackingEvent).toHaveBeenCalledTimes(1);
		});
	});

	describe('WhatsApp lead auto-creation', () => {
		it('auto-creates a lead when whatsapp_contact_clicked carries a lead_code', async () => {
			mockInsertTrackingEvent.mockResolvedValue({
				id: 'whatsapp-event-id',
				eventName: 'whatsapp_contact_clicked',
			});

			const result = await ingestTrackingEvent({
				request: makeRequest(),
				deployEnvironment: 'production',
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
				deployEnvironment: 'production',
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
				deployEnvironment: 'production',
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
				deployEnvironment: 'production',
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
			headers: { cookie: '', referer, 'user-agent': BROWSER_USER_AGENT },
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
			request: makeRequestWithReferer(
				'https://api-call-self-ref.celebra-me.com/api/tracking/events',
			),
			deployEnvironment: 'production',
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
			deployEnvironment: 'production',
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
			deployEnvironment: 'production',
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
