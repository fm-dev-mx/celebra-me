import type {
	IntakeRequest,
	IntakeBlockType,
	CaptureLinkStatus,
	IntakeRequestOrigin,
} from '@/lib/intake/types';
import {
	findIntakeRequestById,
	findIntakeRequestByTokenHash,
	findIntakeRequestsByProjectId,
	createIntakeRequest,
	updateIntakeRequest,
} from '@/lib/intake/repositories/intake-request.repository';
import {
	decryptIntakeToken,
	encryptIntakeToken,
	generateIntakeToken,
	hashIntakeToken,
} from '@/lib/intake/services/intake-token.service';
import { getEnv } from '@/lib/server/env';
import { resolveSiteOrigin } from '@/lib/shared/origin';
import { ApiError } from '@/lib/rsvp/core/errors';

export interface CaptureLinkData {
	status: string;
	expiresAt: string | null;
	tokenCiphertext: string | null;
}

const DEFAULT_EXPIRY_DAYS = 30;

const CONFIG_ERROR_MESSAGE =
	'Error de configuración: la clave de encriptación no está configurada. Contacta al administrador del sistema.';

function requireEncryptionKey(): string {
	const key = getEnv('INTAKE_TOKEN_ENCRYPTION_KEY');
	if (!key) {
		throw new ApiError(500, 'config_error', CONFIG_ERROR_MESSAGE);
	}
	return key;
}

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
	origin?: IntakeRequestOrigin,
): Promise<IntakeRequest[]> {
	return findIntakeRequestsByProjectId(invitationProjectId, origin);
}

export async function createRequest(input: {
	invitationProjectId: string;
	enabledBlocks: IntakeBlockType[];
	expiresInDays?: number;
}): Promise<CreateIntakeRequestResult> {
	const encryptionKey = requireEncryptionKey();
	const rawToken = generateIntakeToken();
	const tokenHash = hashIntakeToken(rawToken);
	const tokenCiphertext = encryptIntakeToken(rawToken, encryptionKey);

	const expiresInDays = input.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + expiresInDays);

	const request = await createIntakeRequest({
		invitationProjectId: input.invitationProjectId,
		tokenHash,
		tokenCiphertext,
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
	const encryptionKey = requireEncryptionKey();
	const rawToken = generateIntakeToken();
	const tokenHash = hashIntakeToken(rawToken);
	const tokenCiphertext = encryptIntakeToken(rawToken, encryptionKey);

	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + DEFAULT_EXPIRY_DAYS);

	const request = await updateIntakeRequest(id, {
		tokenHash,
		tokenCiphertext,
		status: 'active',
		expiresAt: expiresAt.toISOString(),
	});

	return { request, rawToken };
}

export function resolveCaptureLink(
	request: CaptureLinkData | null,
	options?: { encryptionKey?: string; baseUrl?: string },
): {
	captureUrl: string | null;
	captureLinkStatus: CaptureLinkStatus;
} {
	if (!request) return { captureUrl: null, captureLinkStatus: 'missing' };
	if (request.status === 'closed') return { captureUrl: null, captureLinkStatus: 'revoked' };
	if (
		request.status === 'expired' ||
		(request.expiresAt !== null && new Date(request.expiresAt) < new Date())
	) {
		return { captureUrl: null, captureLinkStatus: 'expired' };
	}
	if (!request.tokenCiphertext) return { captureUrl: null, captureLinkStatus: 'unavailable' };

	const encryptionKey = options?.encryptionKey ?? getEnv('INTAKE_TOKEN_ENCRYPTION_KEY');
	if (!encryptionKey) {
		console.warn(
			'[intake] INTAKE_TOKEN_ENCRYPTION_KEY is not configured; capture links unavailable.',
		);
		return { captureUrl: null, captureLinkStatus: 'unavailable' };
	}
	const token = decryptIntakeToken(request.tokenCiphertext, encryptionKey);
	if (!token) return { captureUrl: null, captureLinkStatus: 'unavailable' };

	const baseUrl = resolveSiteOrigin({ baseUrl: options?.baseUrl });
	return {
		captureUrl: `${baseUrl}/captura/${token}`,
		captureLinkStatus: 'active',
	};
}
