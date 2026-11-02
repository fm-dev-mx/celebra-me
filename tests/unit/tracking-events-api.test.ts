/**
 * @jest-environment node
 */
jest.mock('@/lib/tracking/ingestion.service', () => ({
	ingestTrackingEvent: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { ingestTrackingEvent } from '@/lib/tracking/ingestion.service';
import { POST } from '@/pages/api/tracking/events';
import { ApiError } from '@/lib/rsvp/core/errors';
import { createApiContext } from '../helpers/api-mocks';

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

const BROWSER_HEADERS = {
	'content-type': 'application/json',
	'user-agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
};

beforeEach(() => {
	jest.clearAllMocks();
	mockCheckRateLimit.mockResolvedValue(true);
	mockIngestTrackingEvent.mockResolvedValue({ accepted: true, eventId: 'event-id' });
});

describe('/api/tracking/events', () => {
	it('ingests a valid tracking event', async () => {
		const request = new Request('https://www.celebra-me.com/api/tracking/events', {
			method: 'POST',
			headers: BROWSER_HEADERS,
			body: JSON.stringify(payload),
		});

		const response = await POST(createApiContext(request) as never);
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

	it('passes the Worker context so Meta delivery outlives the response', async () => {
		const waitUntil = jest.fn();
		const request = new Request('https://www.celebra-me.com/api/tracking/events', {
			method: 'POST',
			headers: BROWSER_HEADERS,
			body: JSON.stringify(payload),
		});
		const context = {
			...createApiContext(request),
			locals: { runtime: { ctx: { waitUntil } } },
		};

		await POST(context as never);
		const after = mockIngestTrackingEvent.mock.calls[0]?.[0].after;
		const task = Promise.resolve();
		after?.waitUntil(task);

		expect(waitUntil).toHaveBeenCalledWith(task);
	});

	it('returns accepted false events without persisting route-forbidden details as errors', async () => {
		mockIngestTrackingEvent.mockResolvedValue({ accepted: false, reason: 'route_not_allowed' });
		const request = new Request('https://www.celebra-me.com/api/tracking/events', {
			method: 'POST',
			headers: BROWSER_HEADERS,
			body: JSON.stringify(payload),
		});

		const response = await POST(createApiContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(202);
		expect(body.data).toEqual({ accepted: false, reason: 'route_not_allowed' });
	});

	it('answers 202 when automated traffic is dropped', async () => {
		mockIngestTrackingEvent.mockResolvedValue({ accepted: false, reason: 'automated_traffic' });
		const request = new Request('https://www.celebra-me.com/api/tracking/events', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'user-agent':
					'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
			},
			body: JSON.stringify(payload),
		});

		const response = await POST(createApiContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(202);
		expect(body.data).toEqual({ accepted: false, reason: 'automated_traffic' });
		expect(mockIngestTrackingEvent).toHaveBeenCalledWith(expect.objectContaining({ request }));
	});

	it('rate limits noisy clients', async () => {
		mockCheckRateLimit.mockResolvedValue(false);
		const request = new Request('https://www.celebra-me.com/api/tracking/events', {
			method: 'POST',
			headers: BROWSER_HEADERS,
			body: JSON.stringify(payload),
		});

		const response = await POST(createApiContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(429);
		expect(body.success).toBe(false);
		expect(mockIngestTrackingEvent).not.toHaveBeenCalled();
	});

	it('returns the structured validation error for a server-owned event name', async () => {
		mockIngestTrackingEvent.mockRejectedValue(
			new ApiError(400, 'bad_request', 'Tracking event payload is invalid.'),
		);
		const request = new Request('https://www.celebra-me.com/api/tracking/events', {
			method: 'POST',
			headers: BROWSER_HEADERS,
			body: JSON.stringify({ ...payload, eventName: 'order_created' }),
		});

		const response = await POST(createApiContext(request) as never);

		expect(response.status).toBe(400);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(await response.json()).toEqual({
			success: false,
			error: { code: 'bad_request', message: 'Tracking event payload is invalid.' },
		});
	});
});
