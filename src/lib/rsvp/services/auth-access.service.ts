import {
	findUserRoleService,
	listMembershipsForHost,
	upsertUserRoleService,
} from '@/lib/rsvp/repositories/role-membership.repository';
import { redeemClaimCodeRpc } from '@/lib/rsvp/repositories/claim-code.repository';
import { ApiError } from '@/lib/rsvp/core/errors';
import { createHash } from 'node:crypto';
import { getEnv } from '@/lib/server/env';
import { sanitize } from '@/lib/rsvp/core/utils';

function hashClaimCode(rawCode: string): string {
	const pepper = getEnv('RSVP_CLAIM_CODE_PEPPER') || 'default-pepper';
	return createHash('sha256')
		.update(`${pepper}:${normalizeClaimCode(rawCode)}`)
		.digest('hex');
}

export function normalizeClaimCode(rawCode: string): string {
	return sanitize(rawCode, 256).toLowerCase();
}

export function isSuperAdminEmail(email: string): boolean {
	const allowlist = (getEnv('SUPER_ADMIN_EMAILS') || '')
		.split(',')
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
	if (allowlist.length === 0) return false;
	return allowlist.includes(sanitize(email, 320).toLowerCase());
}

export async function ensureUserRole(input: {
	userId: string;
	email: string;
	defaultRole?: 'host_client' | 'super_admin';
}): Promise<'host_client' | 'super_admin'> {
	const existing = await findUserRoleService(input.userId);
	if (existing) return existing.role;

	const nextRole = isSuperAdminEmail(input.email)
		? 'super_admin'
		: (input.defaultRole ?? 'host_client');
	const upserted = await upsertUserRoleService({
		userId: input.userId,
		role: nextRole,
	});
	return upserted.role;
}

export async function claimEventForUser(input: {
	userId: string;
	eventSlug: string;
	claimCode: string;
}): Promise<{ eventId: string; membershipRole: 'owner' | 'manager' }> {
	void sanitize(input.eventSlug, 120);
	return claimEventForUserByClaimCode({
		userId: input.userId,
		claimCode: input.claimCode,
	});
}

export async function claimEventForUserByClaimCode(input: {
	userId: string;
	claimCode: string;
}): Promise<{ eventId: string; membershipRole: 'owner' | 'manager' }> {
	const result = await redeemClaimCodeRpc({
		userId: input.userId,
		codeKey: hashClaimCode(input.claimCode),
	});

	if (!result.success) {
		const errorMessages: Record<string, string> = {
			invalid_code: 'Claim code is invalid.',
			inactive: 'Claim code is inactive.',
			expired: 'Claim code has expired.',
			exhausted: 'Claim code has been exhausted.',
		};
		throw new ApiError(
			403,
			'forbidden',
			errorMessages[result.errorCode || ''] || 'Failed to redeem the claim code.',
		);
	}

	if (!result.eventId) {
		throw new ApiError(500, 'internal_error', 'Unexpected error: event_id was not returned.');
	}

	return {
		eventId: result.eventId,
		membershipRole: result.membershipRole || 'owner',
	};
}

export async function buildAuthSessionDto(input: {
	userId: string;
	email: string;
	accessToken: string;
}): Promise<{
	userId: string;
	email: string;
	role: 'host_client' | 'super_admin' | null;
	isSuperAdmin: boolean;
	memberships: Array<{
		id: string;
		eventId: string;
		userId: string;
		membershipRole: 'owner' | 'manager';
		createdAt: string;
		updatedAt: string;
	}>;
}> {
	const role = await ensureUserRole({
		userId: input.userId,
		email: input.email,
		defaultRole: 'host_client',
	});
	const memberships = await listMembershipsForHost(input.accessToken);
	return {
		userId: input.userId,
		email: sanitize(input.email, 320),
		role,
		isSuperAdmin: role === 'super_admin',
		memberships,
	};
}
