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
	findGuestByPhonePublic,
	findGuestsByEvent,
	softDeleteGuestById,
	updateGuestByInviteIdPublic,
} from '@/lib/rsvp/repositories/guest.repository';
import type { AttendanceStatus, DeliveryFilter } from '@/interfaces/rsvp/domain.interface';
import type { GuestFilters } from '@/lib/rsvp/repositories/shared/rows';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

const supabaseRestRequestMock = supabaseRestRequest as jest.MockedFunction<
	typeof supabaseRestRequest
>;

function makeGuestRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
	return {
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
		...overrides,
	};
}

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
		supabaseRestRequestMock.mockResolvedValueOnce([makeGuestRow()]);
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
			makeGuestRow({
				attendance_status: 'confirmed',
				attendee_count: 2,
				guest_comment: 'ok',
				delivery_status: 'shared',
			}),
		]);
		const updated = await updateGuestByInviteIdPublic('invite-1', {
			attendance_status: 'confirmed',
		});
		expect(updated.attendanceStatus).toBe('confirmed');
		expect(updated.deliveryStatus).toBe('shared');
	});

	it('finds guest by ids and appends public audit', async () => {
		supabaseRestRequestMock.mockResolvedValueOnce([makeGuestRow()]);
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
		await findGuestByPhoneAuth('evt-1', '+52', '6680000000', 'token');
		expect(supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);
		expect(supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery).toContain(
			'country_code=eq.%2B52',
		);

		supabaseRestRequestMock.mockResolvedValueOnce([makeGuestRow()]);
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

	it('findGuestByPhoneAuth scopes by event — same phone in different events is allowed', async () => {
		supabaseRestRequestMock.mockResolvedValueOnce([]);
		supabaseRestRequestMock.mockResolvedValueOnce([makeGuestRow({ event_id: 'evt-2' })]);

		const notHere = await findGuestByPhoneAuth('evt-1', '+52', '6680000000', 'token');
		const inOtherEvent = await findGuestByPhoneAuth('evt-2', '+52', '6680000000', 'token');

		expect(notHere).toBeNull();
		expect(inOtherEvent).toMatchObject({ id: 'guest-1' });

		expect(supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery).toContain(
			'event_id=eq.evt-1',
		);
		expect(supabaseRestRequestMock.mock.calls[1]?.[0]?.pathWithQuery).toContain(
			'event_id=eq.evt-2',
		);
	});

	it('findGuestByPhoneAuth scopes by country code as well as event', async () => {
		supabaseRestRequestMock.mockResolvedValueOnce([]);

		await findGuestByPhoneAuth('evt-1', '+1', '6680000000', 'token');

		const query = supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery ?? '';
		expect(query).toContain('event_id=eq.evt-1');
		expect(query).toContain('country_code=eq.%2B1');
		expect(query).toContain('phone=eq.6680000000');
	});

	describe('findGuestsByEvent search', () => {
		function getQuery(
			search?: string,
			status?: AttendanceStatus | 'all' | 'viewed',
			delivery?: DeliveryFilter,
		): string {
			supabaseRestRequestMock.mockResolvedValue([]);
			findGuestsByEvent(
				{ eventId: 'evt-1', search, status, delivery } as GuestFilters,
				'token',
			);
			return supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery ?? '';
		}

		it('searches by name', () => {
			const query = getQuery('Hannah');
			expect(query).toContain('full_name=ilike.*Hannah*');
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
			expect(query).toContain('full_name=ilike.*Ana*');
			expect(query).not.toContain('or=');
			expect(query).toContain('attendance_status=eq.confirmed');
		});

		it('composes search with delivery_status filter', () => {
			const query = getQuery('Ana', undefined, 'generated');
			expect(query).toContain('full_name=ilike.*Ana*');
			expect(query).not.toContain('or=');
			expect(query).toContain('delivery_status=eq.generated');
		});

		it('name-only search does not include phone filter', () => {
			const query = getQuery('Hannah');
			expect(query).toContain('full_name=ilike.*Hannah*');
			expect(query).not.toContain('phone.ilike');
		});

		it('delivery filter composes with digit search', () => {
			const query = getQuery('6681', undefined, 'generated');
			expect(query).toContain('or=(full_name.ilike.*6681*,phone.ilike.*6681*)');
			expect(query).toContain('delivery_status=eq.generated');
		});

		it('does not add or() when search is empty', () => {
			const query = getQuery('');
			expect(query).not.toContain('or=');
		});

		it('does not add or() when search is whitespace only', () => {
			const query = getQuery('   ');
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

		it('deleted row remains hidden from dashboard search/list', async () => {
			supabaseRestRequestMock.mockResolvedValue([]);
			const results = await findGuestsByEvent(
				{ eventId: 'evt-1', search: '6681023442' },
				'token',
			);
			expect(results).toEqual([]);
			expect(supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery).toContain(
				'deleted_at=is.null',
			);
		});
	});

	describe('findGuestByPhonePublic', () => {
		it('finds a guest when eventId, countryCode, and phone all match', async () => {
			supabaseRestRequestMock.mockResolvedValue([makeGuestRow({ id: 'guest-1' })]);

			const result = await findGuestByPhonePublic('evt-1', '+52', '6680000000');

			expect(result).toMatchObject({ id: 'guest-1' });
		});

		it('returns null when countryCode differs even though eventId and phone match', async () => {
			supabaseRestRequestMock.mockResolvedValueOnce([]);

			const result = await findGuestByPhonePublic('evt-1', '+1', '6680000000');

			expect(result).toBeNull();
		});

		it.each([
			{ eventId: 'evt-2', countryCode: '+34', phone: '612345678' },
			{ eventId: 'evt-1', countryCode: '+52', phone: '6680000000' },
			{ eventId: 'evt-1', countryCode: '+1', phone: '5551234567' },
		])(
			'includes country_code=$countryCode filter in the query',
			async ({ eventId, countryCode, phone }) => {
				supabaseRestRequestMock.mockResolvedValueOnce([]);

				await findGuestByPhonePublic(eventId, countryCode, phone);

				const query = supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery ?? '';
				expect(query).toContain(`event_id=eq.${eventId}`);
				expect(query).toContain(`country_code=eq.${encodeURIComponent(countryCode)}`);
				expect(query).toContain(`phone=eq.${phone}`);
			},
		);
	});
});
