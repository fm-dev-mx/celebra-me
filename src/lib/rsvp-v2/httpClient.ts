/**
 * HTTP Client con timeouts configurados
 */

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 60000;

export interface RequestOptions extends RequestInit {
	timeout?: number;
}

export async function fetchWithTimeout(
	url: string | URL | Request,
	options: RequestOptions = {},
): Promise<Response> {
	const timeout = Math.min(options.timeout ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
		});
		return response;
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(`Request timeout after ${timeout}ms`);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

export const TIMEOUTS = {
	short: 5000,
	medium: 15000,
	long: 30000,
	extended: 60000,
} as const;
