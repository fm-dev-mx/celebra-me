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

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
	return (
		typeof value === 'object' &&
		value !== null &&
		'ok' in value &&
		value.ok === false &&
		'code' in value &&
		'message' in value
	);
}

function buildApiErrorResponse(error: unknown): ApiErrorResponse {
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

export async function fetchJSON<T>(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<ApiResult<T>> {
	try {
		const response = await fetch(input, init);

		let data: unknown;
		try {
			data = await response.json();
		} catch {
			data = null;
		}

		if (!response.ok) {
			if (isApiErrorResponse(data)) {
				return data;
			}

			const errorMessage =
				typeof data === 'object' && data !== null && 'message' in data
					? String(data.message)
					: `Error ${response.status}: ${response.statusText}`;

			return {
				ok: false,
				status: response.status,
				code: response.status === 401 ? 'unauthorized' : 'http_error',
				message: errorMessage,
			};
		}

		return {
			ok: true,
			status: response.status,
			data: data as T,
		};
	} catch (error) {
		return buildApiErrorResponse(error);
	}
}

/**
 * Obtiene el token CSRF del meta tag
 * El servidor debe incluir: <meta name="csrf-token" content="TOKEN">
 */
function getCsrfToken(): string | undefined {
	if (typeof document === 'undefined') return undefined;

	const meta = document.querySelector('meta[name="csrf-token"]');
	return meta?.getAttribute('content') || undefined;
}

export class DashboardApiClient {
	private baseUrl: string;

	constructor(baseUrl: string = '') {
		this.baseUrl = baseUrl;
	}

	/**
	 * Prepara headers para requests que modifican estado
	 * Incluye CSRF token automáticamente
	 */
	private prepareMutationHeaders(init?: RequestInit): Record<string, string> {
		const csrfToken = getCsrfToken();
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (csrfToken) {
			headers['X-CSRF-Token'] = csrfToken;
		}

		// Merge custom headers from init
		if (init?.headers) {
			const initHeaders = init.headers as Record<string, string>;
			Object.assign(headers, initHeaders);
		}

		return headers;
	}

	async get<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
		return fetchJSON<T>(`${this.baseUrl}${path}`, {
			method: 'GET',
			...init,
		});
	}

	async post<T>(path: string, body?: unknown, init?: RequestInit): Promise<ApiResult<T>> {
		return fetchJSON<T>(`${this.baseUrl}${path}`, {
			method: 'POST',
			headers: this.prepareMutationHeaders(init),
			body: body ? JSON.stringify(body) : undefined,
			...init,
		});
	}

	async patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<ApiResult<T>> {
		return fetchJSON<T>(`${this.baseUrl}${path}`, {
			method: 'PATCH',
			headers: this.prepareMutationHeaders(init),
			body: body ? JSON.stringify(body) : undefined,
			...init,
		});
	}

	async delete<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
		return fetchJSON<T>(`${this.baseUrl}${path}`, {
			method: 'DELETE',
			headers: this.prepareMutationHeaders(init),
			...init,
		});
	}
}

export const dashboardApi = new DashboardApiClient();
