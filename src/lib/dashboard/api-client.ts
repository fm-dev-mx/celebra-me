import {
	fetchJSON,
	type ApiResult,
	type ApiResponse,
	type ApiErrorResponse,
} from '@/lib/api-client-shared';

export { type ApiResult, type ApiResponse, type ApiErrorResponse };

/**
 * Reads the CSRF token from the page metadata.
 * The server must include: <meta name="csrf-token" content="TOKEN">
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
	 * Prepares headers for state-changing requests.
	 * Adds the CSRF token automatically when present.
	 */
	private prepareMutationHeaders(init?: RequestInit): Record<string, string> {
		const csrfToken = getCsrfToken();
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (csrfToken) {
			headers['X-CSRF-Token'] = csrfToken;
		}

		// Preserve explicit caller headers while keeping the default mutation headers.
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
