import { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import { findEventByInvitationPublic } from '@/lib/rsvp/repositories/event.repository';
import { findGuestByInviteIdPublic } from '@/lib/rsvp/repositories/guest.repository';
import {
	PERSONALIZED_GUEST_CONTEXT_READS_ON_HIT,
	PERSONALIZED_GUEST_CONTEXT_READS_ON_MISS,
	assertObservedOperationCount,
} from '@/lib/invitation/delivery-contract';
import type { EventRecord, GuestInvitationRecord } from '@/interfaces/rsvp/domain.interface';
import { ApiError } from '@/lib/rsvp/core/errors';

jest.mock('@/lib/rsvp/repositories/event.repository');
jest.mock('@/lib/rsvp/repositories/guest.repository');

const findGuestByInviteIdPublicMock = findGuestByInviteIdPublic as jest.MockedFunction<
	typeof findGuestByInviteIdPublic
>;
const findEventByInvitationPublicMock = findEventByInvitationPublic as jest.MockedFunction<
	typeof findEventByInvitationPublic
>;

function makeGuest(): GuestInvitationRecord {
	return {
		id: 'guest-1',
		inviteId: 'invite-1',
		eventId: 'evt-1',
		fullName: 'Invitada',
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
	} as GuestInvitationRecord;
}

function makeEvent(): EventRecord {
	return {
		id: 'evt-1',
		ownerUserId: 'owner-1',
		slug: 'sample-invitation',
		eventType: 'xv',
		title: 'XV',
		status: 'published',
		publishedAt: new Date().toISOString(),
		invitationId: 'inv-1',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

describe('personalized invitation persistence reads', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('reads guest then event on a context hit', async () => {
		findGuestByInviteIdPublicMock.mockResolvedValue(makeGuest());
		findEventByInvitationPublicMock.mockResolvedValue(makeEvent());

		const context = await getInvitationContextByInviteId('invite-1');

		expect(context.inviteId).toBe('invite-1');
		assertObservedOperationCount(
			findGuestByInviteIdPublicMock.mock.calls.length +
				findEventByInvitationPublicMock.mock.calls.length,
			PERSONALIZED_GUEST_CONTEXT_READS_ON_HIT,
			'personalized-hit-persistence',
		);
	});

	it('stops after the guest lookup on a miss and does not read the event', async () => {
		findGuestByInviteIdPublicMock.mockResolvedValue(null);

		await expect(getInvitationContextByInviteId('missing')).rejects.toBeInstanceOf(ApiError);
		assertObservedOperationCount(
			findGuestByInviteIdPublicMock.mock.calls.length,
			PERSONALIZED_GUEST_CONTEXT_READS_ON_MISS,
			'personalized-miss-guest',
		);
		expect(findEventByInvitationPublicMock).not.toHaveBeenCalled();
	});
});
