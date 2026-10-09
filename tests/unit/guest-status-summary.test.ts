import { makeGuest } from '@tests/helpers/guest-factory';
import {
	buildGuestSummaryShareText,
	computeGuestSummary,
	filterGuestsForReview,
	getGuestPeopleLabel,
	getGuestStage,
	matchesGuestSearch,
} from '@/components/dashboard/guests/guest-presenter';

const guests = [
	makeGuest({ guestId: 'to-send', deliveryStatus: 'generated', maxAllowedAttendees: 2 }),
	makeGuest({ guestId: 'unopened', deliveryStatus: 'shared', maxAllowedAttendees: 3 }),
	makeGuest({
		guestId: 'opened',
		deliveryStatus: 'shared',
		isViewed: true,
		maxAllowedAttendees: 4,
	}),
	makeGuest({
		guestId: 'partial',
		deliveryStatus: 'shared',
		attendanceStatus: 'confirmed',
		maxAllowedAttendees: 4,
		attendeeCount: 2,
	}),
	makeGuest({
		guestId: 'full',
		deliveryStatus: 'generated',
		attendanceStatus: 'confirmed',
		maxAllowedAttendees: 1,
		attendeeCount: 1,
	}),
	makeGuest({
		guestId: 'declined',
		deliveryStatus: 'shared',
		attendanceStatus: 'declined',
		maxAllowedAttendees: 2,
	}),
];

describe('getGuestStage', () => {
	it.each([
		['to-send', 'to-send'],
		['unopened', 'unopened'],
		['opened', 'opened'],
		['partial', 'confirmed'],
		['full', 'confirmed'],
		['declined', 'declined'],
	])('places %s in the %s stage', (guestId, stage) => {
		expect(getGuestStage(guests.find((g) => g.guestId === guestId)!)).toBe(stage);
	});

	it('treats a recorded first view as opened even without the viewed flag', () => {
		const guest = makeGuest({
			deliveryStatus: 'shared',
			firstViewedAt: '2026-10-01T00:00:00Z',
		});
		expect(getGuestStage(guest)).toBe('opened');
	});
});

describe('computeGuestSummary', () => {
	it('splits passes into people slices that add up to the assigned total', () => {
		const { people, invitations } = computeGuestSummary(guests);

		expect(invitations).toBe(6);
		expect(people).toEqual({ assigned: 16, confirmed: 3, declined: 2, unused: 2, noAnswer: 9 });
		expect(people.confirmed + people.declined + people.unused + people.noAnswer).toBe(
			people.assigned,
		);
	});

	it('counts every invitation in exactly one stage, with its passes', () => {
		const { stages, awaitingAnswer } = computeGuestSummary(guests);

		expect(stages).toEqual({
			'to-send': { invitations: 1, passes: 2 },
			unopened: { invitations: 1, passes: 3 },
			opened: { invitations: 1, passes: 4 },
			confirmed: { invitations: 2, passes: 5 },
			declined: { invitations: 1, passes: 2 },
		});
		expect(awaitingAnswer).toEqual({ invitations: 2, passes: 7 });
	});

	it('clamps over-reported attendees and counts pass-less invitations separately', () => {
		const summary = computeGuestSummary([
			makeGuest({ attendanceStatus: 'confirmed', maxAllowedAttendees: 2, attendeeCount: 5 }),
			makeGuest({ guestId: 'zero', maxAllowedAttendees: 0 }),
		]);

		expect(summary.people).toEqual({
			assigned: 2,
			confirmed: 2,
			declined: 0,
			unused: 0,
			noAnswer: 0,
		});
		expect(summary.withoutPasses).toBe(1);
		expect(summary.invitations).toBe(2);
	});

	it('returns zeros for an empty list', () => {
		const summary = computeGuestSummary([]);
		expect(summary.invitations).toBe(0);
		expect(summary.people.assigned).toBe(0);
	});
});

describe('getGuestPeopleLabel', () => {
	it('explains partial confirmations, declines and pending passes', () => {
		expect(getGuestPeopleLabel(guests[3])).toEqual({
			primary: 'Vienen 2 de 4',
			secondary: '2 lugares no usados',
		});
		expect(getGuestPeopleLabel(guests[4])).toEqual({
			primary: 'Viene 1 de 1',
			secondary: undefined,
		});
		expect(getGuestPeopleLabel(guests[5])).toEqual({
			primary: 'No asistirán',
			secondary: '2 pases liberados',
		});
		expect(getGuestPeopleLabel(guests[1])).toEqual({ primary: '3 pases' });
		expect(getGuestPeopleLabel(makeGuest({ maxAllowedAttendees: 0 }))).toEqual({
			primary: 'Sin pases asignados',
		});
	});
});

describe('matchesGuestSearch', () => {
	const guest = makeGuest({ fullName: 'José Pérez', phone: '6691234567' });

	it('matches names ignoring case and accents', () => {
		expect(matchesGuestSearch(guest, 'jose')).toBe(true);
		expect(matchesGuestSearch(guest, 'PÉREZ')).toBe(true);
		expect(matchesGuestSearch(guest, 'maria')).toBe(false);
	});

	it('matches phone digits, using the last ten for long numbers', () => {
		expect(matchesGuestSearch(guest, '1234')).toBe(true);
		expect(matchesGuestSearch(guest, '+52 669 123 4567')).toBe(true);
		expect(matchesGuestSearch(makeGuest({ phone: '' }), '1234')).toBe(false);
	});

	it('matches everything for a blank query', () => {
		expect(matchesGuestSearch(guest, '  ')).toBe(true);
	});
});

describe('filterGuestsForReview', () => {
	const base = { group: 'all', reminderEligibleIds: new Set<string>() };

	it.each([
		['unopened', ['unopened']],
		['opened', ['opened']],
		['answered', ['partial', 'full', 'declined']],
		['declined', ['declined']],
		['delivery-pending', ['to-send']],
	] as const)('filters the %s stage', (reviewFilter, ids) => {
		const result = filterGuestsForReview(guests, { ...base, reviewFilter });
		expect(result.map((g) => g.guestId)).toEqual(ids);
	});

	it('combines the stage filter with the search', () => {
		const named = guests.map((g) => ({ ...g, fullName: `Invitado ${g.guestId}` }));
		const result = filterGuestsForReview(named, {
			...base,
			reviewFilter: 'answered',
			search: 'full',
		});
		expect(result.map((g) => g.guestId)).toEqual(['full']);
	});
});

describe('buildGuestSummaryShareText', () => {
	it('writes a WhatsApp-ready summary with the deadline', () => {
		const text = buildGuestSummaryShareText(
			computeGuestSummary(guests),
			'Boda de Ana',
			'15 de noviembre',
		);

		expect(text).toBe(
			[
				'Boda de Ana: resumen de invitados',
				'3 personas confirmadas de 16 pases.',
				'No asistirán: 2. Sin respuesta: 9.',
				'2 invitaciones enviadas siguen sin respuesta.',
				'1 por enviar.',
				'Fecha límite para confirmar: 15 de noviembre.',
			].join('\n'),
		);
	});
});
