import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { IntakeRequest, IntakeBlockType, IntakeRequestOrigin } from '@/lib/intake/types';
import { ACTIVE_FILTER } from '@/lib/intake/repositories/_constants';

interface IntakeRequestRow {
	id: string;
	invitation_project_id: string;
	token_hash: string;
	token_ciphertext: string | null;
	origin: IntakeRequestOrigin;
	status: string;
	enabled_blocks: IntakeBlockType[];
	expires_at: string | null;
	created_at: string;
	updated_at: string;
}

function toIntakeRequest(row: IntakeRequestRow): IntakeRequest {
	return {
		id: row.id,
		invitationProjectId: row.invitation_project_id,
		tokenHash: row.token_hash,
		tokenCiphertext: row.token_ciphertext,
		origin: row.origin,
		status: row.status as IntakeRequest['status'],
		enabledBlocks: row.enabled_blocks,
		expiresAt: row.expires_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

const SELECT_COLUMNS =
	'id,invitation_project_id,token_hash,token_ciphertext,origin,status,enabled_blocks,expires_at,created_at,updated_at';

export async function findIntakeRequestById(id: string): Promise<IntakeRequest | null> {
	const rows = await supabaseRestRequest<IntakeRequestRow[]>({
		pathWithQuery: `intake_requests?select=${SELECT_COLUMNS}&id=eq.${encodeURIComponent(id)}&${ACTIVE_FILTER}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toIntakeRequest(rows[0]) : null;
}

export async function findIntakeRequestByTokenHash(
	tokenHash: string,
): Promise<IntakeRequest | null> {
	const rows = await supabaseRestRequest<IntakeRequestRow[]>({
		pathWithQuery: `intake_requests?select=${SELECT_COLUMNS}&token_hash=eq.${encodeURIComponent(tokenHash)}&${ACTIVE_FILTER}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toIntakeRequest(rows[0]) : null;
}

export async function findIntakeRequestsByProjectId(
	invitationProjectId: string,
	origin?: IntakeRequestOrigin,
): Promise<IntakeRequest[]> {
	const originFilter = origin ? `&origin=eq.${origin}` : '';
	const rows = await supabaseRestRequest<IntakeRequestRow[]>({
		pathWithQuery: `intake_requests?select=${SELECT_COLUMNS}&invitation_project_id=eq.${encodeURIComponent(invitationProjectId)}${originFilter}&${ACTIVE_FILTER}&order=created_at.desc`,
		useServiceRole: true,
	});
	return rows.map(toIntakeRequest);
}

export async function createIntakeRequest(input: {
	invitationProjectId: string;
	tokenHash: string;
	tokenCiphertext: string | null;
	origin?: IntakeRequestOrigin;
	enabledBlocks: IntakeBlockType[];
	expiresAt: string | null;
}): Promise<IntakeRequest> {
	const rows = await supabaseRestRequest<IntakeRequestRow[]>({
		pathWithQuery: `intake_requests?select=${SELECT_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			invitation_project_id: input.invitationProjectId,
			token_hash: input.tokenHash,
			token_ciphertext: input.tokenCiphertext,
			origin: input.origin ?? 'client',
			enabled_blocks: input.enabledBlocks,
			expires_at: input.expiresAt,
			status: 'active',
		},
	});

	if (!rows[0]) throw new Error('Failed to create intake request.');
	return toIntakeRequest(rows[0]);
}

export async function updateIntakeRequest(
	id: string,
	input: {
		status?: string;
		enabledBlocks?: IntakeBlockType[];
		expiresAt?: string | null;
		tokenHash?: string;
		tokenCiphertext?: string;
	},
): Promise<IntakeRequest> {
	const body: Record<string, unknown> = {};
	if (input.status !== undefined) body.status = input.status;
	if (input.enabledBlocks !== undefined) body.enabled_blocks = input.enabledBlocks;
	if (input.expiresAt !== undefined) body.expires_at = input.expiresAt;
	if (input.tokenHash !== undefined) body.token_hash = input.tokenHash;
	if (input.tokenCiphertext !== undefined) body.token_ciphertext = input.tokenCiphertext;

	const rows = await supabaseRestRequest<IntakeRequestRow[]>({
		pathWithQuery: `intake_requests?id=eq.${encodeURIComponent(id)}&select=${SELECT_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});

	if (!rows[0]) throw new Error('Intake request not found.');
	return toIntakeRequest(rows[0]);
}
