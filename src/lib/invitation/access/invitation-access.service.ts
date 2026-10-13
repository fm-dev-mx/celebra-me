/**
 * Administrator writes to an invitation's access state. The only write path is the
 * `set_invitation_access_control` RPC (version check, update and audit row in one
 * transaction); authorization happens in the admin route before this is called.
 */
import { ApiError } from '@/lib/rsvp/core/errors';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	toInvitationAccessRecord,
	type InvitationAccessRow,
} from '@/lib/invitation/access/invitation-access.repository';
import type {
	InvitationAccessCommand,
	InvitationAccessRecord,
} from '@/lib/invitation/access/invitation-access-command';

const ACCESS_RPC_ERRORS: Record<string, ApiError> = {
	invitation_access_stale: new ApiError(
		409,
		'conflict',
		'El estado de la invitación cambió. Recargue los datos e intente de nuevo.',
		{ reason: 'invitation_access_stale' },
	),
	invitation_access_not_found: new ApiError(
		404,
		'not_found',
		'La invitación no existe, está archivada o es una demostración.',
		{ reason: 'invitation_access_not_found' },
	),
	invitation_access_no_change: new ApiError(400, 'bad_request', 'No se indicó ningún cambio.', {
		reason: 'invitation_access_no_change',
	}),
	invitation_access_note_too_long: new ApiError(
		400,
		'validation_error',
		'La nota interna no puede exceder 280 caracteres.',
		{ reason: 'invitation_access_note_too_long' },
	),
};

function mapAccessRpcError(error: unknown): never {
	const raw = error instanceof Error ? error.message : String(error);
	for (const [reason, mapped] of Object.entries(ACCESS_RPC_ERRORS)) {
		if (raw.includes(reason)) {
			throw new ApiError(mapped.status, mapped.code, mapped.message, mapped.details);
		}
	}
	throw error;
}

export async function setInvitationAccessControl(input: {
	invitationId: string;
	actorId: string;
	command: InvitationAccessCommand;
}): Promise<InvitationAccessRecord> {
	const { command } = input;
	let row: InvitationAccessRow;
	try {
		row = await supabaseRestRequest<InvitationAccessRow>({
			pathWithQuery: 'rpc/set_invitation_access_control',
			method: 'POST',
			useServiceRole: true,
			body: {
				p_invitation_id: input.invitationId,
				p_expected_version: command.expectedVersion,
				p_actor_id: input.actorId,
				p_payment_status:
					command.action === 'set_payment_status' ? command.paymentStatus : null,
				p_public_access:
					command.action === 'set_public_access' ? command.publicAccess : null,
				p_internal_note:
					command.action === 'set_public_access'
						? (command.internalNote ?? null) || null
						: null,
			},
		});
	} catch (error) {
		mapAccessRpcError(error);
	}
	const record = row ? toInvitationAccessRecord(row) : null;
	if (!record) {
		throw new ApiError(502, 'upstream_error', 'La base de datos devolvió un estado inválido.');
	}
	return record;
}
