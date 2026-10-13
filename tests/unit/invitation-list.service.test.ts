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
	it('uses four bulk reads and published precedence', async () => {
		jest.mocked(listInvitations).mockResolvedValue([
			{ id: 'published', kind: 'client' },
			{ id: 'draft', kind: 'client' },
		] as Invitation[]);
		jest.mocked(supabaseRestRequest)
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{ id: 'p', invitation_project_id: 'published', heroDate: 'invalid' },
			])
			.mockResolvedValueOnce([
				{ invitation_project_id: 'published', heroDate: '2099-01-01' },
				{ invitation_project_id: 'draft', heroDate: '2099-02-01' },
			])
			.mockResolvedValueOnce([
				{
					invitation_id: 'published',
					payment_status: 'unpaid',
					public_access: 'enabled',
					internal_note: null,
					version: 1,
					updated_at: '2026-10-10T00:00:00Z',
					updated_by: null,
				},
			]);
		const items = await getEnrichedInvitationList('all');
		expect(items[0]).toMatchObject({ eventDate: null, validity: 'unknown' });
		expect(items[1]).toMatchObject({ eventDate: '2099-02-01', validity: 'upcoming' });
		expect(items[0].access).toMatchObject({ paymentStatus: 'unpaid', publicAccess: 'enabled' });
		expect(items[1].access).toBeNull();
		expect(supabaseRestRequest).toHaveBeenCalledTimes(4);
		expect(jest.mocked(supabaseRestRequest).mock.calls[3][0].pathWithQuery).toContain(
			'invitation_access_controls?select=',
		);
		for (const [query] of jest.mocked(supabaseRestRequest).mock.calls) {
			expect(query.pathWithQuery).not.toMatch(/select=\*|[,=]content(?:,|&)/);
		}
		expect(jest.mocked(supabaseRestRequest).mock.calls[1][0].pathWithQuery).toContain(
			'heroDate:content->hero->>date',
		);
		expect(items[0]).not.toHaveProperty('content');
		expect(items[0]).not.toHaveProperty('eventTiming');
	});

	it('reads access state only for client invitations', async () => {
		jest.mocked(listInvitations).mockResolvedValue([
			{ id: 'client-1', kind: 'client' },
			{ id: 'demo-1', kind: 'demo' },
		] as Invitation[]);
		jest.mocked(supabaseRestRequest).mockResolvedValue([]);

		const items = await getEnrichedInvitationList('active');

		const accessCall = jest
			.mocked(supabaseRestRequest)
			.mock.calls.find(([query]) =>
				query.pathWithQuery.startsWith('invitation_access_controls'),
			);
		expect(accessCall?.[0].pathWithQuery).toContain('invitation_id=in.(client-1)');
		expect(items.find((item) => item.id === 'demo-1')?.access).toBeNull();
	});
});
