export type MemoriesSignErrorCode =
	| 'not_found'
	| 'method_not_allowed'
	| 'unauthorized'
	| 'invalid_request'
	| 'unsupported_mime'
	| 'file_too_large'
	| 'upload_window_closed'
	| 'rate_limited'
	| 'sign_failed';

export function buildBaseHeaders(): Headers {
	return new Headers({
		'Cache-Control': 'no-store',
		Vary: 'Origin',
	});
}

export function jsonResponse(
	body: unknown,
	status: number,
	_origin?: string | null,
	extraHeaders?: HeadersInit,
): Response {
	const headers = buildBaseHeaders();
	headers.set('Content-Type', 'application/json; charset=utf-8');
	if (extraHeaders) {
		new Headers(extraHeaders).forEach((value, key) => {
			headers.set(key, value);
		});
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
