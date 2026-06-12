import { submitGuestRsvpByInviteId } from '@/lib/rsvp/services/rsvp-submission.service';
import {
	findGuestByInviteIdPublic,
	updateGuestByInviteIdPublic,
} from '@/lib/rsvp/repositories/guest.repository';
import type { GuestInvitationRecord } from '@/interfaces/rsvp/domain.interface';

jest.mock('@/lib/rsvp/repositories/guest.repository');

const findGuestByInviteIdPublicMock = findGuestByInviteIdPublic as jest.MockedFunction<
	typeof findGuestByInviteIdPublic
>;
const updateGuestByInviteIdPublicMock = updateGuestByInviteIdPublic as jest.MockedFunction<
	typeof updateGuestByInviteIdPublic
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
		updateGuestByInviteIdPublicMock.mockResolvedValue(
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
	});

	describe('message preservation', () => {
		it('keeps existing message when new payload has blank guestComment', async () => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ guestComment: 'Anterior mensaje' }),
			);
			updateGuestByInviteIdPublicMock.mockResolvedValue(
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

			const updateArg = updateGuestByInviteIdPublicMock.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			expect(updateArg.guest_comment).toBe('Anterior mensaje');
		});

		it('keeps existing message when new payload has whitespace-only guestComment', async () => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ guestComment: 'Anterior mensaje' }),
			);
			updateGuestByInviteIdPublicMock.mockResolvedValue(
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

			const updateArg = updateGuestByInviteIdPublicMock.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			expect(updateArg.guest_comment).toBe('Anterior mensaje');
		});

		it('appends new message to existing guestComment', async () => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ guestComment: 'Anterior mensaje' }),
			);
			updateGuestByInviteIdPublicMock.mockResolvedValue(
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

			const updateArg = updateGuestByInviteIdPublicMock.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const comment = updateArg.guest_comment as string;
			expect(comment).toContain('Anterior mensaje');
			expect(comment).toContain('Nuevo mensaje');
		});
	});
});
