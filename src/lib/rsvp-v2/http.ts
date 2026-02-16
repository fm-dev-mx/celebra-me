import { ApiError, isApiError } from './errors';

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
	return errorResponse(new ApiError(401, 'unauthorized', 'No autorizado.'));
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
	if (isApiError(error)) {
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

	const fallbackMessage = error instanceof Error ? error.message : 'Error interno del servidor.';
	return jsonResponse(
		{
			success: false,
			error: {
				code: 'internal_error',
				message: fallbackMessage,
			},
		},
		500,
	);
}
