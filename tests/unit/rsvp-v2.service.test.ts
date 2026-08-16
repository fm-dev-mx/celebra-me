import { submitGuestRsvpByInviteId } from '@/lib/rsvp/services/rsvp-submission.service';
import {
	findGuestByInviteIdPublic,
	submitGuestRsvpPublicRpc,
} from '@/lib/rsvp/repositories/guest.repository';
import {
	RSVP_SUBMIT_BY_INVITE_MUTATION_RPCS,
	RSVP_SUBMIT_BY_INVITE_SERVICE_LOOKUPS,
} from '@/lib/rsvp/rsvp-operation-contract';
import { assertObservedOperationCount } from '@/lib/invitation/delivery-contract';
import type { GuestInvitationRecord } from '@/interfaces/rsvp/domain.interface';

jest.mock('@/lib/rsvp/repositories/guest.repository');

const findGuestByInviteIdPublicMock = findGuestByInviteIdPublic as jest.MockedFunction<
	typeof findGuestByInviteIdPublic
>;
const submitGuestRsvpPublicRpcMock = submitGuestRsvpPublicRpc as jest.MockedFunction<
	typeof submitGuestRsvpPublicRpc
>;

function makeGuestRecord(overrides: Partial<GuestInvitationRecord> = {}): GuestInvitationRecord {
	return {
		id: 'guest-1',
		inviteId: 'invite-1',
		eventId: 'evt-1',
		fullName: 'Invitado',
		phone: '6680000000',
		maxAllowedAttendees: 4,
		attendanceStatus: 'pending',
		attendeeCount: 0,
		guestComment: '',
		deliveryStatus: 'generated',
		firstSharedAt: null,
		viewPercentage: 0,
		isViewed: false,
		firstViewedAt: null,
		lastViewedAt: null,
		respondedAt: null,
		lastResponseSource: 'link',
		entrySource: 'dashboard',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	} as GuestInvitationRecord;
}

describe('rsvp service unit', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('persists declined RSVP with attendee_count forced to 0', async () => {
		findGuestByInviteIdPublicMock.mockResolvedValue(makeGuestRecord());
		submitGuestRsvpPublicRpcMock.mockResolvedValue(
			makeGuestRecord({
				attendanceStatus: 'declined',
				attendeeCount: 0,
				guestComment: 'No podre asistir',
				respondedAt: new Date().toISOString(),
				lastResponseSource: 'link',
			}),
		);

		const result = await submitGuestRsvpByInviteId('invite-1', {
			attendanceStatus: 'declined',
			attendeeCount: 3,
			guestComment: 'No podre asistir',
		});

		expect(result.attendanceStatus).toBe('declined');
		expect(result.attendeeCount).toBe(0);
		assertObservedOperationCount(
			findGuestByInviteIdPublicMock.mock.calls.length,
			RSVP_SUBMIT_BY_INVITE_SERVICE_LOOKUPS,
			'rsvp-lookup',
		);
		assertObservedOperationCount(
			submitGuestRsvpPublicRpcMock.mock.calls.length,
			RSVP_SUBMIT_BY_INVITE_MUTATION_RPCS,
			'rsvp-rpc',
		);
	});

	describe('message preservation', () => {
		it('keeps existing message when new payload has blank guestComment', async () => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ guestComment: 'Anterior mensaje' }),
			);
			submitGuestRsvpPublicRpcMock.mockResolvedValue(
				makeGuestRecord({
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: 'Anterior mensaje',
					respondedAt: new Date().toISOString(),
					lastResponseSource: 'link',
				}),
			);

			await submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				guestComment: '',
			});

			expect(submitGuestRsvpPublicRpcMock).toHaveBeenCalledWith(
				expect.objectContaining({
					inviteId: 'invite-1',
					guestComment: null,
				}),
			);
		});

		it('keeps existing message when new payload has whitespace-only guestComment', async () => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ guestComment: 'Anterior mensaje' }),
			);
			submitGuestRsvpPublicRpcMock.mockResolvedValue(
				makeGuestRecord({
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: 'Anterior mensaje',
					respondedAt: new Date().toISOString(),
					lastResponseSource: 'link',
				}),
			);

			await submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				guestComment: '   ',
			});

			expect(submitGuestRsvpPublicRpcMock).toHaveBeenCalledWith(
				expect.objectContaining({
					inviteId: 'invite-1',
					guestComment: null,
				}),
			);
		});

		it('passes absolute appended comment for RPC SET ownership', async () => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ guestComment: 'Anterior mensaje' }),
			);
			submitGuestRsvpPublicRpcMock.mockResolvedValue(
				makeGuestRecord({
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					respondedAt: new Date().toISOString(),
					lastResponseSource: 'link',
				}),
			);

			await submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				guestComment: 'Nuevo mensaje',
			});

			const call = submitGuestRsvpPublicRpcMock.mock.calls[0][0];
			expect(call.inviteId).toBe('invite-1');
			expect(call.guestComment).toContain('Anterior mensaje');
			expect(call.guestComment).toContain('Nuevo mensaje');
		});
	});
});
