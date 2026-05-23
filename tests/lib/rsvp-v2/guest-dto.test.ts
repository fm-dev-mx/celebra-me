import { toGuestDto } from '@/lib/rsvp/services/shared/guest-dto';
import type { GuestInvitationRecord } from '@/interfaces/rsvp/domain.interface';

function makeGuestRecord(overrides: Partial<GuestInvitationRecord> = {}): GuestInvitationRecord {
	return {
		id: 'guest-1',
		inviteId: 'invite-1',
		eventId: 'evt-1',
		fullName: 'Test Guest',
		phone: '6680000000',
		countryCode: '+52',
		maxAllowedAttendees: 4,
		attendanceStatus: 'pending',
		attendeeCount: 0,
		guestComment: '',
		deliveryStatus: 'generated',
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
	};
}

describe('toGuestDto', () => {
	it.each(['+1', '+52', '+34'])('preserves countryCode when %s', (code) => {
		const guest = makeGuestRecord({ countryCode: code });
		const dto = toGuestDto(guest, 'http://localhost');
		expect(dto.countryCode).toBe(code);
	});

	it('omits countryCode when source record has none', () => {
		const guest = makeGuestRecord({ countryCode: undefined });
		const dto = toGuestDto(guest, 'http://localhost');
		expect(dto.countryCode).toBeUndefined();
	});
});
