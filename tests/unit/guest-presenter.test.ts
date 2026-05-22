import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	formatGuestDate,
	formatGuestEntrySource,
	getGuestVisibleTags,
	getPrimaryStatusLabel,
	getPrimaryStatusClass,
	getContactDisplay,
	hasContact,
	hasMessage,
	getDeliveryStateLabel,
	getRsvpStateLabel,
	getViewStateLabel,
	getGuestInviteUrl,
} from '@/components/dashboard/guests/guest-presenter';

function makeGuest(overrides: Partial<DashboardGuestItem> = {}): DashboardGuestItem {
	return {
		guestId: 'guest-1',
		inviteId: 'invite-1',
		fullName: 'Test Guest',
		phone: '5551234567',
		email: null,
		tags: [],
		metadata: {},
		maxAllowedAttendees: 4,
		attendanceStatus: 'pending',
		attendeeCount: 0,
		guestComment: '',
		deliveryStatus: 'generated',
		entrySource: undefined,
		viewPercentage: 0,
		isViewed: false,
		firstViewedAt: null,
		respondedAt: null,
		waShareUrl: 'https://wa.me/123',
		shareText: 'Share text',
		updatedAt: '2026-03-22T00:00:00.000Z',
		...overrides,
	};
}

describe('getPrimaryStatusLabel', () => {
	it('returns "Aceptada" for confirmed guest', () => {
		const guest = makeGuest({ attendanceStatus: 'confirmed' });
		expect(getPrimaryStatusLabel(guest)).toBe('Aceptada');
	});

	it('returns "Denegada" for declined guest', () => {
		const guest = makeGuest({ attendanceStatus: 'declined' });
		expect(getPrimaryStatusLabel(guest)).toBe('Denegada');
	});

	it('returns "Por enviar" for generated/unshared guest', () => {
		const guest = makeGuest({ deliveryStatus: 'generated' });
		expect(getPrimaryStatusLabel(guest)).toBe('Por enviar');
	});

	it('returns "Enviada" for shared but not viewed guest', () => {
		const guest = makeGuest({ deliveryStatus: 'shared', isViewed: false });
		expect(getPrimaryStatusLabel(guest)).toBe('Enviada');
	});

	it('returns "Pendiente" for shared, viewed, pending RSVP guest', () => {
		const guest = makeGuest({
			deliveryStatus: 'shared',
			isViewed: true,
			attendanceStatus: 'pending',
		});
		expect(getPrimaryStatusLabel(guest)).toBe('Pendiente');
	});

	it('prioritises confirmed over delivery status', () => {
		const guest = makeGuest({
			attendanceStatus: 'confirmed',
			deliveryStatus: 'generated',
		});
		expect(getPrimaryStatusLabel(guest)).toBe('Aceptada');
	});

	it('prioritises declined over delivery status', () => {
		const guest = makeGuest({
			attendanceStatus: 'declined',
			deliveryStatus: 'shared',
			isViewed: true,
		});
		expect(getPrimaryStatusLabel(guest)).toBe('Denegada');
	});
});

describe('getPrimaryStatusClass', () => {
	it('returns "confirmed" for confirmed guest', () => {
		expect(getPrimaryStatusClass(makeGuest({ attendanceStatus: 'confirmed' }))).toBe(
			'confirmed',
		);
	});

	it('returns "declined" for declined guest', () => {
		expect(getPrimaryStatusClass(makeGuest({ attendanceStatus: 'declined' }))).toBe('declined');
	});

	it('returns "unshared" for generated guest', () => {
		expect(getPrimaryStatusClass(makeGuest({ deliveryStatus: 'generated' }))).toBe('unshared');
	});

	it('returns "sent" for shared but not viewed guest', () => {
		expect(
			getPrimaryStatusClass(makeGuest({ deliveryStatus: 'shared', isViewed: false })),
		).toBe('sent');
	});

	it('returns "pending" for shared, viewed, pending RSVP guest', () => {
		expect(
			getPrimaryStatusClass(
				makeGuest({
					deliveryStatus: 'shared',
					isViewed: true,
					attendanceStatus: 'pending',
				}),
			),
		).toBe('pending');
	});
});

describe('getContactDisplay', () => {
	it('returns phone when available', () => {
		expect(getContactDisplay(makeGuest({ phone: '5559876543' }))).toBe('5559876543');
	});

	it('returns email when phone is empty and email exists', () => {
		expect(getContactDisplay(makeGuest({ phone: '', email: 'test@example.com' }))).toBe(
			'test@example.com',
		);
	});

	it('returns fallback when neither phone nor email exists', () => {
		expect(getContactDisplay(makeGuest({ phone: '', email: null }))).toBe('Sin contacto');
	});
});

