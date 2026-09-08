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
	it('uses five bulk reads, published precedence, and the existing showroom selection', async () => {
		jest.mocked(listInvitations).mockResolvedValue([
			{ id: 'published', kind: 'client' },
			{ id: 'draft', kind: 'client' },
			{ id: 'visible', kind: 'demo', eventType: 'xv', slug: 'demo-xv-celestial-blue' },
			{ id: 'hidden', kind: 'demo', eventType: 'xv', slug: 'demo-xv-jewelry-box' },
			{ id: 'pending', kind: 'demo', eventType: 'xv', slug: 'demo-xv-valentina-profile' },
			{ id: 'absent', kind: 'demo', eventType: 'xv', slug: 'unregistered' },
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
		expect(items[2].demoShowroomOrder).toEqual(expect.any(Number));
		expect(items.slice(3).every((item) => item.demoShowroomOrder === null)).toBe(true);
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
