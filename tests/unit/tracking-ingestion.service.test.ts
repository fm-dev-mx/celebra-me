jest.mock('@/lib/tracking/repository', () => ({
	upsertVisitorSession: jest.fn(),
	insertTrackingEvent: jest.fn(),
}));

jest.mock('@/lib/tracking/lead.service', () => ({
	createLeadFromTrackingEvent: jest.fn(),
}));

import { ingestTrackingEvent } from '@/lib/tracking/ingestion.service';
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
	});
});
