import {
	findPublishedByInvitationId,
	findPublishedBySlugAndEventType,
	findPublishedWithAccessBySlugAndEventType,
	updatePublishedContentSnapshot,
} from '@/lib/intake/repositories/published-invitation-content.repository';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const mockSupabaseRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

const publishedRow = {
	id: 'published-123',
	invitation_project_id: 'invitation-123',
	slug: 'maria-y-jose',
	event_type: 'boda',
	is_demo: false,
	content: { title: 'Maria y Jose' },
	version: 3,
	published_at: '2026-09-01T00:00:00Z',
	created_at: '2026-08-01T00:00:00Z',
	updated_at: '2026-09-01T00:00:00Z',
};

describe('published invitation content repository', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockSupabaseRequest.mockResolvedValue([publishedRow]);
	});

	it('uses service_role for every published-content read and write', async () => {
		await findPublishedByInvitationId('invitation-123');
		await findPublishedBySlugAndEventType('maria-y-jose', 'boda');
		await findPublishedWithAccessBySlugAndEventType('maria-y-jose', 'boda');
		await updatePublishedContentSnapshot({
			id: 'published-123',
			content: { title: 'Maria y Jose' },
			version: 4,
			publishedAt: '2026-09-02T00:00:00Z',
		});

		expect(mockSupabaseRequest).toHaveBeenCalled();
		expect(
			mockSupabaseRequest.mock.calls.every(([request]) => request.useServiceRole === true),
		).toBe(true);
	});
});

describe('findPublishedWithAccessBySlugAndEventType', () => {
	beforeEach(() => jest.clearAllMocks());

	it('embeds the invitation access state in the single public read', async () => {
		mockSupabaseRequest.mockResolvedValue([
			{
				...publishedRow,
				invitation: { access: { payment_status: 'unpaid', public_access: 'enabled' } },
			},
		]);

		const result = await findPublishedWithAccessBySlugAndEventType('maria-y-jose', 'boda');

		expect(mockSupabaseRequest).toHaveBeenCalledTimes(1);
		const [request] = mockSupabaseRequest.mock.calls[0];
		expect(request.pathWithQuery).toContain(
			'invitation:invitations(access:invitation_access_controls(payment_status,public_access))',
		);
		expect(request.pathWithQuery).toContain('slug=eq.maria-y-jose');
		expect(request.pathWithQuery).toContain('event_type=eq.boda');
		expect(request.pathWithQuery).toContain('deleted_at=is.null');
		expect(result).toEqual(
			expect.objectContaining({
				invitationId: 'invitation-123',
				version: 3,
				access: { paymentStatus: 'unpaid', publicAccess: 'enabled' },
			}),
		);
		expect(result).not.toHaveProperty('invitation');
	});

	it('reports a missing access row as null', async () => {
		mockSupabaseRequest.mockResolvedValue([{ ...publishedRow, invitation: { access: null } }]);

		const result = await findPublishedWithAccessBySlugAndEventType('maria-y-jose', 'boda');

		expect(result?.access).toBeNull();
	});

	it('returns null when nothing is published', async () => {
		mockSupabaseRequest.mockResolvedValue([]);

		await expect(
			findPublishedWithAccessBySlugAndEventType('maria-y-jose', 'boda'),
		).resolves.toBeNull();
	});
});
