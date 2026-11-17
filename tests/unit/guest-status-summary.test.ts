import { makeGuest } from '@tests/helpers/guest-factory';
import {
	buildGuestSummaryShareText,
	computeGuestSummary,
	filterGuestsForReview,
	formatPassesWithChildren,
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
		expect(people).toEqual({
			assigned: 16,
			assignedChildren: 0,
			confirmed: 3,
			confirmedChildren: 0,
			declined: 2,
			declinedChildren: 0,
			unused: 2,
			noAnswer: 9,
			noAnswerChildren: 0,
		});
		expect(people.confirmed + people.declined + people.unused + people.noAnswer).toBe(
			people.assigned,
		);
	});

	it('counts every invitation in exactly one stage, with its passes', () => {
		const { stages, awaitingAnswer } = computeGuestSummary(guests);

		expect(stages).toEqual({
			'to-send': { invitations: 1, passes: 2, children: 0 },
			unopened: { invitations: 1, passes: 3, children: 0 },
			opened: { invitations: 1, passes: 4, children: 0 },
			confirmed: { invitations: 2, passes: 5, children: 0 },
			declined: { invitations: 1, passes: 2, children: 0 },
		});
		expect(awaitingAnswer).toEqual({ invitations: 2, passes: 7, children: 0 });
	});

	it('counts children among the confirmed people only', () => {
		const { people } = computeGuestSummary([
			makeGuest({
				guestId: 'family',
				attendanceStatus: 'confirmed',
				maxAllowedAttendees: 3,
				maxAllowedChildren: 1,
				attendeeCount: 3,
				childrenCount: 1,
			}),
			makeGuest({
				guestId: 'over-reported',
				attendanceStatus: 'confirmed',
				maxAllowedAttendees: 1,
				attendeeCount: 1,
				childrenCount: 4,
			}),
			makeGuest({
				guestId: 'pending',
				deliveryStatus: 'shared',
				maxAllowedAttendees: 4,
				maxAllowedChildren: 2,
				childrenCount: 2,
			}),
		]);

		expect(people.confirmed).toBe(4);
		expect(people.confirmedChildren).toBe(2);
	});

	it('clamps over-reported attendees and counts pass-less invitations separately', () => {
		const summary = computeGuestSummary([
			makeGuest({ attendanceStatus: 'confirmed', maxAllowedAttendees: 2, attendeeCount: 5 }),
			makeGuest({ guestId: 'zero', maxAllowedAttendees: 0 }),
		]);

		expect(summary.people).toEqual({
			assigned: 2,
			assignedChildren: 0,
			confirmed: 2,
			confirmedChildren: 0,
			declined: 0,
			declinedChildren: 0,
			unused: 0,
			noAnswer: 0,
			noAnswerChildren: 0,
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
		['declined', ['partial', 'declined']],
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

describe('children totals', () => {
	it('uses reserved children for pending and declined passes, and actual children for confirmations', () => {
		const summary = computeGuestSummary([
			makeGuest({
				deliveryStatus: 'generated',
				maxAllowedAttendees: 5,
				maxAllowedChildren: 2,
				childrenCount: 4,
			}),
			makeGuest({ deliveryStatus: 'shared', maxAllowedAttendees: 4, maxAllowedChildren: 1 }),
			makeGuest({
				deliveryStatus: 'shared',
				isViewed: true,
				maxAllowedAttendees: 3,
				maxAllowedChildren: 2,
			}),
			makeGuest({
				attendanceStatus: 'declined',
				maxAllowedAttendees: 6,
				maxAllowedChildren: 2,
				childrenCount: 5,
			}),
			makeGuest({
				attendanceStatus: 'confirmed',
				maxAllowedAttendees: 5,
				maxAllowedChildren: 3,
				attendeeCount: 4,
				childrenCount: 1,
			}),
		]);
		const { people, stages, awaitingAnswer } = summary;
		expect([people.assigned, people.assignedChildren]).toEqual([23, 10]);
		expect([people.confirmed, people.confirmedChildren]).toEqual([4, 1]);
		expect([people.declined, people.declinedChildren]).toEqual([6, 2]);
		expect([people.noAnswer, people.noAnswerChildren]).toEqual([12, 5]);
		expect(stages['to-send']).toEqual({ invitations: 1, passes: 5, children: 2 });
		expect(awaitingAnswer).toEqual({ invitations: 2, passes: 7, children: 3 });
		expect(Object.values(stages).reduce((sum, stage) => sum + stage.children, 0)).toBe(
			people.assignedChildren,
		);
		const text = buildGuestSummaryShareText(summary, '', '');
		for (const expected of [
			'4 personas confirmadas (3 adultos y 1 niño) de 23 pases (13 adultos y 10 niños).',
			'No asistirán: 6 (4 adultos y 2 niños). Sin respuesta: 12 (7 adultos y 5 niños).',
			'2 invitaciones enviadas siguen sin respuesta: 7 pases (4 adultos y 3 niños).',
			'1 por enviar: 5 pases (3 adultos y 2 niños).',
		])
			expect(text).toContain(expected);
	});

	it.each([undefined, -2, 99, Number.NaN, 1.8])(
		'clamps legacy child allowance %s in every unanswered stage',
		(maxAllowedChildren) => {
			const summary = computeGuestSummary([
				makeGuest({ maxAllowedAttendees: 2, maxAllowedChildren }),
				makeGuest({ deliveryStatus: 'shared', maxAllowedAttendees: 2, maxAllowedChildren }),
				makeGuest({
					attendanceStatus: 'declined',
					maxAllowedAttendees: 2,
					maxAllowedChildren,
				}),
			]);
			const expected = maxAllowedChildren === 99 ? 2 : maxAllowedChildren === 1.8 ? 1 : 0;
			expect(summary.people.assignedChildren).toBe(3 * expected);
			expect(summary.people.noAnswerChildren).toBe(2 * expected);
			expect(summary.people.declinedChildren).toBe(expected);
			expect(summary.awaitingAnswer.children).toBe(expected);
			expect(summary.stages['to-send'].children).toBe(expected);
		},
	);

	const family = [
		makeGuest({
			guestId: 'a',
			attendanceStatus: 'confirmed',
			maxAllowedAttendees: 4,
			maxAllowedChildren: 2,
			attendeeCount: 3,
			childrenCount: 1,
		}),
		makeGuest({ guestId: 'b', deliveryStatus: 'shared', maxAllowedAttendees: 2 }),
	];

	it('sums the child allowance of every assigned pass', () => {
		const { people } = computeGuestSummary(family);
		expect(people.assigned).toBe(6);
		expect(people.assignedChildren).toBe(2);
	});

	it('shows children next to passes, singular and plural', () => {
		expect(formatPassesWithChildren(4, 2)).toBe('4 pases (2 adultos y 2 niños)');
		expect(formatPassesWithChildren(3, 1)).toBe('3 pases (2 adultos y 1 niño)');
		expect(formatPassesWithChildren(2, 2)).toBe('2 pases (2 niños)');
		expect(formatPassesWithChildren(0, 99)).toBe('0 pases');
		expect(formatPassesWithChildren(4, 0)).toBe('4 pases');
	});

	it('adds the children to the shared summary', () => {
		const text = buildGuestSummaryShareText(computeGuestSummary(family), '', '');
		expect(text.split('\n')[1]).toBe(
			'3 personas confirmadas (2 adultos y 1 niño) de 6 pases (4 adultos y 2 niños).',
		);
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
