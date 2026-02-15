import { createHash } from 'node:crypto';
import { getEnv } from '@/utils/env';

interface RateLimitBackend {
	allow(key: string, maxHits: number, windowSec: number): Promise<boolean>;
}

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

class UpstashRestBackend implements RateLimitBackend {
	constructor(
		private readonly baseUrl: string,
		private readonly token: string,
	) {}

	private async command(path: string): Promise<unknown> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			headers: {
				Authorization: `Bearer ${this.token}`,
			},
		});

		if (!response.ok) {
			throw new Error(`Upstash rate limit error (${response.status}).`);
		}

		return response.json();
	}

	async allow(key: string, maxHits: number, windowSec: number): Promise<boolean> {
		const incrRaw = (await this.command(`/incr/${encodeURIComponent(key)}`)) as {
			result?: number;
		};
		const count = Number(incrRaw?.result ?? 0);
		if (count <= 1) {
			await this.command(`/expire/${encodeURIComponent(key)}/${windowSec}`);
		}
		return count <= maxHits;
	}
}

let cachedBackend: RateLimitBackend | null = null;

function resolveBackend(): RateLimitBackend {
	if (cachedBackend) return cachedBackend;

	const url = getEnv('UPSTASH_REDIS_REST_URL');
	const token = getEnv('UPSTASH_REDIS_REST_TOKEN');
	const distributedEnabled = getEnv('RSVP_V2_DISTRIBUTED_RATELIMIT') === 'true';

	if (distributedEnabled && url && token) {
		cachedBackend = new UpstashRestBackend(url.replace(/\/+$/, ''), token);
		return cachedBackend;
	}

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
	namespace: 'ctx' | 'view' | 'rsvp' | 'dashboard';
	entityId: string;
	ip: string;
	maxHits: number;
	windowSec: number;
}): Promise<boolean> {
	const key = `${input.namespace}:${input.entityId}:${hashIp(input.ip)}`;
	return resolveBackend().allow(key, input.maxHits, input.windowSec);
}

export function resetRateLimitProviderForTests(): void {
	cachedBackend = null;
}
