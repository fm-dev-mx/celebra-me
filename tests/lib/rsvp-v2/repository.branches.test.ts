import { appendGuestAuditPublic } from '@/lib/rsvp/repositories/audit.repository';
import {
	findEventByIdService,
	findEventBySlugService,
	findEventByInvitationPublic,
	listAllEventsService,
} from '@/lib/rsvp/repositories/event.repository';
import {
	findMembershipByEventForHost,
	listMembershipsForHost,
} from '@/lib/rsvp/repositories/role-membership.repository';
import { incrementClaimCodeUsageService } from '@/lib/rsvp/repositories/claim-code.repository';
import {
	createGuestInvitation,
	findGuestById,
	findGuestsByEvent,
	updateGuestById,
	updateGuestByInviteIdPublic,
} from '@/lib/rsvp/repositories/guest.repository';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

const supabaseRestRequestMock = supabaseRestRequest as jest.MockedFunction<
	typeof supabaseRestRequest
>;

describe('rsvp repository branches', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('findGuestsByEvent builds filtered queries and maps rows', async () => {
		supabaseRestRequestMock.mockResolvedValue([
			{
				id: 'g1',
				invite_id: 'i1',
				event_id: 'e1',
				full_name: 'Name',
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
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			},
		] as never);

		const result = await findGuestsByEvent(
			{
				eventId: 'e1',
				status: 'confirmed',
				search: 'Na',
			},
			'token',
		);
		expect(result).toHaveLength(1);
		expect(supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery).toContain(
			'attendance_status=eq.confirmed',
		);
		expect(supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);
	});

	it('throws when create/update/public update/audit responses are empty', async () => {
		supabaseRestRequestMock.mockResolvedValue([] as never);
		await expect(
			createGuestInvitation(
				{
					eventId: 'evt',
					fullName: 'Name',
					phone: '6680000000',
					maxAllowedAttendees: 2,
				},
				'token',
			),
		).rejects.toThrow('Failed to insert into guest_invitations');

		await expect(
			updateGuestById(
				{
					guestId: 'g',
					attendanceStatus: 'pending',
				},
				'token',
			),
		).rejects.toThrow('Failed to update guest_invitations');

		await expect(updateGuestByInviteIdPublic('invite', {})).rejects.toThrow(
			'Failed to update guest_invitations',
		);
		await expect(appendGuestAuditPublic('g', 'viewed', {})).rejects.toThrow(
			'No se pudo registrar auditoría.',
		);
	});

	it('updateGuestById omits phone when input has no phone', async () => {
		supabaseRestRequestMock.mockResolvedValueOnce([
			{
				id: 'g1',
				invite_id: 'i1',
				event_id: 'e1',
				full_name: 'Updated Name',
				phone: '6680000000',
				country_code: null,
				max_allowed_attendees: 2,
				attendance_status: 'confirmed',
				attendee_count: 2,
				guest_comment: '',
				delivery_status: 'shared',
				first_viewed_at: null,
				last_viewed_at: null,
				view_percentage: 0,
				is_viewed: false,
				responded_at: null,
				last_response_source: 'admin',
				entry_source: 'dashboard',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				tags: [],
			},
		] as never);
		await updateGuestById({ guestId: 'g1', fullName: 'Updated Name' }, 'token');
		const body = supabaseRestRequestMock.mock.calls[0]?.[0]?.body as Record<string, unknown>;
		expect(body).not.toHaveProperty('phone');
		expect(body).not.toHaveProperty('country_code');
		expect(body).toHaveProperty('full_name', 'Updated Name');
	});

	it('returns null for service lookups when no rows', async () => {
		supabaseRestRequestMock.mockResolvedValue([] as never);
		expect(await findEventByIdService('evt')).toBeNull();
		expect(await findEventBySlugService('slug')).toBeNull();
		expect(await findEventByInvitationPublic('evt')).toBeNull();
		expect(await listAllEventsService()).toEqual([]);
		expect(await findGuestById('guest')).toBeNull();
		expect(await findMembershipByEventForHost('evt', 'token')).toBeNull();
		expect(await listMembershipsForHost('token')).toEqual([]);
		expect(supabaseRestRequestMock.mock.calls[0]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);
		expect(supabaseRestRequestMock.mock.calls[1]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);
		expect(supabaseRestRequestMock.mock.calls[2]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);
		expect(supabaseRestRequestMock.mock.calls[3]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);
		expect(supabaseRestRequestMock.mock.calls[5]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);
		expect(supabaseRestRequestMock.mock.calls[6]?.[0]?.pathWithQuery).toContain(
			'deleted_at=is.null',
		);
	});

	it('increments claim usage with provided count', async () => {
		supabaseRestRequestMock.mockResolvedValue([] as never);
		await incrementClaimCodeUsageService('claim-1', 5);
		expect(supabaseRestRequestMock).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'PATCH',
				body: expect.objectContaining({
					used_count: 5,
				}),
			}),
		);
	});
});
