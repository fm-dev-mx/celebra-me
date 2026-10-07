export type WorkerErrorCode =
	| 'not_found'
	| 'unauthorized'
	| 'invalid_request'
	| 'file_too_large'
	| 'rate_limited'
	| 'sign_failed'
	| 'capability_invalid'
	| 'replay'
	| 'already_uploaded'
	| 'upload_failed'
	| 'unavailable';

function baseHeaders(): Headers {
	return new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
}

export function jsonResponse(
	body: unknown,
	status: number,
	origin?: string | null,
	extraHeaders?: HeadersInit,
): Response {
	const headers = baseHeaders();
	headers.set('Content-Type', 'application/json; charset=utf-8');
	if (extraHeaders) new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
	if (origin) headers.set('Access-Control-Allow-Origin', origin);
	return new Response(JSON.stringify(body), { status, headers });
}

/** Error bodies carry a code only; messages are rendered by the app copy. */
export function errorResponse(
	code: WorkerErrorCode,
	status: number,
	origin?: string | null,
	extraHeaders?: HeadersInit,
): Response {
	return jsonResponse({ error: { code } }, status, origin, extraHeaders);
}

export function parseStorageTarget(value: unknown): 'local' | 'staging' | 'production' | null {
	return value === 'local' || value === 'staging' || value === 'production' ? value : null;
}

export function parseAllowedOrigins(value: unknown): Set<string> {
	if (typeof value !== 'string') return new Set();
	return new Set(
		value
			.split(',')
			.map((entry) => entry.trim())
			.filter(Boolean),
	);
}
