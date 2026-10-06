import { ApiError } from '@/lib/rsvp/core/errors';
import { isMemoriesUuid, type MemoriesSpaceRecord } from '@/lib/memories/contract/catalog';
import { type MemoriesGuestSession, getGuestSessionFromRequest } from './guest-session.service';
import { requireMemoriesRateLimit } from './rate-limit';
import { assertMemorySpaceAcceptsGuests, requirePublicMemorySpace } from './space.service';

export interface MemoriesGuestContext {
	space: MemoriesSpaceRecord;
	session: MemoriesGuestSession;
}

export function requireItemId(params: Record<string, string | undefined>): string {
	if (!isMemoriesUuid(params.itemId)) {
		throw new ApiError(400, 'bad_request', 'No se especificó el recuerdo.');
	}
	return params.itemId;
}

export function requireEventIdParam(params: Record<string, string | undefined>): string {
	if (!isMemoriesUuid(params.eventId)) {
		throw new ApiError(400, 'bad_request', 'No se especificó el evento.');
	}
	return params.eventId;
}

/** Resolves the space, then the guest session; throttles by session once known. */
export async function requireGuestContext(
	request: Request,
	params: Record<string, string | undefined>,
	operation: 'read' | 'mutate' | 'register' | 'thumbnail',
): Promise<MemoriesGuestContext> {
	const space = await requirePublicMemorySpace(params.slug);
	assertMemorySpaceAcceptsGuests(space);
	const session = await getGuestSessionFromRequest(space, request);
	if (!session) throw new ApiError(401, 'unauthorized', 'Inicie una sesión de recuerdos.');
	await requireMemoriesRateLimit(request, operation, session.id);
	return { space, session };
}
