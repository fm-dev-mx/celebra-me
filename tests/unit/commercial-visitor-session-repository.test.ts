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
});
