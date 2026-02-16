import {
	appendGuestAuditPublic,
	createGuestInvitation,
	findEventById,
	findGuestById,
	findGuestByInviteIdPublic,
	updateGuestByInviteIdPublic,
} from '@/lib/rsvp-v2/repository';
import { supabaseRestRequest } from '@/lib/rsvp-v2/supabase';

jest.mock('@/lib/rsvp-v2/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

const supabaseRestRequestMock = supabaseRestRequest as jest.MockedFunction<
	typeof supabaseRestRequest
>;

describe('rsvp-v2 repository', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('maps event row and returns null when not found', async () => {
		supabaseRestRequestMock.mockResolvedValueOnce([]);
		const none = await findEventById('evt-1', 'token');
		expect(none).toBeNull();

		supabaseRestRequestMock.mockResolvedValueOnce([
			{
				id: 'evt-1',
				owner_user_id: 'host-1',
				slug: 'demo',
				event_type: 'cumple',
				title: 'Demo',
				status: 'published',
				published_at: null,
				created_at: '2026-01-01T00:00:00.000Z',
				updated_at: '2026-01-01T00:00:00.000Z',
			},
		] as never);
		const found = await findEventById('evt-1', 'token');
		expect(found?.ownerUserId).toBe('host-1');
	});

	it('creates and updates guests through expected repository contracts', async () => {
		supabaseRestRequestMock.mockResolvedValueOnce([
			{
				id: 'guest-1',
				invite_id: 'invite-1',
				event_id: 'evt-1',
				full_name: 'Guest One',
				phone: '6680000000',
				max_allowed_attendees: 2,
				attendance_status: 'pending',
				attendee_count: 0,
				guest_message: '',
				delivery_status: 'generated',
				first_viewed_at: null,
				last_viewed_at: null,
				responded_at: null,
				last_response_source: 'link',
				created_at: '2026-01-01T00:00:00.000Z',
				updated_at: '2026-01-01T00:00:00.000Z',
			},
		] as never);
		const created = await createGuestInvitation(
			{
				eventId: 'evt-1',
				fullName: 'Guest One',
				phone: '6680000000',
				maxAllowedAttendees: 2,
			},
			'token',
		);
		expect(created.id).toBe('guest-1');

		supabaseRestRequestMock.mockResolvedValueOnce([
			{
				id: 'guest-1',
				invite_id: 'invite-1',
				event_id: 'evt-1',
				full_name: 'Guest One',
				phone: '6680000000',
				max_allowed_attendees: 2,
				attendance_status: 'confirmed',
				attendee_count: 2,
				guest_message: 'ok',
				delivery_status: 'shared',
				first_viewed_at: null,
				last_viewed_at: null,
				responded_at: null,
				last_response_source: 'link',
				created_at: '2026-01-01T00:00:00.000Z',
				updated_at: '2026-01-01T00:00:00.000Z',
			},
		] as never);
		const updated = await updateGuestByInviteIdPublic('invite-1', {
			attendance_status: 'confirmed',
		});
		expect(updated.attendanceStatus).toBe('confirmed');
		expect(updated.deliveryStatus).toBe('shared');
	});

	it('finds guest by ids and appends public audit', async () => {
		supabaseRestRequestMock.mockResolvedValueOnce([
			{
				id: 'guest-1',
				invite_id: 'invite-1',
				event_id: 'evt-1',
				full_name: 'Guest One',
				phone: '6680000000',
				max_allowed_attendees: 2,
				attendance_status: 'pending',
				attendee_count: 0,
				guest_message: '',
				delivery_status: 'generated',
				first_viewed_at: null,
				last_viewed_at: null,
				responded_at: null,
				last_response_source: 'link',
				created_at: '2026-01-01T00:00:00.000Z',
				updated_at: '2026-01-01T00:00:00.000Z',
			},
		] as never);
		const byInvite = await findGuestByInviteIdPublic('invite-1');
		expect(byInvite?.id).toBe('guest-1');

		supabaseRestRequestMock.mockResolvedValueOnce([] as never);
		const byId = await findGuestById('guest-404', 'token');
		expect(byId).toBeNull();

		supabaseRestRequestMock.mockResolvedValueOnce([
			{
				id: 'audit-1',
				guest_invitation_id: 'guest-1',
				actor_type: 'guest',
				event_type: 'viewed',
				payload: { source: 'test' },
				created_at: '2026-01-01T00:00:00.000Z',
			},
		] as never);
		const audit = await appendGuestAuditPublic('guest-1', 'viewed', { source: 'test' });
		expect(audit.eventType).toBe('viewed');
	});
});
