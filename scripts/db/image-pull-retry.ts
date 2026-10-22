/**
 * image-pull-retry.ts — bounded `docker pull` retry for the disposable test environment.
 *
 * Registry rate limits (GHCR `toomanyrequests`) and transient network errors use the
 * whole attempt budget with capped exponential backoff and jitter. Permanent registry
 * rejections (auth, missing manifest) stop immediately.
 */

import { redactCredentials } from './db-target-config.ts';

export type ImagePullFailureClass = 'rate-limit' | 'registry-rejected' | 'transient';

export function classifyImagePullFailure(errorOutput: string): ImagePullFailureClass {
	if (/toomanyrequests|data limit exceeded|rate.?limit|\b429\b/i.test(errorOutput)) {
		return 'rate-limit';
	}
	if (
		/unauthorized|authentication required|denied:|forbidden|manifest unknown|name unknown|not found|no matching manifest|invalid reference format/i.test(
			errorOutput,
		)
	) {
		return 'registry-rejected';
	}
	return 'transient';
}

/** Docker image-pull retry budget. */
export const IMAGE_RETRY_COUNT = 4;
const IMAGE_RETRY_DELAY_MS = 5_000;
/** Registry rate limits get a longer floor; GHCR often answers with a sub-second retry-after. */
const IMAGE_RATE_LIMIT_FLOOR_MS = 15_000;
const IMAGE_RETRY_MAX_DELAY_MS = 60_000;
/** Up to this fraction of the delay is added as random jitter. */
const IMAGE_RETRY_JITTER_RATIO = 0.25;

const DURATION_UNIT_MS: Record<string, number> = {
	ns: 1e-6,
	us: 1e-3,
	µs: 1e-3,
	μs: 1e-3,
	ms: 1,
	s: 1_000,
	m: 60_000,
	h: 3_600_000,
};

/**
 * Parse a `retry-after` hint from docker pull output. Accepts Go durations
 * (`904.5µs`, `1.5s`, `2m`) and bare HTTP seconds (`retry-after: 30`).
 */
export function parseRetryAfterMs(errorOutput: string): number | null {
	const match = errorOutput.match(/retry-after:?\s*([\d.]+)\s*(ns|us|µs|μs|ms|s|m|h)?(?![a-z])/i);
	if (!match) return null;
	const value = Number.parseFloat(match[1] ?? '');
	if (!Number.isFinite(value)) return null;
	const unit = (match[2] ?? 's').toLowerCase();
	return value * (DURATION_UNIT_MS[unit] ?? 1_000);
}

/**
 * Delay before retry number `retry` (1-based). Rate limits honor retry-after
 * with a floor; everything is exponential, capped, and jittered.
 */
export function computeImagePullRetryDelayMs(
	retry: number,
	failureClass: ImagePullFailureClass,
	errorOutput: string,
	random: () => number = Math.random,
): number {
	const base =
		failureClass === 'rate-limit'
			? Math.max(
					IMAGE_RATE_LIMIT_FLOOR_MS * 2 ** (retry - 1),
					parseRetryAfterMs(errorOutput) ?? 0,
				)
			: IMAGE_RETRY_DELAY_MS * 2 ** (retry - 1);
	const capped = Math.min(base, IMAGE_RETRY_MAX_DELAY_MS);
	return Math.round(capped + capped * IMAGE_RETRY_JITTER_RATIO * random());
}

export interface ImagePullDeps {
	pull: (imageName: string) => { status: number | null; stderr: string };
	sleep: (ms: number) => void;
	random?: () => number;
	log?: (message: string) => void;
}

export type ImagePullResult =
	| { ok: true; attempts: number }
	| { ok: false; attempts: number; failureClass: ImagePullFailureClass; failure: string };

/**
 * Pull an image with bounded retry. Rate limits and transient errors use the
 * full budget; permanent registry rejections stop immediately.
 */
export function pullImageWithRetry(
	imageName: string,
	deps: ImagePullDeps,
	maxAttempts = IMAGE_RETRY_COUNT,
): ImagePullResult {
	const log = deps.log ?? ((message: string) => console.warn(message));
	let failure = '';
	let failureClass: ImagePullFailureClass = 'transient';
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		if (attempt > 1) {
			const delay = computeImagePullRetryDelayMs(
				attempt - 1,
				failureClass,
				failure,
				deps.random,
			);
			log(`  Retry ${attempt}/${maxAttempts} after ${delay}ms...`);
			deps.sleep(delay);
		}
		const pullResult = deps.pull(imageName);
		if (pullResult.status === 0) return { ok: true, attempts: attempt };
		failure =
			redactCredentials(pullResult.stderr.trim()) ||
			`docker pull exited with status ${pullResult.status}`;
		failureClass = classifyImagePullFailure(failure);
		log(
			`  docker pull attempt ${attempt}/${maxAttempts} failed (${failureClass}): ${failure.slice(0, 300)}`,
		);
		if (failureClass === 'registry-rejected') {
			return { ok: false, attempts: attempt, failureClass, failure };
		}
	}
	return { ok: false, attempts: maxAttempts, failureClass, failure };
}
