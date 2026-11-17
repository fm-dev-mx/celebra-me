import { validateRsvpPayload } from '@/lib/rsvp/services/rsvp-submission.service';
import { MAX_GUEST_COMMENT_LEN, sanitize } from '@/lib/rsvp/core/utils';
import { validateRsvpForm } from '@/components/invitation/rsvp-logic';
import { buildShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';

describe('validateRsvpPayload — server business rules', () => {
	it('accepts a valid confirmed payload with children within cap', () => {
		const result = validateRsvpPayload(
			{
				attendanceStatus: 'confirmed',
				attendeeCount: 3,
				childrenCount: 1,
				guestComment: '  Muchas felicidades  ',
			},
			4,
			2,
		);

		expect(result).toEqual({
			attendanceStatus: 'confirmed',
			attendeeCount: 3,
			childrenCount: 1,
		});
	});

	it('forces attendeeCount and childrenCount to 0 when declined', () => {
		const result = validateRsvpPayload(
			{
				attendanceStatus: 'declined',
				attendeeCount: 4,
				childrenCount: 2,
				guestComment: 'No podremos asistir',
			},
			4,
			2,
		);

		expect(result).toEqual({
			attendanceStatus: 'declined',
			attendeeCount: 0,
			childrenCount: 0,
		});
	});

	it.each([null, undefined, '', 'pending', 'maybe'])(
		'rejects invalid attendanceStatus (%p)',
		(status) => {
			expect(() =>
				validateRsvpPayload({ attendanceStatus: status as never, attendeeCount: 1 }, 4, 0),
			).toThrow('Attendance status is invalid.');
		},
	);

	it.each([0, -1, Number.NaN])(
		'rejects invalid attendeeCount (%p) when confirmed',
		(attendeeCount) => {
			expect(() =>
				validateRsvpPayload({ attendanceStatus: 'confirmed', attendeeCount }, 4, 0),
			).toThrow('Confirmed attendance requires at least 1 attendee.');
		},
	);

	it('rejects attendeeCount exceeding maxAllowedAttendees', () => {
		expect(() =>
			validateRsvpPayload({ attendanceStatus: 'confirmed', attendeeCount: 5 }, 4, 0),
		).toThrow('The limit for this invitation is 4.');
	});

	it('rejects childrenCount exceeding maxAllowedChildren', () => {
		expect(() =>
			validateRsvpPayload(
				{ attendanceStatus: 'confirmed', attendeeCount: 3, childrenCount: 2 },
				4,
				1,
			),
		).toThrow('Children count exceeds the limit for this invitation.');
	});

	it('rejects childrenCount exceeding confirmed attendeeCount', () => {
		expect(() =>
			validateRsvpPayload(
				{ attendanceStatus: 'confirmed', attendeeCount: 1, childrenCount: 2 },
				4,
				2,
			),
		).toThrow('Children count exceeds the limit for this invitation.');
	});

	it('sanitizes and truncates guestComment to MAX_GUEST_COMMENT_LEN (1000 chars)', () => {
		const oversized = 'A'.repeat(MAX_GUEST_COMMENT_LEN + 250);
		const sanitized = sanitize(oversized, MAX_GUEST_COMMENT_LEN);

		expect(sanitized).toHaveLength(MAX_GUEST_COMMENT_LEN);
	});
});

describe('validateRsvpForm — client form validation', () => {
	const baseInput = {
		name: 'María Solís',
		nameLocked: false,
		phone: '6141234567',
		phoneRequired: false,
		attendanceStatus: 'confirmed' as const,
		attendeeCount: 2 as number | '',
		supportsPlusOnes: true,
		effectiveGuestCap: 4,
		childrenCount: 1 as number | '',
		maxChildren: 2,
		copy: 'usted' as const,
	};

	it('returns empty errors for a valid confirmed or declined form', () => {
		expect(validateRsvpForm(baseInput)).toEqual({});
		expect(
			validateRsvpForm({
				...baseInput,
				attendanceStatus: 'declined',
				attendeeCount: 0,
				childrenCount: 0,
			}),
		).toEqual({});
	});

	it('requires attendanceStatus before submitting', () => {
		expect(validateRsvpForm({ ...baseInput, attendanceStatus: null }).attendance).toBe(
			'Por favor, indique si asistirá.',
		);
		expect(
			validateRsvpForm({
				...baseInput,
				attendanceStatus: null,
				copy: 'legacy',
			}).attendance,
		).toBe('Por favor, selecciona si asistirás.');
	});

	it('requires name only when nameLocked is false', () => {
		expect(validateRsvpForm({ ...baseInput, name: '   ' }).name).toBe(
			'Por favor, escriba su nombre completo.',
		);
		expect(
			validateRsvpForm({ ...baseInput, name: '   ', nameLocked: true }).name,
		).toBeUndefined();
	});

	it('validates phone when required or when non-empty and wrong length', () => {
		expect(validateRsvpForm({ ...baseInput, phone: '' }).phone).toBeUndefined();
		expect(validateRsvpForm({ ...baseInput, phone: '', phoneRequired: true }).phone).toBe(
			'Por favor, escriba su teléfono.',
		);
		expect(validateRsvpForm({ ...baseInput, phone: '123' }).phone).toBe(
			'Escriba un teléfono de 10 dígitos.',
		);
	});

	it('flags attendeeCount below 1 or above effectiveGuestCap', () => {
		expect(validateRsvpForm({ ...baseInput, attendeeCount: 0 }).guestCount).toBe(
			'El número de invitados debe ser al menos 1.',
		);
		expect(validateRsvpForm({ ...baseInput, attendeeCount: 6 }).guestCount).toBe(
			'El límite de invitados es de 4.',
		);
	});

	it('flags childrenCount exceeding confirmed attendees or maxChildren', () => {
		expect(
			validateRsvpForm({ ...baseInput, attendeeCount: 1, childrenCount: 2 }).childrenCount,
		).toBe('Pueden venir hasta 1 niño.');
		expect(
			validateRsvpForm({ ...baseInput, attendeeCount: 4, childrenCount: 3 }).childrenCount,
		).toBe('Pueden venir hasta 2 niños.');
	});
});

describe('buildShareMessageDateContext — before, same day, and after', () => {
	const today = new Date('2026-06-15T12:00:00Z');

	it('computes positive days and plural/singular timing text before the date', () => {
		const multiDays = buildShareMessageDateContext(
			'2026-06-20',
			'2026-06-18',
			'XV de Valeria',
			today,
		);
		expect(multiDays.rawDaysUntilEvent).toBe(5);
		expect(multiDays.daysUntilEvent).toBe('5');
		expect(multiDays.eventTimingText).toBe('Faltan 5 días para la celebración.');
		expect(multiDays.rsvpDeadline).toBe('18 de junio de 2026');
		expect(multiDays.rsvpDeadlineText).toBe(
			'Confirma tu asistencia antes del 18 de junio de 2026.',
		);

		const oneDay = buildShareMessageDateContext(
			'2026-06-16',
			'2026-06-15',
			'XV de Valeria',
			today,
		);
		expect(oneDay.rawDaysUntilEvent).toBe(1);
		expect(oneDay.daysUntilEvent).toBe('1');
		expect(oneDay.eventTimingText).toBe('Falta 1 día para la celebración.');
	});

	it('computes 0 days and celebration message on the exact same day', () => {
		const sameDay = buildShareMessageDateContext(
			'2026-06-15',
			'2026-06-15',
			'XV de Valeria',
			today,
		);
		expect(sameDay.rawDaysUntilEvent).toBe(0);
		expect(sameDay.daysUntilEvent).toBe('0');
		expect(sameDay.eventTimingText).toBe('¡Hoy es el gran día de la celebración!');
		expect(sameDay.rsvpDeadline).toBe('15 de junio de 2026');
	});

	it('computes negative rawDaysUntilEvent and empty countdown text after the date', () => {
		const afterDay = buildShareMessageDateContext(
			'2026-06-10',
			'2026-06-05',
			'XV de Valeria',
			today,
		);
		expect(afterDay.rawDaysUntilEvent).toBe(-5);
		expect(afterDay.daysUntilEvent).toBe('');
		expect(afterDay.eventTimingText).toBe('');
	});

	it('accepts Spanish human-readable deadline strings and falls back safely on missing/invalid dates', () => {
		const spanishText = buildShareMessageDateContext(
			'2026-06-20',
			'15 de noviembre',
			'',
			today,
		);
		expect(spanishText.rsvpDeadline).toBe('15 de noviembre');
		expect(spanishText.rsvpDeadlineText).toBe(
			'Confirma tu asistencia antes de 15 de noviembre.',
		);

		const invalid = buildShareMessageDateContext(null, null, '', today);
		expect(invalid.rawDaysUntilEvent).toBeNull();
		expect(invalid.daysUntilEvent).toBe('');
		expect(invalid.eventDate).toBe('');
		expect(invalid.rsvpDeadline).toBe('');
		expect(invalid.rsvpDeadlineText).toBe('Confirma tu asistencia lo antes posible.');
	});
});
