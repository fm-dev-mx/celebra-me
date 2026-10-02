jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	listInvitations: jest.fn(),
}));
jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));

import { listInvitations } from '@/lib/intake/repositories/invitation.repository';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { getEnrichedInvitationList } from '@/lib/intake/services/invitation.service';
import type { Invitation } from '@/lib/intake/types';

describe('list schedule projection', () => {
	beforeEach(() => jest.clearAllMocks());
	it('uses five bulk reads and published precedence', async () => {
		jest.mocked(listInvitations).mockResolvedValue([
			{ id: 'published', kind: 'client' },
			{ id: 'draft', kind: 'client' },
		] as Invitation[]);
		jest.mocked(supabaseRestRequest)
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{ id: 'p', invitation_project_id: 'published', heroDate: 'invalid' },
			])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{ invitation_project_id: 'published', heroDate: '2099-01-01' },
				{ invitation_project_id: 'draft', heroDate: '2099-02-01' },
			]);
		const items = await getEnrichedInvitationList('all');
		expect(items[0]).toMatchObject({ eventDate: null, validity: 'unknown' });
		expect(items[1]).toMatchObject({ eventDate: '2099-02-01', validity: 'upcoming' });
		expect(supabaseRestRequest).toHaveBeenCalledTimes(5);
		for (const [query] of jest.mocked(supabaseRestRequest).mock.calls) {
			expect(query.pathWithQuery).not.toMatch(/select=\*|[,=]content(?:,|&)/);
		}
		expect(jest.mocked(supabaseRestRequest).mock.calls[2][0].pathWithQuery).toContain(
			'heroDate:content->hero->>date',
		);
		expect(items[0]).not.toHaveProperty('content');
		expect(items[0]).not.toHaveProperty('eventTiming');
	});
});
