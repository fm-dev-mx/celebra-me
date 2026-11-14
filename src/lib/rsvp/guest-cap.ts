import { z } from '@/lib/schemas/zod-jitless';

export const RSVP_GUEST_CAP_MIN = 1;

// guest_invitations.max_allowed_attendees is a PostgreSQL integer (int4).
// This is a storage/runtime ceiling, not a product limit.
export const RSVP_GUEST_CAP_TECHNICAL_MAX = 2_147_483_647;

export const rsvpGuestCapSchema = z
	.number()
	.int()
	.min(RSVP_GUEST_CAP_MIN, 'Debe permitir al menos 1 asistente total.')
	.max(
		RSVP_GUEST_CAP_TECHNICAL_MAX,
		`El valor excede el límite técnico de ${RSVP_GUEST_CAP_TECHNICAL_MAX.toLocaleString('es-MX')} asistentes.`,
	);

export function resolveGuestCap(value: number | undefined): { maxTotalAttendees: number } {
	const result = rsvpGuestCapSchema.safeParse(value);
	return { maxTotalAttendees: result.success ? result.data : RSVP_GUEST_CAP_MIN };
}

// --- Children inside the reserved passes -----------------------------------
// guest_invitations stores passes (max_allowed_attendees) and how many of them
// are for children (max_allowed_children). Adults are always derived.

export const guestChildrenCapSchema = z
	.number()
	.int()
	.min(0, 'Los niños no pueden ser un número negativo.')
	.max(RSVP_GUEST_CAP_TECHNICAL_MAX);

export const CHILDREN_EXCEED_PASSES_MESSAGE = 'Los niños no pueden superar el total de pases.';

/** Returns an error message when the children passes do not fit in the reserved passes. */
export function reservationIssue(passes: number, children: number): string | null {
	return children > passes ? CHILDREN_EXCEED_PASSES_MESSAGE : null;
}

/** The one reservation shape: passes plus how many of them are for children. */
export const guestReservationSchema = z
	.object({
		maxAllowedAttendees: rsvpGuestCapSchema,
		maxAllowedChildren: guestChildrenCapSchema.default(0),
	})
	.superRefine((value, ctx) => {
		const message = reservationIssue(value.maxAllowedAttendees, value.maxAllowedChildren);
		if (message) ctx.addIssue({ code: 'custom', path: ['maxAllowedChildren'], message });
	});

export type GuestReservation = z.infer<typeof guestReservationSchema>;

/** Children passes clamped into [0, passes]; tolerant of missing or legacy values. */
export function resolveChildrenCap(children: number | undefined, passes: number): number {
	const n = typeof children === 'number' && Number.isFinite(children) ? Math.trunc(children) : 0;
	return Math.max(0, Math.min(n, passes));
}

export type ConfirmedPartyIssue = 'min_attendees' | 'max_attendees' | 'max_children';

/**
 * The one confirmed-count rule shared by the RSVP form and the RSVP API:
 * at least 1 attendee, no more than the passes, and children no more than
 * their reserved passes nor the confirmed attendees.
 */
export function checkConfirmedParty(input: {
	attendeeCount: number;
	childrenCount?: number;
	maxAttendees: number;
	maxChildren?: number;
}): ConfirmedPartyIssue | null {
	const children = input.childrenCount ?? 0;
	if (input.attendeeCount < 1) return 'min_attendees';
	if (input.attendeeCount > input.maxAttendees) return 'max_attendees';
	if (children < 0 || children > (input.maxChildren ?? 0) || children > input.attendeeCount) {
		return 'max_children';
	}
	return null;
}

/** Children that may be confirmed for a given attendee count. */
export function maxConfirmableChildren(attendeeCount: number, maxChildren: number): number {
	return Math.max(0, Math.min(attendeeCount, maxChildren));
}

export type PartyUnit = 'pase' | 'persona' | 'invitado';

const UNIT_WORDS: Record<PartyUnit, [string, string]> = {
	pase: ['pase', 'pases'],
	persona: ['persona', 'personas'],
	invitado: ['invitado', 'invitados'],
};

function countWord(count: number, [one, many]: [string, string]): string {
	return `${count} ${count === 1 ? one : many}`;
}

/**
 * Formats a party size. Without children it reads «3 pases» / «1 persona»;
 * with children it reads «2 adultos y 1 niño».
 */
export function formatParty(
	count: number,
	options: { children?: number; unit?: PartyUnit } = {},
): string {
	const children = resolveChildrenCap(options.children, count);
	if (children === 0) return countWord(count, UNIT_WORDS[options.unit ?? 'pase']);
	const adults = count - children;
	const kids = countWord(children, ['niño', 'niños']);
	return adults === 0 ? kids : `${countWord(adults, ['adulto', 'adultos'])} y ${kids}`;
}

/**
 * Adult/child breakdown for a guest's pass. It is undefined when no place is for children, so
 * an invitation without children never mentions them.
 */
export function formatPassBreakdown(
	passes: number,
	children: number | undefined,
): string | undefined {
	return resolveChildrenCap(children, passes) > 0 ? formatParty(passes, { children }) : undefined;
}
