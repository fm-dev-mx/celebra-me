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

/**
 * Resolves the visitor IP from the proxy headers the current hosts set.
 *
 * Priority: `CF-Connecting-IP` (Cloudflare writes it from the connection and overwrites
 * any client value), then the first entry of `X-Forwarded-For` (Vercel and most proxies),
 * then `X-Real-IP`. Returns `null` when no header is present, for example on the dev server.
 */
export function getClientIp(request: Request): string | null {
	return (
		firstHeaderValue(request.headers, 'cf-connecting-ip') ??
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
