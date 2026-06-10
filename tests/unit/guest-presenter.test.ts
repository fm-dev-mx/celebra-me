import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { makeGuest } from '@tests/helpers/guest-factory';
import {
	formatGuestDate,
	formatGuestEntrySource,
	getGuestVisibleTags,
	getCompactGroupChips,
	computeGroupMetrics,
	getPrimaryStatus,
	getContactDisplay,
	hasContact,
	hasMessage,
	getDeliveryStateLabel,
	getRsvpStateLabel,
	getViewStateLabel,
	getGuestInviteUrl,
	getShareCtaLabel,
	hasBeenShared,
	normalizeViewPercentage,
} from '@/components/dashboard/guests/guest-presenter';
import type { GroupMetric } from '@/components/dashboard/guests/guest-presenter';

type PrimaryStatusCase = readonly [
	overrides: Partial<DashboardGuestItem>,
	expectedLabel: string,
	expectedClass: string,
];

const primaryStatusCases = [
	[{ attendanceStatus: 'confirmed' }, 'Confirmada', 'confirmed'],
	[{ attendanceStatus: 'declined' }, 'No asiste', 'declined'],
	[{ deliveryStatus: 'generated' }, 'Por enviar', 'unshared'],
	[{ deliveryStatus: 'shared', isViewed: false }, 'Enviada', 'sent'],
	[
		{ deliveryStatus: 'shared', isViewed: true, attendanceStatus: 'pending' },
		'Recibida',
		'pending',
	],
	[{ attendanceStatus: 'confirmed', deliveryStatus: 'generated' }, 'Confirmada', 'confirmed'],
	[
		{ attendanceStatus: 'declined', deliveryStatus: 'shared', isViewed: true },
		'No asiste',
		'declined',
	],
] satisfies readonly PrimaryStatusCase[];

