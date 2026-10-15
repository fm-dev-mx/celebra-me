import { createHash } from 'node:crypto';

export type RateLimitNamespace =
	| 'ctx'
	| 'view'
	| 'rsvp'
	| 'rsvp-public'
	| 'dashboard'
	| 'auth'
	| 'tracking'
	| 'memories'
	| 'engagement';

interface RateLimitRequest {
	namespace: RateLimitNamespace;
	key: string;
	maxHits: number;
	windowSec: number;
}

interface RateLimitBackend {
	allow(request: RateLimitRequest): Promise<boolean>;
}

/**
 * Cloudflare Workers rate limiting binding (`ratelimits` in `wrangler.jsonc`).
 * Each binding carries one fixed limit and period, so the app declares one per
 * `(namespace, maxHits, windowSec)` combination it uses.
 */
interface RateLimiterBinding {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

const BINDING_PREFIX = 'RATE_LIMIT_';

/** `RATE_LIMIT_<NAMESPACE>_<MAX_HITS>_<WINDOW_SEC>`, e.g. `RATE_LIMIT_RSVP_PUBLIC_10_60`. */
export function rateLimitBindingName(
	namespace: RateLimitNamespace,
	maxHits: number,
	windowSec: number,
): string {
	return `${BINDING_PREFIX}${namespace.toUpperCase().replace(/-/g, '_')}_${maxHits}_${windowSec}`;
}

/**
 * Per-instance in-memory buckets. Without a distributed binding, hosted
 * instances share nothing, so a limit only holds per isolate.
 */
class InMemoryBackend implements RateLimitBackend {
	private readonly buckets = new Map<string, { count: number; resetAt: number }>();

	async allow(request: RateLimitRequest): Promise<boolean> {
		const now = Date.now();
		const current = this.buckets.get(request.key);
		if (!current || current.resetAt <= now) {
			this.buckets.set(request.key, { count: 1, resetAt: now + request.windowSec * 1000 });
			return true;
		}

		if (current.count >= request.maxHits) return false;
		current.count += 1;
		this.buckets.set(request.key, current);
		return true;
	}
}

/**
 * Distributed limits through Workers bindings; a combination without a binding
 * falls back to the per-instance buckets and is reported once, so a forgotten
 * declaration degrades to the previous behaviour instead of opening the route.
 */
class BindingBackend implements RateLimitBackend {
	private readonly fallback = new InMemoryBackend();
	private readonly reportedMissing = new Set<string>();

	constructor(private readonly bindings: ReadonlyMap<string, RateLimiterBinding>) {}

	get size(): number {
		return this.bindings.size;
	}

	async allow(request: RateLimitRequest): Promise<boolean> {
		const name = rateLimitBindingName(request.namespace, request.maxHits, request.windowSec);
		const binding = this.bindings.get(name);
		if (!binding) {
			if (!this.reportedMissing.has(name)) {
				this.reportedMissing.add(name);
				console.warn(
					`[rate-limit] binding ${name} is not declared; using per-instance limits.`,
				);
			}
			return this.fallback.allow(request);
		}
		const { success } = await binding.limit({ key: request.key });
		return success;
	}
}

let cachedBackend: RateLimitBackend | null = null;
const installedEnvironments = new WeakSet<object>();

function isRateLimiterBinding(value: unknown): value is RateLimiterBinding {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { limit?: unknown }).limit === 'function'
	);
}

/**
 * Adopts every `RATE_LIMIT_*` binding found on the Workers `env` object. Idempotent per
 * `env`; returns the number of bindings in use. Without bindings the in-memory backend stays.
 */
export function installRateLimitBindings(env: Record<string, unknown> | undefined): number {
	if (!env || installedEnvironments.has(env)) {
		return cachedBackend instanceof BindingBackend ? cachedBackend.size : 0;
	}
	installedEnvironments.add(env);
	const bindings = new Map<string, RateLimiterBinding>();
	for (const [name, value] of Object.entries(env)) {
		if (name.startsWith(BINDING_PREFIX) && isRateLimiterBinding(value))
			bindings.set(name, value);
	}
	if (bindings.size === 0) return 0;
	cachedBackend = new BindingBackend(bindings);
	return bindings.size;
}

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
	namespace: RateLimitNamespace;
	entityId: string;
	ip?: string;
	maxHits: number;
	windowSec: number;
}): Promise<boolean> {
	const key = input.ip
		? `${input.namespace}:${input.entityId}:${hashIp(input.ip)}`
		: `${input.namespace}:${input.entityId}`;
	return resolveBackend().allow({
		namespace: input.namespace,
		key,
		maxHits: input.maxHits,
		windowSec: input.windowSec,
	});
}

export function resetRateLimitProviderForTests(): void {
	cachedBackend = null;
}
