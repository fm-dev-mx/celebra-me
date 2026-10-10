import { makeGuest } from '@tests/helpers/guest-factory';
import {
	getGuestListSubtitle,
	getGuestProgressSteps,
	getGuestStatusBucket,
	groupGuestsByStatus,
} from '@/components/dashboard/guests/guest-presenter';

const NOW = new Date(2026, 9, 3, 12, 0, 0);

describe('getGuestStatusBucket', () => {
	it.each([
		[{ deliveryStatus: 'generated' as const }, 'to-send'],
		[{ deliveryStatus: 'shared' as const }, 'waiting'],
		[
			{ deliveryStatus: 'generated' as const, attendanceStatus: 'confirmed' as const },
			'confirmed',
		],
		[{ deliveryStatus: 'shared' as const, attendanceStatus: 'declined' as const }, 'declined'],
	])('maps %o to %s', (overrides, bucket) => {
		expect(getGuestStatusBucket(makeGuest(overrides))).toBe(bucket);
	});
});

describe('groupGuestsByStatus', () => {
	it('returns non-empty sections in journey order with names sorted', () => {
		const sections = groupGuestsByStatus([
			makeGuest({ guestId: '1', fullName: 'Zoe', attendanceStatus: 'confirmed' }),
			makeGuest({ guestId: '2', fullName: 'Ángel', deliveryStatus: 'generated' }),
			makeGuest({ guestId: '3', fullName: 'Bruno', deliveryStatus: 'generated' }),
			makeGuest({ guestId: '4', fullName: 'Ana', attendanceStatus: 'confirmed' }),
		]);

		expect(sections.map((s) => [s.title, s.items.map((i) => i.fullName)])).toEqual([
			['Por enviar', ['Ángel', 'Bruno']],
			['Confirmados', ['Ana', 'Zoe']],
		]);
	});
});

describe('getGuestListSubtitle', () => {
	it('describes unsent guests by passes, flagging a missing phone', () => {
		expect(getGuestListSubtitle(makeGuest({ maxAllowedAttendees: 1 }), NOW)).toBe(
			'1 pase · Sin enviar',
		);
		expect(getGuestListSubtitle(makeGuest({ phone: '' }), NOW)).toBe('4 pases · Sin teléfono');
	});

	it('prefers "Ya la abrió" over the send date for waiting guests', () => {
		expect(
			getGuestListSubtitle(
				makeGuest({
					deliveryStatus: 'shared',
					isViewed: true,
					firstSharedAt: '2026-09-01',
				}),
				NOW,
			),
		).toBe('4 pases · Ya la abrió');
	});

	it.each([
		[new Date(2026, 9, 3, 8).toISOString(), 'Enviada hoy'],
		[new Date(2026, 9, 2, 20).toISOString(), 'Enviada ayer'],
		[new Date(2026, 8, 28, 9).toISOString(), 'Enviada hace 5 días'],
		[null, 'Enviada'],
	])('phrases the send date %s as "%s"', (firstSharedAt, phrase) => {
		expect(
			getGuestListSubtitle(makeGuest({ deliveryStatus: 'shared', firstSharedAt }), NOW),
		).toBe(`4 pases · ${phrase}`);
	});

	it('reports confirmed attendance and declines in words', () => {
		expect(
			getGuestListSubtitle(
				makeGuest({
					attendanceStatus: 'confirmed',
					attendeeCount: 1,
					maxAllowedAttendees: 2,
				}),
				NOW,
			),
		).toBe('Viene 1 de 2 · 1 lugar no usado');
		expect(
			getGuestListSubtitle(
				makeGuest({ attendanceStatus: 'confirmed', attendeeCount: 3 }),
				NOW,
			),
		).toBe('Vienen 3 de 4 · 1 lugar no usado');
		expect(getGuestListSubtitle(makeGuest({ attendanceStatus: 'declined' }), NOW)).toBe(
			'Avisó que no podrá ir',
		);
	});
});

describe('getGuestProgressSteps', () => {
	const states = (overrides: Parameters<typeof makeGuest>[0]) =>
		getGuestProgressSteps(makeGuest(overrides)).map((step) => step.state);

	it('walks the three steps as the invitation advances', () => {
		expect(states({ deliveryStatus: 'generated' })).toEqual([
			'current',
			'upcoming',
			'upcoming',
		]);
		expect(states({ deliveryStatus: 'shared' })).toEqual(['done', 'current', 'upcoming']);
		expect(states({ deliveryStatus: 'shared', attendanceStatus: 'declined' })).toEqual([
			'done',
			'done',
			'done',
		]);
	});

	it('labels each step with its date or the answer', () => {
		const viewed = getGuestProgressSteps(
			makeGuest({
				deliveryStatus: 'shared',
				isViewed: true,
				firstSharedAt: '2026-10-03T12:00:00Z',
				firstViewedAt: '2026-10-05T12:00:00Z',
			}),
		);
		expect(viewed.map((step) => step.label)).toEqual(['Enviada', 'Abierta', 'Respuesta']);
		expect(viewed[0].note).toMatch(/3 oct/);
		expect(viewed[1].note).toMatch(/5 oct/);
		expect(viewed[2].note).toBe('Pendiente');

		const confirmed = getGuestProgressSteps(
			makeGuest({ attendanceStatus: 'confirmed', attendeeCount: 2 }),
		);
		expect(confirmed[2].note).toBe('Vienen 2 de 4');
	});

	it('treats an answer as sent and opened even if never marked', () => {
		expect(states({ deliveryStatus: 'generated', attendanceStatus: 'confirmed' })).toEqual([
			'done',
			'done',
			'done',
		]);
	});
});
