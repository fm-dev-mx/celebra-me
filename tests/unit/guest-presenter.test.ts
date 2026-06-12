import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { makeGuest } from '@tests/helpers/guest-factory';
import {
	formatGuestEntrySource,
	formatGuestMessageCount,
	formatGuestMetadataRow,
	getCompactGroupChips,
	computeGroupMetrics,
	getPrimaryStatus,
	getDeliveryStateLabel,
	getGuestInviteUrl,
	getShareCtaLabel,
	hasBeenShared,
	normalizeViewPercentage,
	parseGuestCommentHistory,
	getGuestMessageCount,
	getGuestPrimaryAction,
	formatGuestDateShort,
} from '@/components/dashboard/guests/guest-presenter';
import type { GroupMetric } from '@/components/dashboard/guests/guest-presenter';

type PrimaryStatusCase = readonly [
	overrides: Partial<DashboardGuestItem>,
	expectedLabel: string,
	expectedClass: string,
];

const primaryStatusCases = [
	// Terminal RSVP states take priority
	[{ attendanceStatus: 'confirmed' }, 'Confirmada', 'confirmed'],
	[{ attendanceStatus: 'declined' }, 'No asiste', 'declined'],
	[{ attendanceStatus: 'confirmed', deliveryStatus: 'generated' }, 'Confirmada', 'confirmed'],
	[
		{ attendanceStatus: 'confirmed', deliveryStatus: 'shared', isViewed: false },
		'Confirmada',
		'confirmed',
	],
	[
		{ attendanceStatus: 'confirmed', deliveryStatus: 'shared', isViewed: true },
		'Confirmada',
		'confirmed',
	],
	[
		{ attendanceStatus: 'declined', deliveryStatus: 'shared', isViewed: true },
		'No asiste',
		'declined',
	],
	[
		{ attendanceStatus: 'declined', deliveryStatus: 'shared', isViewed: false },
		'No asiste',
		'declined',
	],

	// Not yet sent
	[{ deliveryStatus: 'generated' }, 'Por enviar', 'unshared'],

	// Shared but awaiting confirmation — replaces "Enviada"/"Recibida" for pending guests
	[
		{ deliveryStatus: 'shared', attendanceStatus: 'pending', isViewed: false },
		'Por confirmar',
		'pending-confirmation',
	],
	[
		{ deliveryStatus: 'shared', attendanceStatus: 'pending', isViewed: true },
		'Por confirmar',
		'pending-confirmation',
	],
] satisfies readonly PrimaryStatusCase[];

describe.each(primaryStatusCases)('getPrimaryStatus', (overrides, expectedLabel, expectedClass) => {
	it(`returns label="${expectedLabel}" class="${expectedClass}"`, () => {
		const status = getPrimaryStatus(makeGuest(overrides));
		expect(status.label).toBe(expectedLabel);
		expect(status.class).toBe(expectedClass);
	});
});

describe('formatGuestMessageCount', () => {
	it('returns "1 mensaje" for count 1', () => {
		expect(formatGuestMessageCount(1)).toBe('1 mensaje');
	});

	it('returns "2 mensajes" for count 2', () => {
		expect(formatGuestMessageCount(2)).toBe('2 mensajes');
	});

	it('returns "0 mensajes" for count 0', () => {
		expect(formatGuestMessageCount(0)).toBe('0 mensajes');
	});
});

describe('getGuestMessageCount', () => {
	it('returns 0 for empty string', () => {
		expect(getGuestMessageCount('')).toBe(0);
	});

	it('returns 1 for a single message', () => {
		expect(getGuestMessageCount('Hola')).toBe(1);
	});

	it('returns 2 for cumulative messages', () => {
		expect(getGuestMessageCount('Hola\n\n[12 jun 2026, 10:34] Adios')).toBe(2);
	});
});

describe('formatGuestMetadataRow', () => {
	it('includes index and attendee count', () => {
		const result = formatGuestMetadataRow(1, 2, 4, 0);
		expect(result).toContain('#01');
		expect(result).toContain('2/4 asistentes');
	});

	it('includes message count when count > 0', () => {
		const result = formatGuestMetadataRow(1, 2, 4, 2);
		expect(result).toContain('2 mensajes');
	});

	it('omits message count when count is 0', () => {
		const result = formatGuestMetadataRow(1, 2, 4, 0);
		expect(result).not.toContain('mensaje');
	});
});

describe('getGuestPrimaryAction', () => {
	it('returns share with "Compartir invitación" for generated/pending', () => {
		const result = getGuestPrimaryAction(
			makeGuest({ deliveryStatus: 'generated', attendanceStatus: 'pending' }),
		);
		expect(result.label).toBe('Compartir invitación');
		expect(result.action).toBe('share');
	});

	it('returns share with "Enviar recordatorio" for shared/pending', () => {
		const result = getGuestPrimaryAction(
			makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'pending' }),
		);
		expect(result.label).toBe('Enviar recordatorio');
		expect(result.action).toBe('share');
	});

	it('returns copy-link for confirmed', () => {
		const result = getGuestPrimaryAction(makeGuest({ attendanceStatus: 'confirmed' }));
		expect(result.label).toBe('Copiar enlace');
		expect(result.action).toBe('copy-link');
	});

	it('returns copy-link for declined', () => {
		const result = getGuestPrimaryAction(makeGuest({ attendanceStatus: 'declined' }));
		expect(result.label).toBe('Copiar enlace');
		expect(result.action).toBe('copy-link');
	});
});

