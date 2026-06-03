import {
	fetchJSON,
	type ApiResult,
	type ApiResponse,
	type ApiErrorResponse,
} from '@/lib/api-client-shared';
import { getCsrfToken } from '@/lib/csrf';

export { type ApiResult, type ApiResponse, type ApiErrorResponse };

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

	async post<T>(
		path: string,
		body?: unknown,
		init?: Omit<RequestInit, 'body'>,
	): Promise<ApiResult<T>> {
		return fetchJSON<T>(`${this.baseUrl}${path}`, {
			method: 'POST',
			...init,
			headers: this.prepareMutationHeaders(init),
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	}

	async patch<T>(
		path: string,
		body?: unknown,
		init?: Omit<RequestInit, 'body'>,
	): Promise<ApiResult<T>> {
		return fetchJSON<T>(`${this.baseUrl}${path}`, {
			method: 'PATCH',
			...init,
			headers: this.prepareMutationHeaders(init),
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	}

	async delete<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
		return fetchJSON<T>(`${this.baseUrl}${path}`, {
			method: 'DELETE',
			...init,
			headers: this.prepareMutationHeaders(init),
		});
	}

	async upload<T>(path: string, formData: FormData): Promise<ApiResult<T>> {
		const csrfToken = getCsrfToken();
		const headers: Record<string, string> = {};
		if (csrfToken) {
			headers['X-CSRF-Token'] = csrfToken;
		}
		// Do NOT set Content-Type — browser sets it with boundary for FormData
		return fetchJSON<T>(`${this.baseUrl}${path}`, {
			method: 'POST',
			headers,
			body: formData,
		});
	}
}

export const dashboardApi = new DashboardApiClient();
