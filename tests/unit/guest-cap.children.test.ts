import {
	CHILDREN_EXCEED_PASSES_MESSAGE,
	checkConfirmedParty,
	formatParty,
	formatPassBreakdown,
	guestReservationSchema,
	maxConfirmableChildren,
	reservationIssue,
	resolveChildrenCap,
} from '@/lib/rsvp/guest-cap';
import {
	buildWhatsAppUrl,
	normalizeChildrenCount,
	validateRsvpForm,
} from '@/components/invitation/rsvp-logic';
import { validateRsvpPayload } from '@/lib/rsvp/services/rsvp-submission.service';

describe('guest reservation with children', () => {
	it('accepts children up to the passes and rejects more', () => {
		expect(reservationIssue(3, 3)).toBeNull();
		expect(reservationIssue(3, 4)).toBe(CHILDREN_EXCEED_PASSES_MESSAGE);
	});

	it('defaults children to 0 and reports the excess on maxAllowedChildren', () => {
		expect(guestReservationSchema.parse({ maxAllowedAttendees: 2 })).toEqual({
			maxAllowedAttendees: 2,
			maxAllowedChildren: 0,
		});
		const result = guestReservationSchema.safeParse({
			maxAllowedAttendees: 2,
			maxAllowedChildren: 3,
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(['maxAllowedChildren']);
	});

	it('clamps legacy or missing children into the passes', () => {
		expect(resolveChildrenCap(undefined, 4)).toBe(0);
		expect(resolveChildrenCap(9, 4)).toBe(4);
		expect(resolveChildrenCap(-2, 4)).toBe(0);
	});
});

describe('formatPassBreakdown', () => {
	it('never mentions children on a pass without child places', () => {
		for (const children of [0, undefined, -1, Number.NaN]) {
			expect(formatPassBreakdown(4, children)).toBeUndefined();
		}
	});

	it('splits adults and children only when the pass includes children', () => {
		expect(formatPassBreakdown(4, 1)).toBe('3 adultos y 1 niño');
		expect(formatPassBreakdown(2, 5)).toBe('2 niños');
	});
});

describe('formatParty', () => {
	it('keeps the plain count when there are no children', () => {
		expect(formatParty(1)).toBe('1 pase');
		expect(formatParty(3)).toBe('3 pases');
		expect(formatParty(2, { unit: 'persona' })).toBe('2 personas');
		expect(formatParty(2, { children: 0 })).toBe('2 pases');
	});

	it('derives adults from the total', () => {
		expect(formatParty(3, { children: 1 })).toBe('2 adultos y 1 niño');
		expect(formatParty(5, { children: 4 })).toBe('1 adulto y 4 niños');
		expect(formatParty(2, { children: 2 })).toBe('2 niños');
	});
});

describe('checkConfirmedParty', () => {
	const base = { maxAttendees: 4, maxChildren: 2 };

	it('flags attendee bounds first', () => {
		expect(checkConfirmedParty({ ...base, attendeeCount: 0 })).toBe('min_attendees');
		expect(checkConfirmedParty({ ...base, attendeeCount: 5 })).toBe('max_attendees');
	});

	it('caps children by their passes and by the confirmed attendees', () => {
		expect(checkConfirmedParty({ ...base, attendeeCount: 4, childrenCount: 2 })).toBeNull();
		expect(checkConfirmedParty({ ...base, attendeeCount: 4, childrenCount: 3 })).toBe(
			'max_children',
		);
		expect(checkConfirmedParty({ ...base, attendeeCount: 1, childrenCount: 2 })).toBe(
			'max_children',
		);
		expect(checkConfirmedParty({ attendeeCount: 2, childrenCount: 1, maxAttendees: 2 })).toBe(
			'max_children',
		);
	});

	it('computes the confirmable children cap', () => {
		expect(maxConfirmableChildren(1, 3)).toBe(1);
		expect(maxConfirmableChildren(4, 2)).toBe(2);
		expect(maxConfirmableChildren(3, 0)).toBe(0);
	});
});

describe('RSVP form validation with children', () => {
	const context = {
		name: 'Ana',
		phone: '',
		phoneRequired: false,
		nameLocked: true,
		attendanceStatus: 'confirmed' as const,
		attendeeCount: 2,
		supportsPlusOnes: true,
		effectiveGuestCap: 3,
	};

	it('ignores children when none were reserved', () => {
		expect(validateRsvpForm({ ...context, childrenCount: 5 })).toEqual({});
	});

	it('rejects more children than allowed for the confirmed count', () => {
		const errors = validateRsvpForm({ ...context, childrenCount: 3, maxChildren: 3 });
		expect(errors.childrenCount).toBe('Pueden venir hasta 2 niños.');
		expect(validateRsvpForm({ ...context, childrenCount: 2, maxChildren: 3 })).toEqual({});
	});

	it('sends children only with a confirmed answer and clamps them', () => {
		expect(normalizeChildrenCount('declined', 2, 0, 2)).toBe(0);
		expect(normalizeChildrenCount('confirmed', 2, 3, 0)).toBe(0);
		expect(normalizeChildrenCount('confirmed', '5', 3, 2)).toBe(2);
		expect(normalizeChildrenCount('confirmed', 1, 1, 2)).toBe(1);
	});
});

describe('RSVP API validation with children', () => {
	it('forces children to 0 on decline', () => {
		expect(
			validateRsvpPayload(
				{ attendanceStatus: 'declined', attendeeCount: 0, childrenCount: 2 },
				3,
				2,
			),
		).toEqual({ attendanceStatus: 'declined', attendeeCount: 0, childrenCount: 0 });
	});

	it('accepts children within the reservation', () => {
		expect(
			validateRsvpPayload(
				{ attendanceStatus: 'confirmed', attendeeCount: 3, childrenCount: 2 },
				3,
				2,
			),
		).toEqual({ attendanceStatus: 'confirmed', attendeeCount: 3, childrenCount: 2 });
	});

	it('rejects children beyond the reservation or without any reserved', () => {
		expect(() =>
			validateRsvpPayload(
				{ attendanceStatus: 'confirmed', attendeeCount: 3, childrenCount: 3 },
				3,
				2,
			),
		).toThrow('Children count exceeds the limit for this invitation.');
		expect(() =>
			validateRsvpPayload(
				{ attendanceStatus: 'confirmed', attendeeCount: 2, childrenCount: 1 },
				2,
			),
		).toThrow('Children count exceeds the limit for this invitation.');
	});
});

describe('WhatsApp confirmation message', () => {
	const params = {
		whatsappConfig: { phone: '5215555555555' },
		attendanceStatus: 'confirmed' as const,
		attendeeCount: 3,
		name: 'Ana',
		title: 'XV de Sofía',
	};
	const text = (url: string) => decodeURIComponent(new URL(url).searchParams.get('text') ?? '');

	it('keeps the original wording without children', () => {
		expect(text(buildWhatsAppUrl(params))).toBe(
			'Hola, soy Ana. Confirmo mi asistencia a XV de Sofía. Asistiremos 3 persona(s).',
		);
	});

	it('adds the adults and children breakdown', () => {
		expect(text(buildWhatsAppUrl({ ...params, childrenCount: 1 }))).toBe(
			'Hola, soy Ana. Confirmo mi asistencia a XV de Sofía. Asistiremos 2 adultos y 1 niño.',
		);
	});
});
