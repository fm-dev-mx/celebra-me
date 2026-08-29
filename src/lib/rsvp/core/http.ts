import { ApiError, isApiError, isAuthRequestError } from '@/lib/rsvp/core/errors';
import { PRIVATE_CACHE_CONTROL, withPrivateNoStore } from '@/lib/http/private-cache-path';
import { sanitize } from '@/lib/rsvp/core/utils';

export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

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

export function conflict(message: string): Response {
	return errorResponse(new ApiError(409, 'conflict', message));
}

export function getIp(request: Request): string {
	const raw =
		request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
	return sanitize(raw.split(',')[0], 100);
}

export function internalError(error: unknown): Response {
	return errorResponse(error);
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

export async function parseJsonBody(request: Request): Promise<Record<string, unknown> | Response> {
	const contentType = request.headers.get('content-type');
	if (!contentType?.includes('application/json')) {
		return badRequest('Content-Type must be application/json');
	}

	let rawText: string;
	try {
		rawText = await request.text();
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to read request body';
		return badRequest(`Failed to read request body: ${message}`);
	}

	if (!rawText.trim()) {
		// Return empty object for empty body instead of failing with 400
		return {};
	}

	try {
		return JSON.parse(rawText) as Record<string, unknown>;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Invalid JSON';
		return badRequest(`Invalid JSON format: ${message}`);
	}
}
