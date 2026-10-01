import http from 'node:http';

export interface DisposablePostgrestFetchOptions {
	method?: string;
	headers?: Record<string, string>;
	body?: string;
}

export interface DisposablePostgrestFetchResponse {
	ok: boolean;
	status: number;
	headers: {
		get: (h: string) => string | string[] | undefined;
	};
	text: () => Promise<string>;
	json: () => Promise<unknown>;
}

/**
 * Node HTTP fetch for disposable PostgREST under the jsdom test environment.
 * Disposable PostgREST serves the API at `/` (not Kong's `/rest/v1` prefix).
 */
export function disposablePostgrestFetch(
	urlStr: string | URL,
	options: DisposablePostgrestFetchOptions = {},
): Promise<DisposablePostgrestFetchResponse> {
	return new Promise((resolve, reject) => {
		const url = typeof urlStr === 'string' ? new URL(urlStr) : new URL(urlStr.toString());
		if (url.pathname.startsWith('/rest/v1/')) {
			url.pathname = url.pathname.slice('/rest/v1'.length);
		}
		const req = http.request(
			{
				hostname: url.hostname,
				port: url.port,
				path: url.pathname + url.search,
				method: options.method || 'GET',
				headers: options.headers || {},
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => {
					const statusCode = res.statusCode || 200;
					resolve({
						ok: statusCode >= 200 && statusCode < 300,
						status: statusCode,
						headers: {
							get: (h: string) => res.headers[h.toLowerCase()],
						},
						text: async () => data,
						json: async () => (data ? JSON.parse(data) : {}),
					});
				});
			},
		);
		req.on('error', reject);
		if (options.body) req.write(options.body);
		req.end();
	});
}
