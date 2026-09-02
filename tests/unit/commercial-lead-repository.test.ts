jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { upsertLead } from '@/lib/tracking/lead.repository';

const mockRestRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

describe('upsertLead', () => {
	beforeEach(() => jest.clearAllMocks());

	it('does not regress status or erase identity when an existing lead is resubmitted with blanks', async () => {
		mockRestRequest
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 'lead-id', lead_code: 'CM-ABC123', status: 'quoted' }]);

		const result = await upsertLead({
			leadCode: 'CM-ABC123',
			sessionId: 'session-1',
			channel: 'contact_form',
			status: 'new',
			name: '   ',
			email: '',
			phone: '',
			consentContact: true,
			consentMarketing: true,
		});

		expect(result.status).toBe('quoted');
		expect(mockRestRequest).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				method: 'PATCH',
				body: {
					consent_contact: true,
					consent_marketing: true,
					session_id: 'session-1',
				},
			}),
		);
	});
});
