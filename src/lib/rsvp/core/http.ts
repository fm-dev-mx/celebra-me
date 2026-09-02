import { ApiError, isApiError, isAuthRequestError } from '@/lib/rsvp/core/errors';
import { PRIVATE_CACHE_CONTROL, withPrivateNoStore } from '@/lib/http/private-cache-path';
import { sanitize } from '@/lib/rsvp/core/utils';

export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export const DEFAULT_JSON_BODY_MAX_BYTES = 256 * 1024;

export async function readBoundedRequestText(request: Request, maxBytes: number): Promise<string> {
	const contentLength = request.headers.get('content-length');
	if (contentLength !== null) {
		if (!/^\d+$/.test(contentLength.trim())) {
			throw new ApiError(400, 'bad_request', 'Content-Length is invalid.');
		}
		if (Number(contentLength) > maxBytes) {
			throw new ApiError(413, 'payload_too_large', 'Request body is too large.');
		}
	}

	if (request.body === undefined || request.body === null) {
		// Astro test adapters may omit body while exposing the Fetch text method.
		// Real network Requests always use the bounded stream path below.
		const fallbackText = await request.text();
		if (new TextEncoder().encode(fallbackText).byteLength > maxBytes) {
			throw new ApiError(413, 'payload_too_large', 'Request body is too large.');
		}
		return fallbackText;
	}
	if (request.body === null) {
		const fallbackText = await request.text();
		if (new TextEncoder().encode(fallbackText).byteLength > maxBytes) {
			throw new ApiError(413, 'payload_too_large', 'Request body is too large.');
		}
		return fallbackText;
	}

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;
			totalBytes += value.byteLength;
			if (totalBytes > maxBytes) {
				await reader.cancel('request body exceeds configured limit');
				throw new ApiError(413, 'payload_too_large', 'Request body is too large.');
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const body = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(body);
}

export function withPrivateCache(response: Response): Response {
	return withPrivateNoStore(response);
}

export interface ApiSuccess<T> {
	success: true;
	data: T;
	meta?: {
		page?: number;
		perPage?: number;
		total?: number;
	};
}

export interface ApiErrorResponse {
	success: false;
	error: {
		code: string;
		message: string;
		details?: unknown;
	};
}

export function successResponse<T>(data: T, status = 200, meta?: ApiSuccess<T>['meta']): Response {
	const payload: ApiSuccess<T> = { success: true, data };
	if (meta) payload.meta = meta;
	return jsonResponse(payload, status);
}

export function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

export function csvResponse(content: string, fileName: string): Response {
	return new Response(content, {
		status: 200,
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${fileName}"`,
		},
	});
}

export function unauthorizedResponse(): Response {
	return errorResponse(new ApiError(401, 'unauthorized', 'Unauthorized.'));
}

export function badRequest(message: string): Response {
	return errorResponse(new ApiError(400, 'bad_request', message));
}

export function forbidden(message: string): Response {
	return errorResponse(new ApiError(403, 'forbidden', message));
}


export function getIp(request: Request): string {
	const raw =
		request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
	return sanitize(raw.split(',')[0], 100);
}


export function errorResponse(error: unknown): Response {
	if (isAuthRequestError(error)) {
		const response = jsonResponse(
			{
				success: false,
				error: {
					code: error.retryable ? 'service_unavailable' : 'upstream_error',
					message: error.retryable
						? 'El servicio de autenticación no está disponible temporalmente.'
						: 'El servicio de autenticación rechazó la solicitud.',
				},
			},
			error.retryable ? 503 : 502,
		);
		response.headers.set('Cache-Control', PRIVATE_CACHE_CONTROL);
		if (error.retryable) response.headers.set('Retry-After', '5');
		return response;
	}

	// Log all errors server-side for diagnostics
	if (isApiError(error)) {
		// Only log server errors (5xx), not client errors (4xx)
		if (error.status >= 500) {
			console.error('[rsvp] Error:', error);
		}
		const response = jsonResponse(
			{
				success: false,
				error: {
					code: error.code,
					message: error.message,
					details: error.details,
				},
			},
			error.status,
		);
		if (error.status >= 500) response.headers.set('Cache-Control', PRIVATE_CACHE_CONTROL);
		return response;
	}

	// Non-ApiError: log the full details server-side, return sanitized message
	const isEmptyObject =
		error &&
		typeof error === 'object' &&
		!(error instanceof Error) &&
		Object.keys(error).length === 0;

	if (!isEmptyObject) {
		console.error('[rsvp] Unexpected Error:', error);
	}

	const errorCode = isEmptyObject ? 'bad_request' : 'internal_error';
	const status = isEmptyObject ? 400 : 500;

	const response = jsonResponse(
		{
			success: false,
			error: {
				code: errorCode,
				message: 'Internal server error.',
			},
		},
		status,
	);
	if (status >= 500) response.headers.set('Cache-Control', PRIVATE_CACHE_CONTROL);
	return response;
}

export async function parseJsonBody(
	request: Request,
	maxBytes = DEFAULT_JSON_BODY_MAX_BYTES,
): Promise<Record<string, unknown> | Response> {
	const contentType = request.headers.get('content-type');
	if (!contentType?.includes('application/json')) {
		return badRequest('Content-Type must be application/json');
	}

	let rawText: string;
	try {
		rawText = await readBoundedRequestText(request, maxBytes);
	} catch (error) {
		if (isApiError(error)) return errorResponse(error);
		return badRequest('Failed to read request body.');
	}

	if (!rawText.trim()) {
		// Return empty object for empty body instead of failing with 400
		return {};
	}

	try {
		return JSON.parse(rawText) as Record<string, unknown>;
	} catch {
		return badRequest('Invalid JSON format.');
	}
}
