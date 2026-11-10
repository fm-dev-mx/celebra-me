import { fetchJSON, type ApiResult, type FetchJSONInit } from '@/lib/api-client-shared';
import { getCsrfToken } from '@/lib/csrf';
import { goToLoginAfterSessionEnded } from '@/lib/dashboard/session-ended';

export { type ApiResult };

/**
 * A 401 from the panel API means the session ended. The person is sent to the login page with an
 * explanation instead of staying on a screen where every action fails.
 */
function isSessionEnded<T>(url: string, result: ApiResult<T>): boolean {
	return !result.ok && result.status === 401 && url.startsWith('/api/dashboard');
}

export class DashboardApiClient {
	private baseUrl: string;
	private onSessionEnded: () => void;

	constructor(baseUrl: string = '', onSessionEnded: () => void = goToLoginAfterSessionEnded) {
		this.baseUrl = baseUrl;
		this.onSessionEnded = onSessionEnded;
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

	private async request<T>(path: string, init: FetchJSONInit): Promise<ApiResult<T>> {
		const url = `${this.baseUrl}${path}`;
		const result = await fetchJSON<T>(url, init);
		if (isSessionEnded(url, result)) this.onSessionEnded();
		return result;
	}

	async get<T>(path: string, init?: FetchJSONInit): Promise<ApiResult<T>> {
		return this.request<T>(path, {
			method: 'GET',
			...init,
		});
	}

	async post<T>(
		path: string,
		body?: unknown,
		init?: Omit<RequestInit, 'body'>,
	): Promise<ApiResult<T>> {
		return this.request<T>(path, {
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
		return this.request<T>(path, {
			method: 'PATCH',
			...init,
			headers: this.prepareMutationHeaders(init),
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	}

	async delete<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
		return this.request<T>(path, {
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
		return this.request<T>(path, {
			method: 'POST',
			headers,
			body: formData,
		});
	}
}

export const dashboardApi = new DashboardApiClient();
