import { createHash } from 'node:crypto';

interface RateLimitBackend {
	allow(key: string, maxHits: number, windowSec: number): Promise<boolean>;
}

/**
 * Per-instance in-memory buckets. Hosted deployments share nothing between
 * instances until the runtime exposes a distributed rate-limit binding.
 */
class InMemoryBackend implements RateLimitBackend {
	private readonly buckets = new Map<string, { count: number; resetAt: number }>();

	async allow(key: string, maxHits: number, windowSec: number): Promise<boolean> {
		const now = Date.now();
		const current = this.buckets.get(key);
		if (!current || current.resetAt <= now) {
			this.buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
			return true;
		}

		if (current.count >= maxHits) return false;
		current.count += 1;
		this.buckets.set(key, current);
		return true;
	}
}

let cachedBackend: RateLimitBackend | null = null;

function resolveBackend(): RateLimitBackend {
	if (cachedBackend) return cachedBackend;
	cachedBackend = new InMemoryBackend();
	return cachedBackend;
}

export function hashIp(ip: string): string {
	return createHash('sha256')
		.update(ip || 'unknown')
		.digest('hex')
		.slice(0, 16);
}

export async function checkRateLimit(input: {
	namespace:
		| 'ctx'
		| 'view'
		| 'rsvp'
		| 'rsvp-public'
		| 'dashboard'
		| 'auth'
		| 'tracking'
		| 'memories'
		| 'engagement';
	entityId: string;
	ip?: string;
	maxHits: number;
	windowSec: number;
}): Promise<boolean> {
	const key = input.ip
		? `${input.namespace}:${input.entityId}:${hashIp(input.ip)}`
		: `${input.namespace}:${input.entityId}`;
	return resolveBackend().allow(key, input.maxHits, input.windowSec);
}

export function resetRateLimitProviderForTests(): void {
	cachedBackend = null;
}