describe('parseGuestCommentHistory', () => {
	it('returns empty array for blank input', () => {
		expect(parseGuestCommentHistory('')).toEqual([]);
		expect(parseGuestCommentHistory('   ')).toEqual([]);
	});

	it('handles one legacy plain-text message', () => {
		const result = parseGuestCommentHistory('Sí asistimos, gracias.');
		expect(result).toHaveLength(1);
		expect(result[0].message).toBe('Sí asistimos, gracias.');
		expect(result[0].isInitial).toBe(true);
		expect(result[0].timestampLabel).toBeUndefined();
	});

	it('handles one timestamped message', () => {
		const result = parseGuestCommentHistory('[12 jun 2026, 11:03] Vamos a llegar tarde.');
		expect(result).toHaveLength(1);
		expect(result[0].message).toBe('Vamos a llegar tarde.');
		expect(result[0].timestampLabel).toBe('12 jun 2026, 11:03');
		expect(result[0].isInitial).toBe(false);
	});

	it('handles mixed legacy + timestamped cumulative messages', () => {
		const input = 'Sí asistimos, muchas gracias.\n\n[12 jun 2026, 11:03] Vamos a llegar tarde.';
		const result = parseGuestCommentHistory(input);
		expect(result).toHaveLength(2);
		expect(result[0].message).toBe('Vamos a llegar tarde.');
		expect(result[0].timestampLabel).toBe('12 jun 2026, 11:03');
		expect(result[0].isInitial).toBe(false);
		expect(result[1].message).toBe('Sí asistimos, muchas gracias.');
		expect(result[1].isInitial).toBe(true);
	});

	it('returns newest-first order', () => {
		const input = 'First\n\n[12 jun 2026, 10:00] Second\n\n[12 jun 2026, 11:00] Third';
		const result = parseGuestCommentHistory(input);
		expect(result).toHaveLength(3);
		expect(result[0].message).toBe('Third');
		expect(result[1].message).toBe('Second');
		expect(result[2].message).toBe('First');
	});

	it('trims whitespace from entries', () => {
		const result = parseGuestCommentHistory('  Hola  \n\n  [12 jun 2026, 10:00]  Adios  ');
		expect(result).toHaveLength(2);
		expect(result[0].message).toBe('Adios');
		expect(result[1].message).toBe('Hola');
	});

	it('has stable ids based on order', () => {
		const result = parseGuestCommentHistory('A\n\nB');
		expect(result[0].id).toBe('msg-1');
		expect(result[1].id).toBe('msg-0');
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

describe('formatGuestDateShort', () => {
	it('returns dash for null value', () => {
		expect(formatGuestDateShort(null)).toBe('-');
	});

	it('returns dash for empty string', () => {
		expect(formatGuestDateShort('')).toBe('-');
	});

	it('formats short date for es-MX locale', () => {
		const result = formatGuestDateShort('2026-03-22T00:00:00.000Z');
		expect(result).toContain('2026');
	});

	it('returns the raw value when date parsing fails', () => {
		expect(formatGuestDateShort('not-a-date')).toBe('not-a-date');
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
	it('returns false when deliveryStatus is generated even if firstSharedAt is set', () => {
		expect(
			hasBeenShared(
				makeGuest({
					deliveryStatus: 'generated',
					firstSharedAt: '2026-01-15T10:00:00.000Z',
				}),
			),
		).toBe(false);
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

	it('returns true for legacy data with firstSharedAt set but no explicit deliveryStatus', () => {
		expect(
			hasBeenShared(
				makeGuest({
					deliveryStatus: undefined as unknown as 'generated',
					firstSharedAt: '2026-01-15T10:00:00.000Z',
				}),
			),
		).toBe(true);
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

	it('confirmed guest with generated deliveryStatus → "Compartir invitación" + invitation', () => {
		const result = getShareCtaLabel(
			makeGuest({
				deliveryStatus: 'generated',
				attendanceStatus: 'confirmed',
				firstSharedAt: '2026-01-15T10:00:00.000Z',
			}),
		);
		expect(result.label).toBe('Compartir invitación');
		expect(result.defaultMessageType).toBe('invitation');
	});

	it('confirmed guest with shared deliveryStatus → "Enviar recordatorio" + reminder', () => {
		const result = getShareCtaLabel(
			makeGuest({
				deliveryStatus: 'shared',
				attendanceStatus: 'confirmed',
				firstSharedAt: '2026-01-15T10:00:00.000Z',
			}),
		);
		expect(result.label).toBe('Enviar recordatorio');
		expect(result.defaultMessageType).toBe('reminder');
	});

	it('declined guest with generated deliveryStatus → "Compartir invitación" + invitation', () => {
		const result = getShareCtaLabel(
			makeGuest({
				deliveryStatus: 'generated',
				attendanceStatus: 'declined',
				firstSharedAt: '2026-01-15T10:00:00.000Z',
			}),
		);
		expect(result.label).toBe('Compartir invitación');
		expect(result.defaultMessageType).toBe('invitation');
	});

	it('declined guest with shared deliveryStatus → "Enviar recordatorio" + reminder', () => {
		const result = getShareCtaLabel(
			makeGuest({
				deliveryStatus: 'shared',
				attendanceStatus: 'declined',
				firstSharedAt: '2026-01-15T10:00:00.000Z',
			}),
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
