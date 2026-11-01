/** Server-only, read-only transport. Never import from a client island. */
import { getEnv } from '@/lib/server/env';

export const META_GRAPH_API_VERSION = 'v26.0';
const GRAPH_ORIGIN = 'https://graph.facebook.com';
const MAX_WAIT_MS = 10_000;
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

/** Explicit runtime lookup only: no file loading or requests at import time. */
export function readMetaInsightsConfig() {
	return {
		accessToken: getEnv('META_GRAPH_ACCESS_TOKEN'),
		adAccountId: getEnv('META_AD_ACCOUNT_ID'),
		pageId: getEnv('META_PAGE_ID'),
		igUserId: getEnv('META_IG_USER_ID'),
	};
}

type GraphFailure =
	'configuration' | 'request' | 'timeout' | 'network' | 'response' | 'rate_limit' | 'pagination';

/** Deliberately excludes upstream messages, URLs, headers, bodies and error causes. */
export class MetaGraphError extends Error {
	constructor(
		readonly kind: GraphFailure,
		readonly status?: number,
		readonly code?: number,
		readonly retryAfterMs?: number,
	) {
		super(`Meta Graph request failed: ${kind}`);
		this.name = 'MetaGraphError';
	}
}

interface ClientOptions {
	accessToken: string;
	fetchImpl?: typeof fetch;
	timeoutMs?: number;
	maxRetries?: number;
	maxPages?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function number(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** BUC recovery estimates are minutes; Retry-After is seconds or an HTTP date. */
function usageDelay(headers: Headers): number {
	let delay = 0;
	const retry = headers.get('retry-after');
	if (retry) {
		const seconds = Number(retry);
		const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retry) - Date.now();
		if (Number.isFinite(ms)) delay = Math.max(delay, ms);
	}
	function visit(value: unknown, depth = 0): void {
		if (depth > 3) return;
		if (Array.isArray(value)) {
			for (const item of value) visit(item, depth + 1);
		} else if (isRecord(value)) {
			const recovery = number(value.estimated_time_to_regain_access);
			if (recovery !== undefined) delay = Math.max(delay, recovery * 60_000);
			for (const key of ['call_count', 'total_cputime', 'total_time', 'acc_id_util_pct']) {
				const percent = number(value[key]);
				if (percent !== undefined && percent >= 90) {
					delay = Math.max(delay, percent >= 100 ? 60_000 : 1000);
				}
			}
			for (const nested of Object.values(value)) visit(nested, depth + 1);
		}
	}
	for (const name of ['x-app-usage', 'x-ad-account-usage', 'x-business-use-case-usage']) {
		try {
			visit(JSON.parse(headers.get(name) ?? 'null'));
		} catch {
			// Malformed advisory headers must not replace the actual Graph result.
		}
	}
	return Math.ceil(delay);
}

async function wait(delay: number): Promise<void> {
	if (delay > MAX_WAIT_MS) throw new MetaGraphError('rate_limit', undefined, undefined, delay);
	if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
}

/**
 * Streams aggregate insight rows one page at a time, with at most three attempts per page.
 * Long provider recovery periods are returned to the caller instead of sleeping in a Worker.
 * Callers validate metric-specific fields; this foundation does not select metrics or attribution.
 */
export class MetaGraphClient {
	#accessToken: string;
	#fetch: typeof fetch;
	#timeoutMs: number;
	#maxRetries: number;
	#maxPages: number;

	constructor(options: ClientOptions) {
		const { timeoutMs = 10_000, maxRetries = 2, maxPages = 20 } = options;
		if (
			!options.accessToken ||
			/\s/.test(options.accessToken) ||
			!Number.isInteger(timeoutMs) ||
			timeoutMs < 1 ||
			timeoutMs > 30_000 ||
			!Number.isInteger(maxRetries) ||
			maxRetries < 0 ||
			maxRetries > 2 ||
			!Number.isInteger(maxPages) ||
			maxPages < 1 ||
			maxPages > 100
		)
			throw new MetaGraphError('configuration');
		this.#accessToken = options.accessToken;
		this.#fetch = options.fetchImpl ?? fetch.bind(globalThis);
		this.#timeoutMs = timeoutMs;
		this.#maxRetries = maxRetries;
		this.#maxPages = maxPages;
	}

