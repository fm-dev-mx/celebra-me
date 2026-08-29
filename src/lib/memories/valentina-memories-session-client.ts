import type { ValentinaMemoriesGuestProfile } from '@/data/valentina-memories-media.contract';

export const VALENTINA_MEMORIES_SESSION_ENDPOINT = '/api/memories/valentina/session' as const;

export type ValentinaMemoriesSessionResponse = {
	profile: ValentinaMemoriesGuestProfile | null;
};

export type ValentinaMemoriesSessionCreateResponse = {
	profile: ValentinaMemoriesGuestProfile;
	recoveryCode: string | null;
};

export class ValentinaMemoriesSessionRequestError extends Error {
	readonly status: number | null;

	constructor(status: number | null) {
		super('valentina_memories_session_request_failed');
		this.name = 'ValentinaMemoriesSessionRequestError';
		this.status = status;
	}
}

async function requestSession(init?: RequestInit): Promise<Record<string, unknown>> {
	let response: Response;
	try {
		response = await fetch(VALENTINA_MEMORIES_SESSION_ENDPOINT, {
			...init,
			headers: {
				Accept: 'application/json',
				...(init?.body ? { 'Content-Type': 'application/json' } : {}),
				...init?.headers,
			},
		});
	} catch {
		throw new ValentinaMemoriesSessionRequestError(null);
	}

	const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
	if (!response.ok || !payload) throw new ValentinaMemoriesSessionRequestError(response.status);
	return payload;
}

function readProfile(payload: Record<string, unknown>): ValentinaMemoriesGuestProfile | null {
	const candidate = payload.profile;
	if (candidate === null) return null;
	if (typeof candidate !== 'object' || candidate === null) {
		throw new ValentinaMemoriesSessionRequestError(null);
	}
	const profile = candidate as Record<string, unknown>;
	if (typeof profile.displayName !== 'string' || typeof profile.expiresAt !== 'string') {
		throw new ValentinaMemoriesSessionRequestError(null);
	}
	return { displayName: profile.displayName, expiresAt: profile.expiresAt };
}

export async function getValentinaMemoriesSession(): Promise<ValentinaMemoriesSessionResponse> {
	const payload = await requestSession();
	return { profile: readProfile(payload) };
}

export async function createValentinaMemoriesSession(
	displayName: string,
): Promise<ValentinaMemoriesSessionCreateResponse> {
	const payload = await requestSession({
		method: 'POST',
		body: JSON.stringify({ action: 'create', displayName }),
	});
	const profile = readProfile(payload);
	if (!profile) throw new ValentinaMemoriesSessionRequestError(null);
	return {
		profile,
		recoveryCode: typeof payload.recoveryCode === 'string' ? payload.recoveryCode : null,
	};
}

export async function updateValentinaMemoriesSession(
	displayName: string,
): Promise<ValentinaMemoriesGuestProfile> {
	const payload = await requestSession({
		method: 'PATCH',
		body: JSON.stringify({ displayName }),
	});
	const profile = readProfile(payload);
	if (!profile) throw new ValentinaMemoriesSessionRequestError(null);
	return profile;
}

export async function recoverValentinaMemoriesSession(
	recoveryCode: string,
): Promise<ValentinaMemoriesGuestProfile> {
	const payload = await requestSession({
		method: 'POST',
		body: JSON.stringify({ action: 'recover', recoveryCode }),
	});
	const profile = readProfile(payload);
	if (!profile) throw new ValentinaMemoriesSessionRequestError(null);
	return profile;
}
