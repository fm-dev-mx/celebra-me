import type { IntakeRequest, IntakeBlockType } from '@/lib/intake/types';
import {
	findIntakeRequestById,
	findIntakeRequestByTokenHash,
	findIntakeRequestsByProjectId,
	createIntakeRequest,
	updateIntakeRequest,
} from '@/lib/intake/repositories/intake-request.repository';
import { generateIntakeToken, hashIntakeToken } from '@/lib/intake/services/intake-token.service';

const DEFAULT_EXPIRY_DAYS = 30;

export interface CreateIntakeRequestResult {
	request: IntakeRequest;
	rawToken: string;
}

export async function getIntakeRequestById(id: string): Promise<IntakeRequest | null> {
	return findIntakeRequestById(id);
}

export async function getIntakeRequestByToken(rawToken: string): Promise<IntakeRequest | null> {
	const tokenHash = hashIntakeToken(rawToken);
	return findIntakeRequestByTokenHash(tokenHash);
}

export async function getIntakeRequestsByProjectId(
	invitationProjectId: string,
): Promise<IntakeRequest[]> {
	return findIntakeRequestsByProjectId(invitationProjectId);
}

export async function createRequest(input: {
	invitationProjectId: string;
	enabledBlocks: IntakeBlockType[];
	expiresInDays?: number;
}): Promise<CreateIntakeRequestResult> {
	const rawToken = generateIntakeToken();
	const tokenHash = hashIntakeToken(rawToken);

	const expiresInDays = input.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + expiresInDays);

	const request = await createIntakeRequest({
		invitationProjectId: input.invitationProjectId,
		tokenHash,
		enabledBlocks: input.enabledBlocks,
		expiresAt: expiresAt.toISOString(),
	});

	return { request, rawToken };
}

export async function updateRequest(
	id: string,
	input: {
		status?: string;
		enabledBlocks?: IntakeBlockType[];
		expiresAt?: string | null;
	},
): Promise<IntakeRequest> {
	return updateIntakeRequest(id, input);
}

export async function revokeRequest(id: string): Promise<IntakeRequest> {
	return updateIntakeRequest(id, { status: 'closed' });
}

export async function regenerateToken(id: string): Promise<CreateIntakeRequestResult> {
	const rawToken = generateIntakeToken();
	const tokenHash = hashIntakeToken(rawToken);

	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + DEFAULT_EXPIRY_DAYS);

	const request = await updateIntakeRequest(id, {
		tokenHash,
		status: 'active',
		expiresAt: expiresAt.toISOString(),
	});

	return { request, rawToken };
}
