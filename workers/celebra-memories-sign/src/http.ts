export type MemoriesSignErrorCode =
	| 'not_found'
	| 'method_not_allowed'
	| 'unauthorized'
	| 'invalid_request'
	| 'unsupported_mime'
	| 'file_too_large'
	| 'upload_window_closed'
	| 'rate_limited'
	| 'sign_failed'
	| 'forbidden_origin'
	| 'capability_invalid'
	| 'replay'
	| 'upload_failed';

export const MEMORY_UPLOAD_CORS_HEADERS = {
	'Access-Control-Allow-Methods': 'OPTIONS, PUT',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-amz-checksum-sha256',
	'Access-Control-Max-Age': '300',
} as const;

export function buildBaseHeaders(): Headers {
	return new Headers({
		'Cache-Control': 'no-store',
		Vary: 'Origin',
	});
}

export function jsonResponse(
	body: unknown,
	status: number,
	origin?: string | null,
	extraHeaders?: HeadersInit,
): Response {
	const headers = buildBaseHeaders();
	headers.set('Content-Type', 'application/json; charset=utf-8');
	if (extraHeaders) {
		new Headers(extraHeaders).forEach((value, key) => {
			headers.set(key, value);
		});
	}
	if (origin) {
		headers.set('Access-Control-Allow-Origin', origin);
	}
	return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(
	code: MemoriesSignErrorCode,
	message: string,
	status: number,
	origin?: string | null,
	extraHeaders?: HeadersInit,
): Response {
	return jsonResponse({ error: { code, message } }, status, origin, extraHeaders);
}
