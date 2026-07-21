import {
	getSupabaseUrl,
	getSupabaseAnonKey,
	getSupabaseServiceRoleKey,
} from '@/lib/server/supabase-credentials';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const DEFAULT_TIMEOUT_MS = 10_000;

// Retry budget for transient "JWT issued at future" clock-skew errors
const MAX_JWT_RETRIES = 2;
const JWT_RETRY_DELAY_BASE_MS = 500;
const JWT_RETRY_JITTER_MAX_MS = 200;

export class SupabaseHttpError extends Error {
	constructor(
		public readonly status: number,
		public readonly body: string,
		public readonly code: string | null,
	) {
		super(`Supabase error (${status}): ${body || String(status)}`);
		this.name = 'SupabaseHttpError';
	}
}

function postgrestErrorCode(body: string): string | null {
	try {
		const parsed: unknown = JSON.parse(body);
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			'code' in parsed &&
			typeof parsed.code === 'string'
		) {
			return parsed.code;
		}
	} catch {
		// The original response remains available to callers for diagnostics.
	}
	return null;
}

/** Extract the `message` field from a PostgREST error body, if present. */
function postgrestErrorMessage(body: string): string | null {
	try {
		const parsed: unknown = JSON.parse(body);
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			'message' in parsed &&
			typeof parsed.message === 'string'
		) {
			return parsed.message;
		}
	} catch {
		return null;
	}
	return null;
}

/**
 * Determine whether the response is a transient JWT clock-skew error that
 * should be retried.
 *
 * Retry only when ALL of these hold:
 *  - method is GET
 *  - an authenticated authToken is provided
 *  - useServiceRole is false (call is user-authenticated)
 *  - HTTP status is 401
 *  - PostgREST code is PGRST303
 *  - parsed message is exactly "JWT issued at future"
 */
function shouldRetryJwtFuture(params: {
	method: HttpMethod;
	authToken?: string;
	useServiceRole?: boolean;
	status: number;
	code: string | null;
	body: string;
}): boolean {
	if (params.method !== 'GET') return false;
	if (!params.authToken?.trim()) return false;
	if (params.useServiceRole) return false;
	if (params.status !== 401) return false;
	if (params.code !== 'PGRST303') return false;

	const message = postgrestErrorMessage(params.body);
	return message === 'JWT issued at future';
}

/**
 * Exponential backoff with jitter for retry delays.
 * attempt 0 → ~500ms, attempt 1 → ~1000ms, etc., capped at 2 s.
 */
function jwtFutureRetryDelay(attempt: number): number {
	const base = JWT_RETRY_DELAY_BASE_MS * Math.pow(2, attempt);
	const jitter = Math.random() * JWT_RETRY_JITTER_MAX_MS;
	return Math.min(base + jitter, 2_000);
}

/** Extract the first path segment as an endpoint category for diagnostics. */
function endpointCategory(pathWithQuery: string): string {
	const qIndex = pathWithQuery.indexOf('?');
	const path = qIndex === -1 ? pathWithQuery : pathWithQuery.slice(0, qIndex);
	const firstSlash = path.indexOf('/');
	return firstSlash === -1 ? path : path.slice(0, firstSlash);
}

/** Log sanitised retry metadata (never log the JWT or cookie). */
function logJwtRetryDiagnostics(params: {
	attempt: number;
	method: HttpMethod;
	pathWithQuery: string;
	code: string;
}): void {
	if (process.env.NODE_ENV === 'production') return;
	const endpoint = endpointCategory(params.pathWithQuery);
	console.warn(
		`[supabase] retry=${params.attempt} method=${params.method} endpoint=${endpoint} code=${params.code}`,
	);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface SupabaseRequestOptions {
	pathWithQuery: string;
	method?: HttpMethod;
	body?: unknown;
	prefer?: string;
	authToken?: string;
	useServiceRole?: boolean;
	timeoutMs?: number;
}

export async function supabaseRestRequest<T>(options: SupabaseRequestOptions): Promise<T> {
	const method = options.method ?? 'GET';
	const apiKey = options.useServiceRole ? getSupabaseServiceRoleKey() : getSupabaseAnonKey();
	const bearer = options.authToken?.trim() ?? apiKey;

	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const url = `${getSupabaseUrl()}/rest/v1/${options.pathWithQuery}`;

	let lastError: SupabaseHttpError | undefined;
	const maxAttempts = 1 + MAX_JWT_RETRIES; // 1 initial + N retries

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(timeoutMs),
			method,
			headers: {
				apikey: apiKey,
				Authorization: `Bearer ${bearer}`,
				'Content-Type': 'application/json',
				...(options.prefer ? { Prefer: options.prefer } : {}),
			},
			body: options.body ? JSON.stringify(options.body) : undefined,
		});

		if (response.ok) {
			// Read body once so we can safely attempt JSON parsing
			const text = await response.text();

			// Some Supabase endpoints (e.g. with Prefer: return=minimal) return
			// 2xx with an empty body. Return an empty array rather than crashing.
			if (!text.trim()) {
				return [] as T;
			}

			try {
				return JSON.parse(text) as T;
			} catch {
				throw new Error(
					`Supabase response parse error (${response.status} ${options.method ?? 'GET'} /rest/v1/${options.pathWithQuery}): invalid JSON body`,
				);
			}
		}

		// Error response — capture the body before throwing or retrying.
		const raw = await response.text();
		const code = postgrestErrorCode(raw);
		const error = new SupabaseHttpError(response.status, raw || response.statusText, code);

		if (
			shouldRetryJwtFuture({
				method,
				authToken: options.authToken,
				useServiceRole: options.useServiceRole,
				status: response.status,
				code,
				body: raw,
			}) &&
			attempt < maxAttempts - 1
		) {
			lastError = error;

			logJwtRetryDiagnostics({
				attempt: attempt + 1,
				method,
				pathWithQuery: options.pathWithQuery,
				code: 'PGRST303',
			});

			await sleep(jwtFutureRetryDelay(attempt));
			continue;
		}

		throw error;
	}

	// All retries exhausted — preserve the original typed error.
	throw lastError!;
}
