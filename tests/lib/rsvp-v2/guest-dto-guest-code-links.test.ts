import type { GuestInvitationRecord } from '@/interfaces/rsvp/domain.interface';
import { toGuestDto } from '@/lib/rsvp/services/shared/guest-dto';

const guest = {
	id: 'guest-1',
	inviteId: 'invite-1',
	eventId: 'event-1',
	fullName: 'Francisco Prueba',
	phone: '6691234567',
	countryCode: '52',
	maxAllowedAttendees: 2,
	attendanceStatus: 'pending',
	attendeeCount: 0,
	guestComment: '',
	deliveryStatus: 'generated',
	firstSharedAt: null,
	firstViewedAt: null,
	viewPercentage: 0,
	isViewed: false,
	respondedAt: null,
	lastResponseSource: 'link',
	createdAt: '2026-10-20T00:00:00Z',
	updatedAt: '2026-10-20T00:00:00Z',
	tags: [],
	shortId: 'B5NBO65L',
	guestCode: 'k7q2',
} as unknown as GuestInvitationRecord;

function linkFor(eventSlug: string, guestCodeLinks: boolean | undefined) {
	const dto = toGuestDto(guest, {
		origin: 'https://www.celebra-me.com',
		eventTitle: 'Evento',
		eventType: 'xv',
		eventSlug,
		guestCodeLinks,
	});
	return { dto, message: decodeURIComponent(dto.waShareUrl) };
}

describe('guest link form per invitation', () => {
	it.each(['america', 'olivia-y-antonio', 'invitacion-nueva'])(
		'%s shares /{slug}/{guestCode}',
		(slug) => {
			const { dto, message } = linkFor(slug, true);
			expect(dto.guestCode).toBe('k7q2');
			expect(message).toContain(`https://www.celebra-me.com/${slug}/k7q2`);
			expect(message).not.toContain('/i/B5NBO65L');
		},
	);

	it.each([false, undefined])('a past invitation keeps /i/{shortId} (flag %s)', (flag) => {
		const { dto, message } = linkFor('victoria-y-roberto', flag);
		expect(dto.guestCode).toBeUndefined();
		expect(message).toContain('https://www.celebra-me.com/i/B5NBO65L');
		expect(message).not.toContain('/victoria-y-roberto/k7q2');
	});
});
