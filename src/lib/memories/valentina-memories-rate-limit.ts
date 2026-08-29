import { VALENTINA_MEMORIES_APP_RATE_LIMITS } from '@/data/valentina-memories-media.contract';
import { ApiError } from '@/lib/rsvp/core/errors';
import { getIp } from '@/lib/rsvp/core/http';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';

export async function requireValentinaMemoryRateLimit(
	request: Request,
	operation: 'session' | 'recover' | 'register' | 'read' | 'mutate',
	entityId = 'anonymous',
): Promise<void> {
	const limits = VALENTINA_MEMORIES_APP_RATE_LIMITS[operation];
	const allowed = await checkRateLimit({
		namespace: 'rsvp-public',
		entityId: `valentina-memories:${operation}:${entityId}`,
		ip: entityId === 'anonymous' ? getIp(request) : undefined,
		maxHits: limits.maxHits,
		windowSec: limits.windowSec,
	});
	if (!allowed)
		throw new ApiError(
			429,
			'rate_limited',
			'Demasiadas solicitudes. Intente de nuevo más tarde.',
		);
}
