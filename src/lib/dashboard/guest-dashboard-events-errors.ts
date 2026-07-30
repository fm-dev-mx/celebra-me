/**
 * Guest dashboard event-list error classification.
 *
 * Contract with `/api/dashboard/events`:
 * - Auth failures return HTTP 401 and never a 200 with `items: []`.
 * - A successful response with `items: []` means the session was accepted
 *   and the host simply has no visible events (unless `debug` is present and
 *   explicitly reports a non-resolved session — defensive only).
 * - `debug` is optional and only attached when the client requests `?debug=1`.
 *   Absence of `debug` must never be treated as an auth failure.
 */

import type { DashboardEventListDebug } from '@/interfaces/dashboard/admin.interface';

export const GUEST_DASHBOARD_SESSION_INVALID_MESSAGE =
	'El dashboard no esta autenticando al usuario esperado o la sesion no es valida.';

export const GUEST_DASHBOARD_NO_EVENTS_MESSAGE =
	'No hay eventos asignados a esta cuenta. Si la invitación existe en contenido, falta sincronizar la tabla events o la membresía del host.';

export const GUEST_DASHBOARD_MEMBERSHIP_UNRESOLVED_MESSAGE =
	'La cuenta tiene membresias, pero el dashboard no puede resolver sus eventos. Revisa RLS o migraciones en Supabase.';

export const GUEST_DASHBOARD_NO_OWNERSHIP_MESSAGE =
	'La sesion actual no tiene ownership ni membership sobre el evento solicitado.';

export const GUEST_DASHBOARD_EVENT_UNAVAILABLE_MESSAGE =
	'El evento solicitado no esta disponible para esta cuenta o no existe en la base sincronizada.';

interface HostEventRef {
	id: string;
}

function readDebugReason(error: object): string | undefined {
	if (!('details' in error)) return undefined;
	const details = (error as { details?: unknown }).details;
	if (!details || typeof details !== 'object' || !('debug' in details)) return undefined;
	const debug = (details as { debug?: unknown }).debug;
	if (!debug || typeof debug !== 'object' || !('reason' in debug)) return undefined;
	const reason = (debug as { reason?: unknown }).reason;
	return typeof reason === 'string' ? reason : undefined;
}

function isUnauthorizedError(error: object): boolean {
	const status = 'status' in error ? (error as { status?: unknown }).status : undefined;
	const code = 'code' in error ? (error as { code?: unknown }).code : undefined;
	return status === 401 || code === 'unauthorized';
}

/**
 * Maps thrown listEvents failures (sad path: request never returned items).
 */
export function getEventLoadFailureMessage(error: unknown, fallback: string): string {
	if (error && typeof error === 'object') {
		const debugReason = readDebugReason(error);
		if (
			debugReason === 'missing_access_token' ||
			debugReason === 'invalid_supabase_user' ||
			isUnauthorizedError(error)
		) {
			return GUEST_DASHBOARD_SESSION_INVALID_MESSAGE;
		}
	}
	return error instanceof Error ? error.message : fallback;
}

/**
 * Maps a successful events payload into a user-facing empty/mismatch message.
 * Call only after a 2xx listEvents response.
 */
export function resolveEventsLoadError(
	initialEventId: string,
	hostEvents: HostEventRef[],
	debug: DashboardEventListDebug | null | undefined,
): string {
	if (hostEvents.length === 0) {
		// Defensive: malformed debug claiming auth failure on a 200 response.
		if (debug != null && debug.session.reason !== 'session_role_resolved') {
			return GUEST_DASHBOARD_SESSION_INVALID_MESSAGE;
		}
		if (debug?.memberships.length && debug.unresolvedMembershipEventIds.length) {
			return GUEST_DASHBOARD_MEMBERSHIP_UNRESOLVED_MESSAGE;
		}
		if (debug?.requestedSlugCheck?.slugExistsInDb === false) {
			return `El evento ${debug.requestedSlugCheck.requestedSlug} no existe en la base activa. Revisa la sincronizacion de la tabla events.`;
		}
		if (debug?.requestedSlugCheck?.slugExistsInDb) {
			return GUEST_DASHBOARD_NO_OWNERSHIP_MESSAGE;
		}
		return GUEST_DASHBOARD_NO_EVENTS_MESSAGE;
	}

	if (initialEventId && !hostEvents.some((event) => event.id === initialEventId)) {
		return GUEST_DASHBOARD_EVENT_UNAVAILABLE_MESSAGE;
	}

	return '';
}