describe('hasContact', () => {
	it('returns true when phone exists', () => {
		expect(hasContact(makeGuest({ phone: '555000' }))).toBe(true);
	});

	it('returns true when email exists', () => {
		expect(hasContact(makeGuest({ phone: '', email: 'a@b.com' }))).toBe(true);
	});

	it('returns false when neither exists', () => {
		expect(hasContact(makeGuest({ phone: '', email: null }))).toBe(false);
	});
});

describe('hasMessage', () => {
	it('returns true when guestComment is non-empty', () => {
		expect(hasMessage(makeGuest({ guestComment: 'Looking forward!' }))).toBe(true);
	});

	it('returns false when guestComment is empty', () => {
		expect(hasMessage(makeGuest({ guestComment: '' }))).toBe(false);
	});

	it('returns false when guestComment is whitespace only', () => {
		expect(hasMessage(makeGuest({ guestComment: '   ' }))).toBe(false);
	});
});

describe('getDeliveryStateLabel', () => {
	it('returns "Enviado" when shared', () => {
		expect(getDeliveryStateLabel(makeGuest({ deliveryStatus: 'shared' }))).toBe('Enviado');
	});

	it('returns "No enviado" when not shared', () => {
		expect(getDeliveryStateLabel(makeGuest({ deliveryStatus: 'generated' }))).toBe(
			'No enviado',
		);
	});
});

describe('getRsvpStateLabel', () => {
	it('returns "Aceptada" for confirmed', () => {
		expect(getRsvpStateLabel(makeGuest({ attendanceStatus: 'confirmed' }))).toBe('Aceptada');
	});

	it('returns "Denegada" for declined', () => {
		expect(getRsvpStateLabel(makeGuest({ attendanceStatus: 'declined' }))).toBe('Denegada');
	});

	it('returns "Pendiente" for pending', () => {
		expect(getRsvpStateLabel(makeGuest({ attendanceStatus: 'pending' }))).toBe('Pendiente');
	});
});

describe('getViewStateLabel', () => {
	it('returns "Sin ver" when not viewed', () => {
		expect(getViewStateLabel(makeGuest({ isViewed: false }))).toBe('Sin ver');
	});

	it('returns percentage when viewed', () => {
		expect(getViewStateLabel(makeGuest({ isViewed: true, viewPercentage: 75 }))).toBe('75%');
	});
});

describe('formatGuestDate', () => {
	it('returns dash for null value', () => {
		expect(formatGuestDate(null)).toBe('-');
	});

	it('returns dash for empty string', () => {
		expect(formatGuestDate('')).toBe('-');
	});

	it('formats valid ISO date for es-MX locale', () => {
		const result = formatGuestDate('2026-03-22T00:00:00.000Z');
		expect(result).not.toBe('-');
		expect(result).toContain('2026');
	});

	it('returns Invalid Date string when date parsing fails', () => {
		expect(formatGuestDate('not-a-date')).toBe('Invalid Date');
	});
});

describe('formatGuestEntrySource', () => {
	it('returns "RSVP público" for generic_public entrySource', () => {
		expect(formatGuestEntrySource(makeGuest({ entrySource: 'generic_public' }))).toBe(
			'RSVP público',
		);
	});

	it('returns "RSVP público" when tags include system:public', () => {
		expect(formatGuestEntrySource(makeGuest({ tags: ['system:public', 'vip'] }))).toBe(
			'RSVP público',
		);
	});

	it('returns "Invitación personalizada" for non-public entry', () => {
		expect(formatGuestEntrySource(makeGuest({ entrySource: undefined }))).toBe(
			'Invitación personalizada',
		);
	});
});

describe('getGuestVisibleTags', () => {
	it('returns only non-system tags', () => {
		const result = getGuestVisibleTags(
			makeGuest({ tags: ['system:public', 'vip', 'system:imported', 'familia'] }),
		);
		expect(result).toEqual(['vip', 'familia']);
	});

	it('returns empty array when no tags', () => {
		expect(getGuestVisibleTags(makeGuest({ tags: [] }))).toEqual([]);
	});

	it('handles undefined tags', () => {
		expect(getGuestVisibleTags(makeGuest({ tags: undefined as unknown as string[] }))).toEqual(
			[],
		);
	});
});

describe('getGuestInviteUrl', () => {
	it('falls back to invite ID URL when no eventType/slug', () => {
		const guest = makeGuest({ eventType: undefined, eventSlug: undefined });
		const url = getGuestInviteUrl(guest, 'https://example.com/');
		expect(url).toBe('https://example.com/invitacion/invite-1');
	});

	it('strips trailing slash from base URL', () => {
		const guest = makeGuest({ eventType: undefined, eventSlug: undefined });
		const url = getGuestInviteUrl(guest, 'https://example.com');
		expect(url).toBe('https://example.com/invitacion/invite-1');
	});

	it('encodes invite ID in fallback URL', () => {
		const guest = makeGuest({ inviteId: 'invite/id' });
		const url = getGuestInviteUrl(guest, 'https://example.com/');
		expect(url).toBe('https://example.com/invitacion/invite%2Fid');
	});
});
