// src/core/interfaces/rateLimiter.interface.ts
import { Duration } from '@upstash/ratelimit';

export interface RateLimiterConfig {
	limit: number;
	duration: Duration;
	prefix: string;
}
