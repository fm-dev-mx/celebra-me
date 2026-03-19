import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { ClaimCodeRecord } from '@/lib/rsvp/core/types';
import { type ClaimCodeRow, toClaimCodeRecord } from '@/lib/rsvp/repositories/shared/rows';

export async function findClaimCodeRecordService(input: {
	eventId: string;
	codeHash: string;
}): Promise<{
	id: string;
	eventId: string;
	active: boolean;
	expiresAt: string | null;
	maxUses: number;
	usedCount: number;
} | null> {
	const rows = await supabaseRestRequest<ClaimCodeRow[]>({
		pathWithQuery: `event_claim_codes?select=id,event_id,active,expires_at,max_uses,used_count&event_id=eq.${encodeURIComponent(input.eventId)}&code_hash=eq.${encodeURIComponent(input.codeHash)}&limit=1`,
		useServiceRole: true,
	});

	if (!rows[0]) return null;
	return {
		id: rows[0].id,
		eventId: rows[0].event_id,
		active: rows[0].active,
		expiresAt: rows[0].expires_at,
		maxUses: rows[0].max_uses,
		usedCount: rows[0].used_count,
	};
}

export async function findClaimCodeRecordByKeyService(input: { codeKey: string }): Promise<{
	id: string;
	eventId: string;
	active: boolean;
	expiresAt: string | null;
	maxUses: number;
	usedCount: number;
} | null> {
	const rows = await supabaseRestRequest<ClaimCodeRow[]>({
		pathWithQuery: `event_claim_codes?select=id,event_id,active,expires_at,max_uses,used_count&code_key=eq.${encodeURIComponent(input.codeKey)}&limit=1`,
		useServiceRole: true,
	});

	if (!rows[0]) return null;
	return {
		id: rows[0].id,
		eventId: rows[0].event_id,
		active: rows[0].active,
		expiresAt: rows[0].expires_at,
		maxUses: rows[0].max_uses,
		usedCount: rows[0].used_count,
	};
}

export async function listClaimCodesService(input: {
	eventId?: string;
}): Promise<ClaimCodeRecord[]> {
	const eventFilter = input.eventId ? `&event_id=eq.${encodeURIComponent(input.eventId)}` : '';
	const rows = await supabaseRestRequest<ClaimCodeRow[]>({
		pathWithQuery: `event_claim_codes?select=*&order=created_at.desc${eventFilter}`,
		useServiceRole: true,
	});
	return rows.map(toClaimCodeRecord);
}

export async function findClaimCodeByIdService(
	claimCodeId: string,
): Promise<ClaimCodeRecord | null> {
	const rows = await supabaseRestRequest<ClaimCodeRow[]>({
		pathWithQuery: `event_claim_codes?select=*&id=eq.${encodeURIComponent(claimCodeId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toClaimCodeRecord(rows[0]) : null;
}

export async function createClaimCodeService(input: {
	eventId: string;
	codeHash: string;
	active: boolean;
	expiresAt: string | null;
	maxUses: number;
	usedCount: number;
	createdBy: string;
}): Promise<ClaimCodeRecord> {
	const rows = await supabaseRestRequest<ClaimCodeRow[]>({
		pathWithQuery: 'event_claim_codes?select=*',
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			event_id: input.eventId,
			code_hash: input.codeHash,
			code_key: input.codeHash,
			active: input.active,
			expires_at: input.expiresAt,
			max_uses: input.maxUses,
			used_count: input.usedCount,
			created_by: input.createdBy,
		},
	});
	if (!rows[0]) throw new Error('No se pudo crear claim code.');
	return toClaimCodeRecord(rows[0]);
}

export async function updateClaimCodeService(input: {
	claimCodeId: string;
	active?: boolean;
	expiresAt?: string | null;
	maxUses?: number;
}): Promise<ClaimCodeRecord> {
	const body: Record<string, unknown> = {};
	if (typeof input.active === 'boolean') body.active = input.active;
	if (input.expiresAt !== undefined) body.expires_at = input.expiresAt;
	if (typeof input.maxUses === 'number') body.max_uses = input.maxUses;

	const rows = await supabaseRestRequest<ClaimCodeRow[]>({
		pathWithQuery: `event_claim_codes?id=eq.${encodeURIComponent(input.claimCodeId)}&select=*`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});
	if (!rows[0]) throw new Error('No se pudo actualizar claim code.');
	return toClaimCodeRecord(rows[0]);
}

export async function disableClaimCodeService(claimCodeId: string): Promise<ClaimCodeRecord> {
	return updateClaimCodeService({ claimCodeId, active: false });
}

export async function incrementClaimCodeUsageService(
	claimCodeId: string,
	nextUsedCount: number,
): Promise<void> {
	await supabaseRestRequest<unknown[]>({
		pathWithQuery: `event_claim_codes?id=eq.${encodeURIComponent(claimCodeId)}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=minimal',
		body: {
			used_count: nextUsedCount,
		},
	});
}

export async function redeemClaimCodeRpc(input: { userId: string; codeKey: string }): Promise<{
	success: boolean;
	eventId: string | null;
	membershipRole: 'owner' | 'manager' | null;
	errorCode: string | null;
}> {
	try {
		const rows = await supabaseRestRequest<
			Array<{
				r_success: boolean;
				r_event_id: string | null;
				r_membership_role: string | null;
				r_error_code: string | null;
			}>
		>({
			pathWithQuery: 'rpc/redeem_claim_code',
			method: 'POST',
			useServiceRole: true,
			body: {
				p_user_id: input.userId,
				p_code_key: input.codeKey,
			},
		});

		const result = rows[0];
		if (!result) {
			console.error('[RedeemClaimCode] No response from RPC, rows:', rows);
			throw new Error(
				'No se recibio respuesta del RPC redeem_claim_code. La funcion puede no existir o estar mal configurada.',
			);
		}

		return {
			success: result.r_success,
			eventId: result.r_event_id,
			membershipRole: (result.r_membership_role as 'owner' | 'manager') || null,
			errorCode: result.r_error_code,
		};
	} catch (error) {
		console.error('[RedeemClaimCode] RPC call failed:', error);
		throw new Error(
			`Error al llamar a redeem_claim_code: ${error instanceof Error ? error.message : 'Error desconocido'}`,
		);
	}
}
