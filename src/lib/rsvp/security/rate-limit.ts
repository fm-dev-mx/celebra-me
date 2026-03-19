/**
 * @deprecated Use `checkRateLimit` from `rateLimitProvider.ts`.
 * This shim remains for one transition cycle and mirrors the prior signature.
 */
import { checkRateLimit as checkRateLimitProvider } from '@/lib/rsvp/security/rate-limit-provider';

export async function checkRateLimit(
	key: string,
	maxHits: number,
	windowMs: number,
): Promise<boolean> {
	const [namespaceRaw, entityRaw, ipRaw] = key.split(':');
	const namespace =
		namespaceRaw === 'view' || namespaceRaw === 'rsvp' || namespaceRaw === 'dashboard'
			? namespaceRaw
			: 'ctx';
	const entityId = entityRaw || 'legacy';
	const ip = ipRaw || 'unknown';
	return checkRateLimitProvider({
		namespace,
		entityId,
		ip,
		maxHits,
		windowSec: Math.max(1, Math.trunc(windowMs / 1000)),
	});
}
