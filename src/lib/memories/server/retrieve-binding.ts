/**
 * Service Binding from the application Worker to the private retrieval Worker
 * (`services` in `wrangler.jsonc`). On Cloudflare the call stays inside the account
 * instead of crossing the public `workers.dev` host. The Worker entry installs
 * `env.MEMORIES_RETRIEVE` before the first request (`src/worker.ts`); every other host
 * (Vercel, the dev server, tests) has no binding and keeps the configured origin.
 */

interface ServiceBinding {
	fetch(request: Request): Promise<Response>;
}

export const MEMORIES_RETRIEVE_BINDING = 'MEMORIES_RETRIEVE';

/**
 * Origin of the request URL when no retrieval origin is configured. A Service Binding
 * ignores the host; the retrieval Worker checks only the method and the path.
 */
export const MEMORIES_RETRIEVE_BINDING_ORIGIN = 'https://celebra-memories-retrieve.internal';

let installedBinding: ServiceBinding | undefined;

function isServiceBinding(value: unknown): value is ServiceBinding {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { fetch?: unknown }).fetch === 'function'
	);
}

/** Adopts `env.MEMORIES_RETRIEVE` from a Worker invocation; a missing binding leaves `fetch` selected. */
export function installMemoriesRetrieveBinding(env: Record<string, unknown> | undefined): boolean {
	const candidate = env?.[MEMORIES_RETRIEVE_BINDING];
	if (!isServiceBinding(candidate)) return false;
	installedBinding = candidate;
	return true;
}

export function hasMemoriesRetrieveBinding(): boolean {
	return installedBinding !== undefined;
}

/** Forgets the installed binding (tests). */
export function resetMemoriesRetrieveBindingForTests(): void {
	installedBinding = undefined;
}

/** Sends a request to the retrieval Worker, through the Service Binding when installed. */
export function fetchMemoriesRetrieveWorker(url: URL, init?: RequestInit): Promise<Response> {
	if (installedBinding) return installedBinding.fetch(new Request(url.href, init));
	return fetch(url, init);
}
