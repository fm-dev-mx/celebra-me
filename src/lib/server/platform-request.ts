/**
 * Platform request helpers: the only module that knows which host serves a request.
 *
 * Everything else in `src/` asks this module for the visitor IP and for a way to run
 * work after the response is sent, so swapping the hosting platform touches one file.
 */

/** Something that can keep a request alive until a background promise settles. */
export interface AfterResponseContext {
	waitUntil(promise: Promise<unknown>): void;
}

const MAX_IP_LENGTH = 100;

function firstHeaderValue(headers: Headers, name: string): string | null {
	const raw = headers.get(name);
	if (!raw) return null;
	const first = raw.split(',')[0]?.trim().slice(0, MAX_IP_LENGTH) ?? '';
	return first.length > 0 ? first : null;
}

/** The Workers runtime reports itself through `navigator.userAgent`; no request can change it. */
const CLOUDFLARE_WORKERS_USER_AGENT = 'Cloudflare-Workers';

/**
 * True when this code runs inside Cloudflare Workers. Node (Vercel), the Astro dev
 * server and jsdom all report a different user agent, or none at all.
 */
export function isCloudflareWorkersRuntime(): boolean {
	const navigator = (globalThis as { navigator?: { userAgent?: unknown } }).navigator;
	return navigator?.userAgent === CLOUDFLARE_WORKERS_USER_AGENT;
}

export interface ClientIpOptions {
	/** Overrides runtime detection; callers that already know the host (and tests) set it. */
	onCloudflareWorkers?: boolean;
}

/**
 * Resolves the visitor IP from the proxy headers the current host sets.
 *
 * `CF-Connecting-IP` is read only on Cloudflare Workers, where the edge writes it from the
 * connection and overwrites any client value. Anywhere else a visitor could send that
 * header themselves, so Vercel and the dev server fall straight to the first entry of
 * `X-Forwarded-For` (set by the Vercel proxy), then `X-Real-IP`. Returns `null` when no
 * header is present, for example on the dev server.
 */
export function getClientIp(request: Request, options: ClientIpOptions = {}): string | null {
	const onCloudflareWorkers = options.onCloudflareWorkers ?? isCloudflareWorkersRuntime();
	const cloudflareIp = onCloudflareWorkers
		? firstHeaderValue(request.headers, 'cf-connecting-ip')
		: null;
	return (
		cloudflareIp ??
		firstHeaderValue(request.headers, 'x-forwarded-for') ??
		firstHeaderValue(request.headers, 'x-real-ip')
	);
}

function isAfterResponseContext(value: unknown): value is AfterResponseContext {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { waitUntil?: unknown }).waitUntil === 'function'
	);
}

/**
 * Reads the execution context the Cloudflare adapter exposes as `locals.runtime.ctx`.
 * Returns `null` on any other host; `runAfterResponse` then falls back by itself.
 */
export function resolveAfterResponseContext(locals: unknown): AfterResponseContext | null {
	if (typeof locals !== 'object' || locals === null) return null;
	const runtime = (locals as { runtime?: unknown }).runtime;
	if (typeof runtime !== 'object' || runtime === null) return null;
	const ctx = (runtime as { ctx?: unknown }).ctx;
	if (!isAfterResponseContext(ctx)) return null;
	return { waitUntil: (promise) => ctx.waitUntil(promise) };
}

/**
 * Vercel functions expose their request context on a well-known global symbol; this is
 * what `@vercel/functions`' `waitUntil` reads. Absent anywhere else.
 */
function resolveVercelAfterResponseContext(): AfterResponseContext | null {
	const holder = (globalThis as Record<symbol, unknown>)[Symbol.for('@vercel/request-context')];
	if (typeof holder !== 'object' || holder === null) return null;
	const get = (holder as { get?: unknown }).get;
	if (typeof get !== 'function') return null;
	const ctx: unknown = get.call(holder);
	return isAfterResponseContext(ctx) ? ctx : null;
}

export interface RunAfterResponseOptions {
	/** Name used in the error log when the task rejects. */
	label?: string;
}

/**
 * Starts `task` now and keeps the request alive until it settles, so the response can
 * be sent before the task finishes (tracking events, CAPI delivery, audit writes).
 *
 * Uses `ctx.waitUntil` when the caller has one (Cloudflare), otherwise the Vercel
 * request context, otherwise lets the promise float (dev server, tests). Rejections are
 * logged and never propagate to the caller.
 */
export function runAfterResponse(
	ctx: AfterResponseContext | null | undefined,
	task: () => Promise<unknown>,
	options: RunAfterResponseOptions = {},
): void {
	const label = options.label ?? 'after-response';
	let promise: Promise<unknown>;
	try {
		promise = Promise.resolve(task());
	} catch (error) {
		promise = Promise.reject(error);
	}
	const settled = promise.then(
		() => undefined,
		(error: unknown) => {
			console.error(`[${label}] Background task failed after the response:`, error);
		},
	);
	const target = ctx ?? resolveVercelAfterResponseContext();
	if (target) target.waitUntil(settled);
}
