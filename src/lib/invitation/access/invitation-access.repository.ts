/**
 * Server-only reads of `invitation_access_controls` (service role; the table has no
 * client grants). Writes go only through the `set_invitation_access_control` RPC.
 */

import { ApiError } from '@/lib/rsvp/core/errors';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	parseInvitationAccessRow,
	type InvitationAccessState,
} from '@/lib/invitation/access/invitation-access';

const ACCESS_EMBED = 'access:invitation_access_controls(payment_status,public_access)';

/** PostgREST embed fragment for `published_invitation_content` rows (one read). */
export const PUBLISHED_ACCESS_EMBED = `invitation:invitations(${ACCESS_EMBED})`;

/** Access state embedded under a published row's `invitation` relation, if any. */
export function readEmbeddedInvitationAccess(row: unknown): InvitationAccessState | null {
	if (!row || typeof row !== 'object') return null;
	const invitation = (row as { invitation?: unknown }).invitation;
	const candidate = Array.isArray(invitation) ? invitation[0] : invitation;
	if (!candidate || typeof candidate !== 'object') return null;
	return parseInvitationAccessRow((candidate as { access?: unknown }).access);
}

/**
 * Access state of the client invitation linked to an RSVP event, or null when the
 * event has no linked invitation (or no access row).
 */
export async function findEventInvitationAccess(
	eventId: string,
): Promise<InvitationAccessState | null> {
	const rows = await supabaseRestRequest<unknown[]>({
		pathWithQuery: `events?select=${PUBLISHED_ACCESS_EMBED}&id=eq.${encodeURIComponent(eventId)}&limit=1`,
		useServiceRole: true,
	});
	return Array.isArray(rows) ? readEmbeddedInvitationAccess(rows[0]) : null;
}

/** True only when the event's invitation is explicitly disabled by the administrator. */
export async function isEventInvitationDisabled(eventId: string): Promise<boolean> {
	const access = await findEventInvitationAccess(eventId);
	return access?.publicAccess === 'disabled';
}

/** Public API error for a disabled invitation; never names the reason to guests. */
export function invitationUnavailableError(): ApiError {
	return new ApiError(403, 'invitation_unavailable', 'Esta invitación no está disponible.');
}
