jest.mock('@/lib/tracking/repository', () => ({
	upsertVisitorSession: jest.fn(),
	insertTrackingEvent: jest.fn(),
}));

import { ingestTrackingEvent } from '@/lib/tracking/ingestion.service';
import { insertTrackingEvent, upsertVisitorSession } from '@/lib/tracking/repository';

const mockUpsertVisitorSession = upsertVisitorSession as jest.MockedFunction<
	typeof upsertVisitorSession
>;
const mockInsertTrackingEvent = insertTrackingEvent as jest.MockedFunction<
	typeof insertTrackingEvent
>;

beforeEach(() => {
	jest.clearAllMocks();
	mockUpsertVisitorSession.mockResolvedValue(undefined);
	mockInsertTrackingEvent.mockResolvedValue({
		id: 'event-id',
		eventName: 'cta_clicked',
	});
});

describe('ingestTrackingEvent', () => {
	it('persists approved commercial events with sanitized properties', async () => {
		const result = await ingestTrackingEvent({
			request: new Request('https://www.celebra-me.com/api/tracking/events', {
				headers: { cookie: '' },
			}),
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
			request: new Request('https://www.celebra-me.com/api/tracking/events'),
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
	});

	it('rejects PII-like event properties', async () => {
		await expect(
			ingestTrackingEvent({
				request: new Request('https://www.celebra-me.com/api/tracking/events'),
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
	});
});
