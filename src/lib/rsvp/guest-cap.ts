import { z } from 'zod';

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
