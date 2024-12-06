// src/core/utilities/retryUtils.ts

/**
 * Calculates exponential backoff delay with jitter.
 * @param attempt - The current retry attempt number.
 * @param initialDelayMs - The initial delay in milliseconds.
 * @returns The calculated delay in milliseconds.
 */
export function getExponentialBackoffDelay(
	attempt: number,
	initialDelayMs: number
): number {
	const baseDelay = initialDelayMs * Math.pow(2, attempt - 1);
	const jitter = Math.random() * initialDelayMs;
	return baseDelay + jitter;
}

/**
 * Delays execution for a specified duration.
 * @param ms - Milliseconds to delay.
 * @returns A Promise that resolves after the delay.
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
