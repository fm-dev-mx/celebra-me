import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { GuestInvitationAuditRecord } from '@/interfaces/rsvp/domain.interface';
import { type GuestAuditRow, toGuestAuditRecord } from '@/lib/rsvp/repositories/shared/rows';

export async function appendGuestAuditByHost(
	guestId: string,
	eventType: GuestAuditRow['event_type'],
	payload: Record<string, unknown>,
	hostAccessToken: string,
): Promise<void> {
	await supabaseRestRequest<GuestAuditRow[]>({
		pathWithQuery: 'guest_invitation_audit',
		method: 'POST',
		authToken: hostAccessToken,
		prefer: 'return=minimal',
		body: {
			guest_invitation_id: guestId,
			actor_type: 'host',
			event_type: eventType,
			payload,
		},
	});
}

export async function appendGuestAuditPublic(
	guestInvitationId: string,
	eventType: GuestAuditRow['event_type'],
	payload: Record<string, unknown>,
	actorType: GuestAuditRow['actor_type'] = 'guest',
): Promise<GuestInvitationAuditRecord> {
	const rows = await supabaseRestRequest<GuestAuditRow[]>({
		pathWithQuery:
			'guest_invitation_audit?select=id,guest_invitation_id,actor_type,event_type,payload,created_at',
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			guest_invitation_id: guestInvitationId,
			actor_type: actorType,
			event_type: eventType,
			payload,
		},
	});
	if (!rows[0]) throw new Error('No se pudo registrar auditoría.');
	return toGuestAuditRecord(rows[0]);
}

export async function createAuditLog(input: {
	actorId: string | null;
	action: string;
	targetTable: string;
	targetId: string;
	oldData?: Record<string, unknown> | null;
	newData?: Record<string, unknown> | null;
	useServiceRole?: boolean;
}): Promise<void> {
	await supabaseRestRequest<unknown[]>({
		pathWithQuery: 'audit_logs',
		method: 'POST',
		useServiceRole: input.useServiceRole ?? true,
		prefer: 'return=minimal',
		body: {
			actor_id: input.actorId,
			action: input.action,
			target_table: input.targetTable,
			target_id: input.targetId,
			old_data: input.oldData,
			new_data: input.newData,
		},
	});
}
