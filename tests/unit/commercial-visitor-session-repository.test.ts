jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { upsertVisitorSession } from '@/lib/tracking/repository';

const mockRestRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

describe('upsertVisitorSession repository wrapper', () => {
	beforeEach(() => jest.clearAllMocks());

	it('sends utm_content and utm_term to the database payload', async () => {
		mockRestRequest.mockResolvedValueOnce([]);

		await upsertVisitorSession({
			sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			visitorId: 'visitor-1',
			landingPath: '/',
			routeClass: 'commercial',
			isInternal: false,
			consentSnapshot: { necessary: true, analytics: true, marketing: false },
			utmContent: 'banner-ad',
			utmTerm: 'keyword',
		});

		expect(mockRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				pathWithQuery: 'visitor_sessions?on_conflict=id',
				method: 'POST',
				body: expect.objectContaining({
					utm_content: 'banner-ad',
					utm_term: 'keyword',
				}),
			}),
		);
	});

	it('writes client signals within the column limits and omits empty ones', async () => {
		mockRestRequest.mockResolvedValue([]);
		const longUserAgent = 'A'.repeat(600);

		await upsertVisitorSession({
			sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
			visitorId: 'visitor-2',
			landingPath: '/',
			routeClass: 'commercial',
			isInternal: false,
			consentSnapshot: { necessary: true, analytics: true, marketing: true },
			clientSignals: { ipAddress: '203.0.113.7', userAgent: longUserAgent },
		});
		const body = mockRestRequest.mock.calls[0]?.[0].body as Record<string, unknown>;
		expect(body.client_ip_address).toBe('203.0.113.7');
		expect(body.client_user_agent).toBe('A'.repeat(512));

		await upsertVisitorSession({
			sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
			visitorId: 'visitor-2',
			landingPath: '/',
			routeClass: 'commercial',
			isInternal: false,
			consentSnapshot: { necessary: true, analytics: true, marketing: true },
			clientSignals: { ipAddress: null, userAgent: '  ' },
		});
		const emptyBody = JSON.parse(
			JSON.stringify(mockRestRequest.mock.calls[1]?.[0].body),
		) as Record<string, unknown>;
		expect(emptyBody).not.toHaveProperty('client_ip_address');
		expect(emptyBody).not.toHaveProperty('client_user_agent');
	});
});
