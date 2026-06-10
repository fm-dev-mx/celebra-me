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
		const dto = toGuestDto(guest, { origin: 'http://localhost' });
		expect(dto.countryCode).toBe(code);
	});

	it('omits countryCode when source record has none', () => {
		const guest = makeGuestRecord({ countryCode: undefined });
		const dto = toGuestDto(guest, { origin: 'http://localhost' });
		expect(dto.countryCode).toBeUndefined();
	});

	it('uses shareMessages.invitation for waShareUrl and shareText', () => {
		const guest = makeGuestRecord();
		const shareMessages = {
			invitation: 'Custom: {guestName} → {inviteUrl}',
			reminder: 'Reminder: {guestName} → {inviteUrl}',
		};
		const dto = toGuestDto(guest, {
			origin: 'http://localhost',
			eventTitle: 'Test Event',
			eventType: 'xv',
			eventSlug: 'test-slug',
			shareMessages,
		});
		const decodedWa = decodeURIComponent(dto.waShareUrl.split('?text=')[1]);
		expect(decodedWa).toContain('Custom: Test Guest');
		expect(dto.shareText).toContain('Custom:');
	});

	it('uses default invitation message when no shareMessages provided', () => {
		const guest = makeGuestRecord();
		const dto = toGuestDto(guest, {
			origin: 'http://localhost',
			eventTitle: 'Test Event',
			eventType: 'xv',
			eventSlug: 'test-slug',
		});
		const decodedWa = decodeURIComponent(dto.waShareUrl.split('?text=')[1]);
		expect(decodedWa).toContain('Hola Test Guest');
		expect(decodedWa).toContain('Test Event');
	});

	it('no-phone guest gets empty waShareUrl', () => {
		const guest = makeGuestRecord({ phone: '' });
		const dto = toGuestDto(guest, { origin: 'http://localhost', eventTitle: 'Test Event' });
		expect(dto.waShareUrl).toBe('');
	});

	it('no-phone guest shareText contains event title for native share', () => {
		const guest = makeGuestRecord({ phone: '' });
		const dto = toGuestDto(guest, {
			origin: 'http://localhost',
			eventTitle: 'Test Event',
			eventType: 'xv',
			eventSlug: 'test-slug',
		});
		expect(dto.shareText).toContain('Test Event');
	});

	it('uses invitation template by default for both waShareUrl and shareText', () => {
		const guest = makeGuestRecord({ phone: '' });
		const shareMessages = {
			invitation: 'Invitation: {guestName} → {inviteUrl}',
			reminder: 'Reminder: {guestName} → {inviteUrl}',
		};
		const dto = toGuestDto(guest, {
			origin: 'http://localhost',
			eventTitle: 'Mi Evento',
			eventType: 'xv',
			eventSlug: 'test-slug',
			shareMessages,
		});
		expect(dto.shareText).toContain('Invitation:');
		expect(dto.shareText).not.toContain('Reminder:');
	});
});
