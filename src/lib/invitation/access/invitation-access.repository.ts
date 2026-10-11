/**
 * Server-only reads of `invitation_access_controls` (service role; the table has no
 * client grants). Writes go only through the `set_invitation_access_control` RPC.
 */

import { ApiError } from '@/lib/rsvp/core/errors';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	isInvitationPaymentStatus,
	isInvitationPublicAccess,
	parseInvitationAccessRow,
	type InvitationAccessState,
} from '@/lib/invitation/access/invitation-access';
import type { InvitationAccessRecord } from '@/lib/invitation/access/invitation-access-command';

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

const RECORD_COLUMNS =
	'invitation_id,payment_status,public_access,internal_note,version,updated_at,updated_by';

export interface InvitationAccessRow {
	invitation_id: string;
	payment_status: string;
	public_access: string;
	internal_note: string | null;
	version: number;
	updated_at: string;
	updated_by: string | null;
}

export function toInvitationAccessRecord(row: InvitationAccessRow): InvitationAccessRecord | null {
	if (
		!isInvitationPaymentStatus(row.payment_status) ||
		!isInvitationPublicAccess(row.public_access)
	) {
		return null;
	}
	return {
		invitationId: row.invitation_id,
		paymentStatus: row.payment_status,
		publicAccess: row.public_access,
		internalNote: row.internal_note,
		version: row.version,
		updatedAt: row.updated_at,
		updatedBy: row.updated_by,
	};
}

/** Administrator view of several invitations, keyed by invitation id (one read). */
export async function listInvitationAccessRecords(
	invitationIds: readonly string[],
): Promise<Map<string, InvitationAccessRecord>> {
	const records = new Map<string, InvitationAccessRecord>();
	if (invitationIds.length === 0) return records;
	const rows = await supabaseRestRequest<InvitationAccessRow[]>({
		pathWithQuery: `invitation_access_controls?select=${RECORD_COLUMNS}&invitation_id=in.(${invitationIds.map(encodeURIComponent).join(',')})`,
		useServiceRole: true,
	});
	for (const row of rows ?? []) {
		const record = toInvitationAccessRecord(row);
		if (record) records.set(record.invitationId, record);
	}
	return records;
}

export async function findInvitationAccessRecord(
	invitationId: string,
): Promise<InvitationAccessRecord | null> {
	const rows = await supabaseRestRequest<InvitationAccessRow[]>({
		pathWithQuery: `invitation_access_controls?select=${RECORD_COLUMNS}&invitation_id=eq.${encodeURIComponent(invitationId)}&limit=1`,
		useServiceRole: true,
	});
	return rows?.[0] ? toInvitationAccessRecord(rows[0]) : null;
}
