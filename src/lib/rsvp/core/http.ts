import { ApiError, isApiError } from '@/lib/rsvp/core/errors';

export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

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

export function internalError(error: unknown): Response {
	return errorResponse(error);
}

export function errorResponse(error: unknown): Response {
	// Log only 5xx errors for backend visibility
	if (isApiError(error)) {
		// Only log server errors (5xx), not client errors (4xx)
		if (error.status >= 500) {
			console.error('[rsvp] Error:', error);
		}
		return jsonResponse(
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
	}

	// Non-ApiError: check if it's an empty object or has no meaningful message
	const isErrorInstance = error instanceof Error;
	const isEmptyObject =
		error && typeof error === 'object' && !isErrorInstance && Object.keys(error).length === 0;

	if (!isEmptyObject) {
		console.error('[rsvp] Unexpected Error:', error);
	}

	const fallbackMessage = isErrorInstance
		? error.message
		: typeof error === 'string'
			? error
			: 'Internal server error.';

	const errorCode = isEmptyObject ? 'bad_request' : 'internal_error';
	const status = isEmptyObject ? 400 : 500;

	return jsonResponse(
		{
			success: false,
			error: {
				code: errorCode,
				message: fallbackMessage,
			},
		},
		status,
	);
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
		return badRequest('Request body is empty');
	}

	try {
		return JSON.parse(rawText) as Record<string, unknown>;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Invalid JSON';
		return badRequest(`Invalid JSON format: ${message}`);
	}
}
