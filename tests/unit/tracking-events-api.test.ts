jest.mock('@/lib/tracking/ingestion.service', () => ({
	ingestTrackingEvent: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { ingestTrackingEvent } from '@/lib/tracking/ingestion.service';
import { POST } from '@/pages/api/tracking/events';

const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockIngestTrackingEvent = ingestTrackingEvent as jest.MockedFunction<
	typeof ingestTrackingEvent
>;

const payload = {
	sessionId: '11111111-1111-4111-8111-111111111111',
	visitorId: 'visitor_123456',
	eventName: 'cta_clicked',
	routePath: '/',
	routeClass: 'commercial',
	eventProperties: { cta_id: 'hero_whatsapp' },
	consentSnapshot: { necessary: true, analytics: true, marketing: false },
};

function createContext(request: Request) {
	return {
		request,
		url: new URL(request.url),
		params: {},
		props: {},
		locals: {},
		cookies: {} as never,
		redirect: jest.fn() as never,
		rewrite: jest.fn() as never,
		site: undefined,
		generator: 'Astro',
		clientAddress: '127.0.0.1',
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	mockCheckRateLimit.mockResolvedValue(true);
	mockIngestTrackingEvent.mockResolvedValue({ accepted: true, eventId: 'event-id' });
});

describe('/api/tracking/events', () => {
	it('ingests a valid tracking event', async () => {
		const request = new Request('https://www.celebra-me.com/api/tracking/events', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload),
		});

		const response = await POST(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual({
			success: true,
			data: { accepted: true, eventId: 'event-id' },
		});
		expect(mockCheckRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({
				namespace: 'tracking',
				entityId: 'events',
				maxHits: 120,
				windowSec: 60,
			}),
		);
		expect(mockIngestTrackingEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				request,
				payload,
			}),
		);
	});

	it('returns accepted false events without persisting route-forbidden details as errors', async () => {
		mockIngestTrackingEvent.mockResolvedValue({ accepted: false, reason: 'route_not_allowed' });
		const request = new Request('https://www.celebra-me.com/api/tracking/events', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload),
		});

		const response = await POST(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(202);
		expect(body.data).toEqual({ accepted: false, reason: 'route_not_allowed' });
	});

	it('rate limits noisy clients', async () => {
		mockCheckRateLimit.mockResolvedValue(false);
		const request = new Request('https://www.celebra-me.com/api/tracking/events', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload),
		});

		const response = await POST(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(429);
		expect(body.success).toBe(false);
		expect(mockIngestTrackingEvent).not.toHaveBeenCalled();
	});
});
