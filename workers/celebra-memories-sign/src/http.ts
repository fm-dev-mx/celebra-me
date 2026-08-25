import { isAllowedValentinaMemoriesOrigin } from '../../../src/data/valentina-memories-upload.contract';

export type MemoriesSignErrorCode =
	| 'not_found'
	| 'method_not_allowed'
	| 'invalid_origin'
	| 'invalid_request'
	| 'unsupported_mime'
	| 'file_too_large'
	| 'upload_window_closed'
	| 'rate_limited'
	| 'sign_failed';

const CORS_ALLOW_METHODS = 'OPTIONS, POST';
const CORS_ALLOW_HEADERS = 'Content-Type';

export function buildBaseHeaders(origin: string | null): Headers {
	const headers = new Headers({
		'Cache-Control': 'no-store',
		Vary: 'Origin',
	});

	if (isAllowedValentinaMemoriesOrigin(origin) && origin) {
		headers.set('Access-Control-Allow-Origin', origin);
		headers.set('Access-Control-Allow-Methods', CORS_ALLOW_METHODS);
		headers.set('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS);
	}

	return headers;
}

export function jsonResponse(
	body: unknown,
	status: number,
	origin: string | null,
	extraHeaders?: HeadersInit,
): Response {
	const headers = buildBaseHeaders(origin);
	headers.set('Content-Type', 'application/json; charset=utf-8');
	if (extraHeaders) {
		new Headers(extraHeaders).forEach((value, key) => {
			headers.set(key, value);
		});
	}
	return new Response(JSON.stringify(body), { status, headers });
}

export function emptyResponse(
	status: number,
	origin: string | null,
	extraHeaders?: HeadersInit,
): Response {
	const headers = buildBaseHeaders(origin);
	if (extraHeaders) {
		new Headers(extraHeaders).forEach((value, key) => {
			headers.set(key, value);
		});
	}
	return new Response(null, { status, headers });
}

export function errorResponse(
	code: MemoriesSignErrorCode,
	message: string,
	status: number,
	origin: string | null,
	extraHeaders?: HeadersInit,
): Response {
	return jsonResponse({ error: { code, message } }, status, origin, extraHeaders);
}