	#safeUrl(raw: string, pathname: string): URL {
		let url: URL;
		try {
			url = new URL(raw);
		} catch {
			throw new MetaGraphError('pagination');
		}
		if (
			url.origin !== GRAPH_ORIGIN ||
			url.pathname !== pathname ||
			url.username ||
			url.password ||
			url.hash
		) {
			throw new MetaGraphError('pagination');
		}
		// Meta may embed credentials in next links. Never forward them in a URL.
		for (const key of [...url.searchParams.keys()]) {
			if (/^(access_token|appsecret_proof|authorization)$/i.test(key))
				url.searchParams.delete(key);
		}
		if (
			url.href.includes(this.#accessToken) ||
			[...url.searchParams].some(
				([key, value]) =>
					key.includes(this.#accessToken) || value.includes(this.#accessToken),
			)
		) {
			throw new MetaGraphError('request');
		}
		return url;
	}

	async #attempt(
		url: URL,
	): Promise<{ body: unknown; status: number; ok: boolean; delay: number }> {
		const controller = new AbortController();
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			return await Promise.race([
				(async () => {
					const response = await this.#fetch(url.href, {
						method: 'GET',
						headers: { Authorization: `Bearer ${this.#accessToken}` },
						// Workers rejects redirect: 'error' at call time, so every request would
						// fail as a network error; take redirects manually and refuse them.
						redirect: 'manual',
						cache: 'no-store',
						signal: controller.signal,
					});
					if (
						response.type === 'opaqueredirect' ||
						(response.status >= 300 && response.status < 400)
					) {
						await response.body?.cancel();
						throw new MetaGraphError('response', response.status);
					}
					let body: unknown;
					try {
						body = await response.json();
					} catch {
						if (response.ok) throw new MetaGraphError('response', response.status);
					}
					return {
						body,
						status: response.status,
						ok: response.ok,
						delay: usageDelay(response.headers),
					};
				})(),
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => {
						controller.abort();
						reject(new MetaGraphError('timeout'));
					}, this.#timeoutMs);
				}),
			]);
		} catch (error) {
			if (controller.signal.aborted) throw new MetaGraphError('timeout');
			if (error instanceof MetaGraphError) throw error;
			throw new MetaGraphError('network');
		} finally {
			clearTimeout(timer);
		}
	}

	async #read(url: URL): Promise<{ body: Record<string, unknown>; delay: number }> {
		for (let attempt = 0; ; attempt++) {
			const result = await this.#attempt(url);
			const body = isRecord(result.body) ? result.body : undefined;
			const error = isRecord(body?.error) ? body.error : undefined;
			const code = number(error?.code);
			const limited =
				result.status === 429 || (code !== undefined && RATE_LIMIT_CODES.has(code));
			if (result.ok && body && !('error' in body)) return { body, delay: result.delay };
			const failure = new MetaGraphError(
				limited ? 'rate_limit' : 'response',
				result.status,
				code,
				result.delay || undefined,
			);
			const retryable = limited || result.status >= 500 || error?.is_transient === true;
			if (!retryable || attempt >= this.#maxRetries) throw failure;
			await wait(Math.max(result.delay, 1000 * 2 ** attempt));
		}
	}

	/** Dataset Quality has a `web` envelope, unlike paginated Insights. */
	async datasetQuality(datasetId: string): Promise<Record<string, unknown>[]> {
		if (!/^\d+$/.test(datasetId)) throw new MetaGraphError('request');
		const url = new URL(`/${META_GRAPH_API_VERSION}/dataset_quality`, GRAPH_ORIGIN);
		url.searchParams.set('dataset_id', datasetId);
		url.searchParams.set(
			'fields',
			'web{event_name,event_match_quality{composite_score},event_coverage{percentage},dedupe_key_feedback{dedupe_key,browser_events_with_dedupe_key{percentage},server_events_with_dedupe_key{percentage},overall_browser_coverage_from_dedupe_key{percentage}}}',
		);
		const { body } = await this.#read(this.#safeUrl(url.href, url.pathname));
		if (!Array.isArray(body.web) || !body.web.every(isRecord))
			throw new MetaGraphError('response');
		return body.web;
	}

	/**
	 * Page insights refuse user and system-user tokens (code 190, subcode 2069032), so the
	 * collector trades the configured token for the Page's own token before reading them.
	 */
	async pageAccessToken(pageId: string): Promise<string> {
		if (!/^\d+$/.test(pageId)) throw new MetaGraphError('request');
		const url = new URL(`/${META_GRAPH_API_VERSION}/${pageId}`, GRAPH_ORIGIN);
		url.searchParams.set('fields', 'access_token');
		const { body } = await this.#read(url);
		const token = body.access_token;
		if (typeof token !== 'string' || !token || /\s/.test(token))
			throw new MetaGraphError('response');
		return token;
	}

	async *pages(
		path: string,
		params: Record<string, string> = {},
	): AsyncGenerator<Record<string, unknown>[]> {
		if (!/^[a-zA-Z0-9_-]+\/insights$/.test(path)) throw new MetaGraphError('request');
		const initial = new URL(`/${META_GRAPH_API_VERSION}/${path}`, GRAPH_ORIGIN);
		for (const [key, value] of Object.entries(params)) {
			if (/^(access_token|appsecret_proof|authorization)$/i.test(key))
				throw new MetaGraphError('request');
			initial.searchParams.set(key, value);
		}
		let url = this.#safeUrl(initial.href, initial.pathname);
		const seen = new Set<string>();
		for (let page = 0; page < this.#maxPages; page++) {
			if (seen.has(url.href)) throw new MetaGraphError('pagination');
			seen.add(url.href);
			const { body, delay } = await this.#read(url);
			if (!Array.isArray(body.data) || !body.data.every(isRecord))
				throw new MetaGraphError('response');
			const paging = body.paging;
			if (paging !== undefined && !isRecord(paging)) throw new MetaGraphError('pagination');
			const next = isRecord(paging) ? paging.next : undefined;
			if (next !== undefined && typeof next !== 'string')
				throw new MetaGraphError('pagination');
			const nextUrl = next ? this.#safeUrl(next, initial.pathname) : undefined;
			yield body.data;
			if (!nextUrl) return;
			if (page + 1 >= this.#maxPages) throw new MetaGraphError('pagination');
			await wait(delay);
			url = nextUrl;
		}
	}
}
