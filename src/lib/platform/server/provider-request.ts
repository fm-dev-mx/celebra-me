/**
 * Shared request plumbing for the platform usage readers and the snapshot
 * collector. Provider bodies never leave this module: callers get parsed JSON
 * or a typed failure code that is safe to log and store.
 */

const DEFAULT_TIMEOUT_MS = 5_000;
const CODE_PATTERN = /[^a-z0-9_.-]/gi;

export type ProviderFailure =
	| 'timeout'
	| 'network'
	| 'http_401'
	| 'http_403'
	| 'http_404'
	| 'http_429'
	| 'http_5xx'
	| 'http_other'
	| 'graphql_error'
	| 'malformed';

export type ProviderJsonResult =
	{ ok: true; body: unknown } | { ok: false; failure: ProviderFailure; code?: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asRows(value: unknown): Record<string, unknown>[] | null {
	return Array.isArray(value) ? value.filter(isRecord) : null;
}

export function finiteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Short identifier-like code (e.g. a GraphQL `extensions.code`), never free text. */
export function sanitizeProviderCode(value: unknown): string | undefined {
	if (typeof value !== 'string' && typeof value !== 'number') return undefined;
	const code = String(value).replace(CODE_PATTERN, '').slice(0, 40);
	return code || undefined;
}

function failureForStatus(status: number): ProviderFailure {
	if (status === 401) return 'http_401';
	if (status === 403) return 'http_403';
	if (status === 404) return 'http_404';
	if (status === 429) return 'http_429';
	if (status >= 500) return 'http_5xx';
	return 'http_other';
}

/** Fetch JSON with a bearer token and a timeout. Never throws. */
export async function fetchProviderJson(
	url: string,
	init: {
		method: 'GET' | 'POST';
		token: string;
		/** Extra headers (e.g. PostgREST's `apikey`); never logged. */
		headers?: Record<string, string>;
		body?: unknown;
		timeoutMs?: number;
	},
	fetchImpl: typeof fetch,
): Promise<ProviderJsonResult> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	try {
		const response = await fetchImpl(url, {
			method: init.method,
			headers: {
				...init.headers,
				Authorization: `Bearer ${init.token}`,
				'Content-Type': 'application/json',
			},
			body: init.body === undefined ? undefined : JSON.stringify(init.body),
			signal: controller.signal,
		});
		if (!response.ok) return { ok: false, failure: failureForStatus(response.status) };
		try {
			return { ok: true, body: await response.json() };
		} catch {
			return { ok: false, failure: 'malformed' };
		}
	} catch {
		return { ok: false, failure: controller.signal.aborted ? 'timeout' : 'network' };
	} finally {
		clearTimeout(timer);
	}
}
