import { ApiError } from '@/lib/rsvp/core/errors';
import { getIp } from '@/lib/rsvp/core/http';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import {
	MEMORIES_APP_RATE_LIMITS,
	type MemoriesRateLimitOperation,
} from '@/lib/memories/contract/limits';

/**
 * Anonymous operations are keyed by IP; everything else by the authenticated
 * entity (guest session or dashboard user) so shared venue Wi-Fi never throttles
 * a whole party.
 */
export async function requireMemoriesRateLimit(
	request: Request,
	operation: MemoriesRateLimitOperation,
	entityId?: string,
): Promise<void> {
	const limits = MEMORIES_APP_RATE_LIMITS[operation];
	const allowed = await checkRateLimit({
		namespace: 'memories',
		entityId: `${operation}:${entityId ?? 'anonymous'}`,
		ip: entityId ? undefined : getIp(request),
		maxHits: limits.maxHits,
		windowSec: limits.windowSec,
	});
	if (!allowed) {
		throw new ApiError(
			429,
			'rate_limited',
			'Demasiadas solicitudes. Intente de nuevo más tarde.',
		);
	}
}
