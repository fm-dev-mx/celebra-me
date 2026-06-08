export interface ApiResponse<T> {
	data: T;
	ok: true;
	status: number;
}

export interface ApiErrorResponse {
	ok: false;
	status: number;
	code: string;
	message: string;
	details?: unknown;
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
	return (
		typeof value === 'object' &&
		value !== null &&
		'ok' in value &&
		value.ok === false &&
		'code' in value &&
		'message' in value
	);
}

export function buildApiErrorResponse(error: unknown): ApiErrorResponse {
	if (typeof error === 'object' && error !== null && 'status' in error && 'code' in error) {
		const apiError = error as {
			status: number;
			code: string;
			message?: string;
			details?: unknown;
		};
		return {
			ok: false,
			status: apiError.status,
			code: apiError.code,
			message: apiError.message || 'Error desconocido',
			details: apiError.details,
		};
	}

	if (error instanceof Error) {
		return {
			ok: false,
			status: 500,
			code: 'internal_error',
			message: error.message || 'Error interno del servidor',
		};
	}

	return {
		ok: false,
		status: 500,
		code: 'internal_error',
		message: 'Error interno del servidor',
	};
}

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

function parseHttpErrorResponse(
	data: unknown,
	status: number,
	statusText: string,
): ApiErrorResponse {
	if (isApiErrorResponse(data)) {
		return data;
	}

	if (
		typeof data === 'object' &&
		data !== null &&
		'error' in data &&
		typeof data.error === 'object' &&
		data.error !== null &&
		'message' in data.error
	) {
		const errorData = data.error as Record<string, unknown>;
		return {
			ok: false,
			status,
			code: (errorData.code as string) || 'http_error',
			message: String(errorData.message),
			details: errorData.details,
		};
	}

	const errorMessage =
		typeof data === 'object' && data !== null && 'message' in data
			? String(data.message)
			: `Error ${status}: ${statusText}`;

	return {
		ok: false,
		status,
		code: status === 401 ? 'unauthorized' : 'http_error',
		message: errorMessage,
	};
}

export async function fetchJSON<T>(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<ApiResult<T>> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);

	try {
		const response = await fetch(input, {
			...init,
			signal: controller.signal,
		});

		let data: unknown;
		try {
			data = await response.json();
		} catch {
			data = null;
		}

		if (!response.ok) {
			return parseHttpErrorResponse(data, response.status, response.statusText);
		}

		return {
			ok: true,
			status: response.status,
			data: data as T,
		};
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return {
				ok: false,
				status: 408,
				code: 'timeout',
				message: 'La conexión tardó demasiado. Intenta de nuevo.',
			};
		}
		return buildApiErrorResponse(error);
	} finally {
		clearTimeout(timeoutId);
	}
}
