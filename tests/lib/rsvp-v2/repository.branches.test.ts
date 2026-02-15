import {
	appendGuestAuditPublic,
	createGuestInvitation,
	findEventByIdService,
	findEventBySlugService,
	findGuestByIdService,
	findGuestsByEvent,
	findMembershipByEventForHost,
	incrementClaimCodeUsageService,
	updateGuestById,
	updateGuestByInviteIdPublic,
} from '@/lib/rsvp-v2/repository';
import { supabaseRestRequest } from '@/lib/rsvp-v2/supabase';

jest.mock('@/lib/rsvp-v2/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

const supabaseRestRequestMock = supabaseRestRequest as jest.MockedFunction<
	typeof supabaseRestRequest
>;

describe('rsvp-v2 repository branches', () => {
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
				phone_e164: '+521',
				max_allowed_attendees: 2,
				attendance_status: 'pending',
				attendee_count: 0,
				guest_message: '',
				delivery_status: 'generated',
				first_viewed_at: null,
				last_viewed_at: null,
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
	});

	it('throws when create/update/public update/audit responses are empty', async () => {
		supabaseRestRequestMock.mockResolvedValue([] as never);
		await expect(
			createGuestInvitation(
				{
					eventId: 'evt',
					fullName: 'Name',
					phoneE164: '+521',
					maxAllowedAttendees: 2,
				},
				'token',
			),
		).rejects.toThrow('No se pudo crear invitado.');

		await expect(
			updateGuestById(
				{
					guestId: 'g',
					attendanceStatus: 'pending',
				},
				'token',
			),
		).rejects.toThrow('Invitado no encontrado o sin permisos.');

		await expect(updateGuestByInviteIdPublic('invite', {})).rejects.toThrow(
			'Invitación no encontrada.',
		);
		await expect(appendGuestAuditPublic('g', 'viewed', {})).rejects.toThrow(
			'No se pudo registrar auditoria.',
		);
	});

	it('returns null for service lookups when no rows', async () => {
		supabaseRestRequestMock.mockResolvedValue([] as never);
		expect(await findEventByIdService('evt')).toBeNull();
		expect(await findEventBySlugService('slug')).toBeNull();
		expect(await findGuestByIdService('guest')).toBeNull();
		expect(await findMembershipByEventForHost('evt', 'token')).toBeNull();
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
