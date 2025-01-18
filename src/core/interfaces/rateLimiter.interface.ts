// src/core/interfaces/rateLimiter.interface.ts
import { Duration } from '@upstash/ratelimit';

export interface RateLimiterConfig {
	limit: number;
	duration: Duration;
	prefix: string;
}

export interface RateLimiterStatus {
	/** Whether the rate limit was exceeded or not */
	exceeded: boolean;

	/** Total requests made */
	currentCount?: number;

	/** Remaining requests before hitting the limit */
	remaining?: number;
}

export interface RateLimiterMeta {
	/** Unique rate-limit key for tracking */
	rateLimiterKey: string;

	rateLimiterConfig: RateLimiterConfig;

	/** Additional data about the rate-limit status */
	rateLimiterStatus?: RateLimiterStatus;
}
