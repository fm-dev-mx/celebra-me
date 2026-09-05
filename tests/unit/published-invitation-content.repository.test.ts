import {
	findPublishedByInvitationId,
	findPublishedBySlugAndEventType,
	listPublishedByEventTypes,
	updatePublishedContentSnapshot,
	upsertPublishedContent,
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
		await listPublishedByEventTypes(['boda']);
		await upsertPublishedContent({
			invitationId: 'invitation-123',
			slug: 'maria-y-jose',
			eventType: 'boda',
			isDemo: false,
			content: { title: 'Maria y Jose' },
		});
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
