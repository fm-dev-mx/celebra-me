/**
 * Rate limiting for administrative endpoints.
 */

import { checkRateLimit, hashIp } from '@/lib/rsvp/security/rate-limit-provider';
import { ApiError } from '@/lib/rsvp/core/errors';

interface RateLimitConfig {
	maxHits: number;
	windowSec: number;
}

// Limits by operation category. Keep keys explicit (not Record<string,...>) so
// missing registrations fail TypeScript at call sites.
const RATE_LIMITS = {
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
	'admin:user-membership': { maxHits: 10, windowSec: 60 }, // 10 req/min
	// Password resets are privileged credential mutations.
	'admin:users:reset_password': { maxHits: 5, windowSec: 60 }, // 5 req/min
	// Login-alias remaps are privileged credential mutations.
	'admin:users:update_login_alias': { maxHits: 5, windowSec: 60 }, // 5 req/min

	// Local-only observability dashboard (manual refresh, read-only probes).
	'admin:observabilidad': { maxHits: 6, windowSec: 60 }, // cached, manual refresh only

	// Claim code operations follow the same operational profile.
	'claimcodes:list': { maxHits: 60, windowSec: 60 },
	'claimcodes:create': { maxHits: 20, windowSec: 60 },
	'claimcodes:update': { maxHits: 30, windowSec: 60 },
	'claimcodes:delete': { maxHits: 10, windowSec: 60 },
	'claimcodes:validate': { maxHits: 30, windowSec: 60 },
	'intake:list': { maxHits: 60, windowSec: 60 },
	'intake:create': { maxHits: 20, windowSec: 60 },
	'intake:update': { maxHits: 30, windowSec: 60 },
	'intake:edit': { maxHits: 30, windowSec: 60 },
	'intake:assign-owner': { maxHits: 10, windowSec: 60 },
	'intake:request': { maxHits: 10, windowSec: 60 },
	'intake:regenerate': { maxHits: 5, windowSec: 60 },
	'intake:revoke': { maxHits: 5, windowSec: 60 },
	'intake:review': { maxHits: 20, windowSec: 60 },
	'intake:draft': { maxHits: 10, windowSec: 60 },
	'intake:publish': { maxHits: 5, windowSec: 60 },
	'intake:delete': { maxHits: 10, windowSec: 60 }, // 10 req/min
	'intake:captura': { maxHits: 30, windowSec: 60 },

	// Content Sync operations
	'admin:content-drift': { maxHits: 60, windowSec: 60 },
	'admin:content-drift-demo': { maxHits: 60, windowSec: 60 },
	'admin:demo-publish-dry-run': { maxHits: 30, windowSec: 60 },
	'admin:demo-publish-confirm': { maxHits: 5, windowSec: 60 },

	// Commercial / Sales Workspace
	'commercial:customers:create': { maxHits: 20, windowSec: 60 }, // 20 req/min
	'commercial:customers:search': { maxHits: 60, windowSec: 60 }, // 60 req/min
	'commercial:reconciliation:search': { maxHits: 60, windowSec: 60 }, // 60 req/min
	'commercial:orders:create': { maxHits: 20, windowSec: 60 }, // 20 req/min
	'commercial:orders:deposit-paid': { maxHits: 30, windowSec: 60 }, // 30 req/min
	'commercial:meta-conversions:process': { maxHits: 20, windowSec: 60 }, // 20 req/min
	'commercial:meta-conversions:requeue': { maxHits: 10, windowSec: 60 }, // 10 req/min
	'commercial:classifications:write': { maxHits: 20, windowSec: 60 }, // 20 req/min
} as const satisfies Record<string, RateLimitConfig>;

export type AdminRateLimitOperation = keyof typeof RATE_LIMITS;

/** Canonical registered admin rate-limit operation keys (for contract tests). */
export const ADMIN_RATE_LIMIT_OPERATIONS = Object.keys(RATE_LIMITS) as AdminRateLimitOperation[];

/**
 * Extracts the request IP while accounting for proxy headers.
 */
function extractClientIp(request: Request): string {
	// Vercel forwards the original IP through x-forwarded-for.
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0]!.trim();
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
	operation: AdminRateLimitOperation,
	userId?: string,
): Promise<void> {
	const config = RATE_LIMITS[operation];
	if (!config) {
		// Fail closed with a controlled API error (not an opaque 500 from Error).
		throw new ApiError(
			500,
			'internal_error',
			`Missing rate-limit configuration for operation: ${String(operation)}`,
		);
	}

	const ip = extractClientIp(request);

	// Prefer user-level throttling when a user id is available.
	const entityId = `${operation}:${userId || hashIp(ip)}`;

	const namespace = 'dashboard';

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
