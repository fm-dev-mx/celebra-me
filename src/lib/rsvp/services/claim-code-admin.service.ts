import {
	createClaimCodeService,
	disableClaimCodeService,
	findClaimCodeByIdService,
} from '@/lib/rsvp/repositories/claim-code.repository';
import {
	findClaimCodeRecordByKeyService,
	listClaimCodesService,
	updateClaimCodeService,
} from '@/lib/rsvp/repositories/claim-code.repository';
import type { ClaimCodeDTO, ClaimCodeStatus } from '@/lib/rsvp/core/types';
import { ApiError } from '@/lib/rsvp/core/errors';
import { normalizeClaimCode } from '@/lib/rsvp/services/auth-access.service';
import { createHash, randomBytes } from 'node:crypto';
import { getEnv } from '@utils/env';
import { sanitize } from '@/lib/rsvp/core/utils';

function hashClaimCode(rawCode: string): string {
	const pepper = getEnv('RSVP_CLAIM_CODE_PEPPER') || 'default-pepper';
	return createHash('sha256')
		.update(`${pepper}:${normalizeClaimCode(rawCode)}`)
		.digest('hex');
}

function toClaimCodeStatus(input: {
	active: boolean;
	expiresAt: string | null;
	usedCount: number;
	maxUses: number;
}): ClaimCodeStatus {
	if (!input.active) return 'disabled';
	if (input.expiresAt && new Date(input.expiresAt).getTime() < Date.now()) return 'expired';
	if (input.usedCount >= input.maxUses) return 'exhausted';
	return 'active';
}

function toClaimCodeDto(input: {
	id: string;
	eventId: string;
	active: boolean;
	expiresAt: string | null;
	maxUses: number;
	usedCount: number;
	createdBy: string | null;
	createdAt: string;
	updatedAt: string;
}): ClaimCodeDTO {
	return {
		id: input.id,
		eventId: input.eventId,
		active: input.active,
		expiresAt: input.expiresAt,
		maxUses: input.maxUses,
		usedCount: input.usedCount,
		createdBy: input.createdBy,
		createdAt: input.createdAt,
		updatedAt: input.updatedAt,
		status: toClaimCodeStatus(input),
	};
}

function generateClaimCode(length = 12): string {
	return randomBytes(length)
		.toString('base64url')
		.replace(/[^A-Za-z0-9]/g, '')
		.slice(0, length);
}

export async function listClaimCodesAdmin(input: { eventId?: string }): Promise<ClaimCodeDTO[]> {
	const items = await listClaimCodesService({
		eventId: sanitize(input.eventId, 120) || undefined,
	});
	return items.map(toClaimCodeDto);
}

export async function createClaimCodeAdmin(input: {
	eventId: string;
	createdBy: string;
	expiresAt?: string | null;
	maxUses?: number;
}): Promise<{ plainCode: string; item: ClaimCodeDTO }> {
	const eventId = sanitize(input.eventId, 120);
	if (!eventId) throw new ApiError(400, 'bad_request', 'eventId es obligatorio.');

	const plainCode = generateClaimCode(14);
	const maxUses = Math.max(1, Math.min(10000, Math.trunc(input.maxUses ?? 1)));
	const expiresAt = input.expiresAt ? new Date(input.expiresAt).toISOString() : null;
	const created = await createClaimCodeService({
		eventId,
		codeHash: hashClaimCode(plainCode),
		active: true,
		expiresAt,
		maxUses,
		usedCount: 0,
		createdBy: sanitize(input.createdBy, 120),
	});

	return {
		plainCode,
		item: toClaimCodeDto(created),
	};
}

export async function updateClaimCodeAdmin(input: {
	claimCodeId: string;
	active?: boolean;
	expiresAt?: string | null;
	maxUses?: number;
}): Promise<ClaimCodeDTO> {
	const claimCodeId = sanitize(input.claimCodeId, 120);
	if (!claimCodeId) throw new ApiError(400, 'bad_request', 'claimCodeId es obligatorio.');

	const existing = await findClaimCodeByIdService(claimCodeId);
	if (!existing) throw new ApiError(404, 'not_found', 'Claim code no encontrado.');

	const updated = await updateClaimCodeService({
		claimCodeId,
		active: typeof input.active === 'boolean' ? input.active : undefined,
		expiresAt: input.expiresAt !== undefined ? input.expiresAt : undefined,
		maxUses:
			typeof input.maxUses === 'number'
				? Math.max(1, Math.min(10000, Math.trunc(input.maxUses)))
				: undefined,
	});
	return toClaimCodeDto(updated);
}

export async function disableClaimCodeAdmin(input: { claimCodeId: string }): Promise<ClaimCodeDTO> {
	const claimCodeId = sanitize(input.claimCodeId, 120);
	if (!claimCodeId) throw new ApiError(400, 'bad_request', 'claimCodeId es obligatorio.');

	const updated = await disableClaimCodeService(claimCodeId);
	return toClaimCodeDto(updated);
}

export async function validateClaimCodeAdmin(input: { claimCode: string }): Promise<ClaimCodeDTO> {
	const claim = await findClaimCodeRecordByKeyService({
		codeKey: hashClaimCode(input.claimCode),
	});
	if (!claim) throw new ApiError(404, 'not_found', 'Claim code no encontrado.');

	return toClaimCodeDto({
		id: claim.id,
		eventId: claim.eventId,
		active: claim.active,
		expiresAt: claim.expiresAt,
		maxUses: claim.maxUses,
		usedCount: claim.usedCount,
		createdBy: null,
		createdAt: '',
		updatedAt: '',
	});
}
