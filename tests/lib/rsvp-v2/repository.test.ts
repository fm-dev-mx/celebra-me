import { appendGuestAuditPublic } from '@/lib/rsvp/repositories/audit.repository';
import {
	findEventById,
	findEventsByOwner,
	findEventsForHost,
} from '@/lib/rsvp/repositories/event.repository';
import {
	createGuestInvitation,
	findGuestById,
	findGuestByInviteIdPublic,
	findGuestByPhoneAuth,
	findGuestsByEvent,
	softDeleteGuestById,
	updateGuestByInviteIdPublic,
} from '@/lib/rsvp/repositories/guest.repository';
import type { GuestFilters } from '@/lib/rsvp/repositories/shared/rows';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

const supabaseRestRequestMock = supabaseRestRequest as jest.MockedFunction<
	typeof supabaseRestRequest
>;

describe('rsvp repository', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('maps event row and returns null when not found', async () => {
		supabaseRestRequestMock.mockResolvedValueOnce([]);
		const none = await findEventById('evt-1', 'token');
		expect(none).toBeNull();
		expect(supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);

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
		] as Record<string, unknown>[]);
		const found = await findEventById('evt-1', 'token');
		expect(found?.ownerUserId).toBe('host-1');
	});

	it('filters soft-deleted events in host-facing queries', async () => {
		supabaseRestRequestMock.mockResolvedValue([]);

		await findEventsByOwner('host-1', 'token');
		await findEventsForHost('token');

		expect(supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);
		expect(supabaseRestRequestMock.mock.calls[1]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);
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
				guest_comment: '',
				delivery_status: 'generated',
				first_viewed_at: null,
				last_viewed_at: null,
				view_percentage: 0,
				is_viewed: false,
				responded_at: null,
				last_response_source: 'link',
				created_at: '2026-01-01T00:00:00.000Z',
				updated_at: '2026-01-01T00:00:00.000Z',
			},
		] as Record<string, unknown>[]);
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
				guest_comment: 'ok',
				delivery_status: 'shared',
				first_viewed_at: null,
				last_viewed_at: null,
				view_percentage: 0,
				is_viewed: false,
				responded_at: null,
				last_response_source: 'link',
				created_at: '2026-01-01T00:00:00.000Z',
				updated_at: '2026-01-01T00:00:00.000Z',
			},
		] as Record<string, unknown>[]);
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
				guest_comment: '',
				delivery_status: 'generated',
				first_viewed_at: null,
				last_viewed_at: null,
				view_percentage: 0,
				is_viewed: false,
				responded_at: null,
				last_response_source: 'link',
				created_at: '2026-01-01T00:00:00.000Z',
				updated_at: '2026-01-01T00:00:00.000Z',
			},
		] as Record<string, unknown>[]);
		const byInvite = await findGuestByInviteIdPublic('invite-1');
		expect(byInvite?.id).toBe('guest-1');
		expect(supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);

		supabaseRestRequestMock.mockResolvedValueOnce([]);
		const byId = await findGuestById('guest-404', 'token');
		expect(byId).toBeNull();
		expect(supabaseRestRequestMock.mock.calls[1]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);

		supabaseRestRequestMock.mockResolvedValueOnce([
			{
				id: 'audit-1',
				guest_invitation_id: 'guest-1',
				actor_type: 'guest',
				event_type: 'viewed',
				payload: { source: 'test' },
				created_at: '2026-01-01T00:00:00.000Z',
			},
		] as Record<string, unknown>[]);
		const audit = await appendGuestAuditPublic('guest-1', 'viewed', { source: 'test' });
		expect(audit.eventType).toBe('viewed');
	});

	it('filters soft-deleted guests in phone lookups and soft deletes via patch', async () => {
		supabaseRestRequestMock.mockResolvedValueOnce([]);
		await findGuestByPhoneAuth('evt-1', '6680000000', 'token');
		expect(supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);

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
				guest_comment: '',
				delivery_status: 'generated',
				first_viewed_at: null,
				last_viewed_at: null,
				view_percentage: 0,
				is_viewed: false,
				responded_at: null,
				last_response_source: 'link',
				created_at: '2026-01-01T00:00:00.000Z',
				updated_at: '2026-01-01T00:00:00.000Z',
			},
		] as Record<string, unknown>[]);
		await softDeleteGuestById('guest-1', 'token');
		expect(supabaseRestRequestMock.mock.calls[1]?.[0]).toEqual(
			expect.objectContaining({
				method: 'PATCH',
				pathWithQuery: expect.stringContaining('id=eq.guest-1&deleted_at=is.null'),
				body: expect.objectContaining({
					deleted_at: expect.any(String),
				}),
				authToken: 'token',
				prefer: 'return=representation',
			}),
		);
	});

	describe('findGuestsByEvent search', () => {
		function getQuery(search: string, status?: string, delivery?: string): string {
			supabaseRestRequestMock.mockResolvedValue([]);
			findGuestsByEvent(
				{ eventId: 'evt-1', search, status, delivery } as unknown as GuestFilters,
				'token',
			);
			return supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery ?? '';
		}

		it('searches by name', () => {
			const query = getQuery('Hannah');
			expect(query).toContain('full_name.ilike.*Hannah*');
			expect(query).not.toContain('or=');
		});

		it('searches by exact national phone', () => {
			const query = getQuery('6681023442');
			expect(query).toContain('or=(full_name.ilike.*6681023442*,phone.ilike.*6681023442*)');
		});

		it('searches by partial phone', () => {
			const query = getQuery('6681');
			expect(query).toContain('or=(full_name.ilike.*6681*,phone.ilike.*6681*)');
		});

		it('strips formatting from phone input', () => {
			const query = getQuery('668 102 3442');
			expect(query).toContain(
				'or=(full_name.ilike.*668%20102%203442*,phone.ilike.*6681023442*)',
			);
		});

		it('extracts last 10 digits from international formatted input', () => {
			const query = getQuery('+52 6681023442');
			expect(query).toContain(
				'or=(full_name.ilike.*%2B52%206681023442*,phone.ilike.*6681023442*)',
			);
		});

		it('composes search with attendance_status filter', () => {
			const query = getQuery('Ana', 'confirmed');
			expect(query).toContain('full_name.ilike.*Ana*');
			expect(query).not.toContain('or=');
			expect(query).toContain('attendance_status=eq.confirmed');
		});

		it('composes search with delivery_status filter', () => {
			const query = getQuery('Ana', undefined, 'generated');
			expect(query).toContain('full_name.ilike.*Ana*');
			expect(query).not.toContain('or=');
			expect(query).toContain('delivery_status=eq.generated');
		});

		it('does not add or() when search is empty', () => {
			const query = getQuery('');
			expect(query).not.toContain('or=');
		});

		it('returns empty results when no rows match', async () => {
			supabaseRestRequestMock.mockResolvedValue([]);
			const results = await findGuestsByEvent(
				{ eventId: 'evt-1', search: 'nonexistent' },
				'token',
			);
			expect(results).toEqual([]);
		});
	});
});