describe.each(primaryStatusCases)('getPrimaryStatus', (overrides, expectedLabel, expectedClass) => {
	it(`returns label="${expectedLabel}" class="${expectedClass}"`, () => {
		const status = getPrimaryStatus(makeGuest(overrides));
		expect(status.label).toBe(expectedLabel);
		expect(status.class).toBe(expectedClass);
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
		expect(getContactDisplay(makeGuest({ phone: '', email: null }))).toBe(
			'Sin teléfono registrado',
		);
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

	it('returns "Por enviar" when not shared', () => {
		expect(getDeliveryStateLabel(makeGuest({ deliveryStatus: 'generated' }))).toBe(
			'Por enviar',
		);
	});
});

describe('getRsvpStateLabel', () => {
	it('returns "Confirmada" for confirmed', () => {
		expect(getRsvpStateLabel(makeGuest({ attendanceStatus: 'confirmed' }))).toBe('Confirmada');
	});

	it('returns "No asiste" for declined', () => {
		expect(getRsvpStateLabel(makeGuest({ attendanceStatus: 'declined' }))).toBe('No asiste');
	});

	it('returns "Sin respuesta" for pending', () => {
		expect(getRsvpStateLabel(makeGuest({ attendanceStatus: 'pending' }))).toBe('Sin respuesta');
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

describe('normalizeViewPercentage', () => {
	it('returns the value as-is for a normal value', () => {
		expect(normalizeViewPercentage(42)).toBe(42);
	});

	it('clamps values above 100 to 100', () => {
		expect(normalizeViewPercentage(150)).toBe(100);
	});

	it('clamps values below 0 to 0', () => {
		expect(normalizeViewPercentage(-10)).toBe(0);
	});

	it('returns 0 for NaN', () => {
		expect(normalizeViewPercentage(NaN)).toBe(0);
	});

	it('returns 0 for Infinity', () => {
		expect(normalizeViewPercentage(Infinity)).toBe(0);
	});

	it('rounds float values', () => {
		expect(normalizeViewPercentage(42.7)).toBe(43);
	});

	it('rounds float values near 0', () => {
		expect(normalizeViewPercentage(0.4)).toBe(0);
	});

	it('rounds float values near 100', () => {
		expect(normalizeViewPercentage(99.5)).toBe(100);
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

	it('returns the raw value when date parsing fails', () => {
		expect(formatGuestDate('not-a-date')).toBe('not-a-date');
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

	it('handles null tags', () => {
		expect(getGuestVisibleTags(makeGuest({ tags: null as unknown as string[] }))).toEqual([]);
	});
});

describe('getCompactGroupChips', () => {
	it('returns chips and overflow for up to max tags', () => {
		const result = getCompactGroupChips(makeGuest({ tags: ['Familia', 'Amigos', 'VIP'] }), 2);
		expect(result.chips).toEqual(['Familia', 'Amigos']);
		expect(result.overflow).toBe(1);
	});

	it('returns no overflow when at or under max', () => {
		const result = getCompactGroupChips(makeGuest({ tags: ['VIP'] }), 2);
		expect(result.chips).toEqual(['VIP']);
		expect(result.overflow).toBe(0);
	});

	it('excludes system tags from compact chips', () => {
		const result = getCompactGroupChips(makeGuest({ tags: ['system:public', 'Familia'] }), 2);
		expect(result.chips).toEqual(['Familia']);
	});

	it('returns empty when no visible tags', () => {
		const result = getCompactGroupChips(makeGuest({ tags: [] }), 2);
		expect(result.chips).toEqual([]);
		expect(result.overflow).toBe(0);
	});
});

describe('computeGroupMetrics', () => {
	it('computes total and pending per group', () => {
		const items = [
			makeGuest({ tags: ['Familia'], attendanceStatus: 'pending' }),
			makeGuest({ tags: ['Familia'], attendanceStatus: 'confirmed' }),
			makeGuest({ tags: ['VIP'], attendanceStatus: 'pending' }),
		];
		const metrics = computeGroupMetrics(items);
		const familia: GroupMetric | undefined = metrics.find(
			(m: GroupMetric) => m.tag === 'Familia',
		);
		expect(familia).toBeDefined();
		expect(familia!.total).toBe(2);
		expect(familia!.pending).toBe(1);
		const vip: GroupMetric | undefined = metrics.find((m: GroupMetric) => m.tag === 'VIP');
		expect(vip).toBeDefined();
		expect(vip!.total).toBe(1);
		expect(vip!.pending).toBe(1);
	});

	it('groups guests with no visible tags under "Sin grupo"', () => {
		const items = [makeGuest({ tags: [] }), makeGuest({ tags: ['system:public'] })];
		const metrics = computeGroupMetrics(items);
		const sinGrupo: GroupMetric | undefined = metrics.find(
			(m: GroupMetric) => m.tag === 'Sin grupo',
		);
		expect(sinGrupo).toBeDefined();
		expect(sinGrupo!.total).toBe(2);
	});

	it('returns empty array for empty guest list', () => {
		expect(computeGroupMetrics([])).toEqual([]);
	});

	it('sorts by total descending', () => {
		const items = [
			makeGuest({ tags: ['VIP'] }),
			makeGuest({ tags: ['VIP'] }),
			makeGuest({ tags: ['VIP'] }),
			makeGuest({ tags: ['Amigos'] }),
			makeGuest({ tags: ['Amigos'] }),
			makeGuest({ tags: ['Familia'] }),
		];
		const metrics = computeGroupMetrics(items);
		expect(metrics[0].tag).toBe('VIP');
		expect(metrics[1].tag).toBe('Amigos');
		expect(metrics[2].tag).toBe('Familia');
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

describe('hasBeenShared', () => {
	it('returns true when firstSharedAt is set', () => {
		expect(hasBeenShared(makeGuest({ firstSharedAt: '2026-01-15T10:00:00.000Z' }))).toBe(true);
	});

	it('returns true when deliveryStatus is shared even without firstSharedAt', () => {
		expect(hasBeenShared(makeGuest({ deliveryStatus: 'shared', firstSharedAt: null }))).toBe(
			true,
		);
	});

	it('returns false when deliveryStatus is generated and firstSharedAt is null', () => {
		expect(hasBeenShared(makeGuest({ deliveryStatus: 'generated', firstSharedAt: null }))).toBe(
			false,
		);
	});
});

describe('getShareCtaLabel', () => {
	it('never shared → "Compartir invitación" + invitation', () => {
		const result = getShareCtaLabel(
			makeGuest({ deliveryStatus: 'generated', firstSharedAt: null }),
		);
		expect(result.label).toBe('Compartir invitación');
		expect(result.defaultMessageType).toBe('invitation');
	});

	it('previously shared (firstSharedAt set) → "Enviar recordatorio" + reminder', () => {
		const result = getShareCtaLabel(
			makeGuest({
				deliveryStatus: 'shared',
				firstSharedAt: '2026-01-15T10:00:00.000Z',
				isViewed: false,
			}),
		);
		expect(result.label).toBe('Enviar recordatorio');
		expect(result.defaultMessageType).toBe('reminder');
	});

	it('already shared and viewed → "Enviar recordatorio" + reminder', () => {
		const result = getShareCtaLabel(
			makeGuest({
				deliveryStatus: 'shared',
				firstSharedAt: '2026-01-15T10:00:00.000Z',
				isViewed: true,
				attendanceStatus: 'pending',
			}),
		);
		expect(result.label).toBe('Enviar recordatorio');
		expect(result.defaultMessageType).toBe('reminder');
	});

	it('confirmed guest → "Enviar recordatorio" + reminder', () => {
		const result = getShareCtaLabel(
			makeGuest({ attendanceStatus: 'confirmed', firstSharedAt: '2026-01-15T10:00:00.000Z' }),
		);
		expect(result.label).toBe('Enviar recordatorio');
		expect(result.defaultMessageType).toBe('reminder');
	});

	it('declined guest → "Enviar recordatorio" + reminder', () => {
		const result = getShareCtaLabel(
			makeGuest({ attendanceStatus: 'declined', firstSharedAt: '2026-01-15T10:00:00.000Z' }),
		);
		expect(result.label).toBe('Enviar recordatorio');
		expect(result.defaultMessageType).toBe('reminder');
	});

	it('defensive: deliveryStatus "shared" without firstSharedAt → "Enviar recordatorio" + reminder', () => {
		const result = getShareCtaLabel(
			makeGuest({ deliveryStatus: 'shared', firstSharedAt: null }),
		);
		expect(result.label).toBe('Enviar recordatorio');
		expect(result.defaultMessageType).toBe('reminder');
	});

	it('defensive: deliveryStatus "generated" without firstSharedAt → "Compartir invitación" + invitation', () => {
		const result = getShareCtaLabel(
			makeGuest({ deliveryStatus: 'generated', firstSharedAt: null }),
		);
		expect(result.label).toBe('Compartir invitación');
		expect(result.defaultMessageType).toBe('invitation');
	});
});
