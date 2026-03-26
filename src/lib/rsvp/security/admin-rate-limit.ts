/**
 * Rate limiting for administrative endpoints.
 */

import { checkRateLimit, hashIp } from '@/lib/rsvp/security/rate-limit-provider';
import { ApiError } from '@/lib/rsvp/core/errors';

interface RateLimitConfig {
	maxHits: number;
	windowSec: number;
}

// Limits by operation category.
const RATE_LIMITS: Record<string, RateLimitConfig> = {
	// Listing operations are the least restrictive.
	'admin:list': { maxHits: 60, windowSec: 60 }, // 60 req/min

	// Create operations are moderately restricted.
	'admin:create': { maxHits: 20, windowSec: 60 }, // 20 req/min

	// Update operations are moderately restricted.
	'admin:update': { maxHits: 30, windowSec: 60 }, // 30 req/min

	// Delete operations are intentionally tighter.
	'admin:delete': { maxHits: 10, windowSec: 60 }, // 10 req/min

	// Role changes are the most sensitive mutation.
	'admin:role': { maxHits: 5, windowSec: 60 }, // 5 req/min

	// Claim code operations follow the same operational profile.
	'claimcodes:list': { maxHits: 60, windowSec: 60 },
	'claimcodes:create': { maxHits: 20, windowSec: 60 },
	'claimcodes:update': { maxHits: 30, windowSec: 60 },
	'claimcodes:delete': { maxHits: 10, windowSec: 60 },
	'claimcodes:validate': { maxHits: 30, windowSec: 60 },
};

/**
 * Extracts the request IP while accounting for proxy headers.
 */
function extractClientIp(request: Request): string {
	// Vercel forwards the original IP through x-forwarded-for.
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}

	const realIp = request.headers.get('x-real-ip');
	if (realIp) {
		return realIp;
	}

	// Fallback when no trusted IP header is present.
	return 'unknown';
}

/**
 * Applies rate limiting to an administrative operation.
 */
export async function requireAdminRateLimit(
	request: Request,
	operation: keyof typeof RATE_LIMITS,
	userId?: string,
): Promise<void> {
	const config = RATE_LIMITS[operation];
	if (!config) {
		throw new Error(`Missing rate-limit configuration for operation: ${operation}`);
	}

	const ip = extractClientIp(request);

	// Prefer user-level throttling when a user id is available.
	const entityId = userId || hashIp(ip);

	// Operations currently share the same dashboard namespace.
	const namespace = operation.startsWith('claimcodes:') ? 'dashboard' : 'dashboard';

	const allowed = await checkRateLimit({
		namespace,
		entityId,
		ip,
		maxHits: config.maxHits,
		windowSec: config.windowSec,
	});

	if (!allowed) {
		throw new ApiError(
			429,
			'rate_limited',
			`Too many requests. Wait ${config.windowSec} seconds before retrying.`,
		);
	}
}

/**
 * Default export for route-level admin throttling.
 */
export { requireAdminRateLimit as default };
