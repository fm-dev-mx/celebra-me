/**
 * Service Bindings from the application Worker to the private memories Workers
 * (`services` in `wrangler.jsonc`). On Cloudflare the call stays inside the account
 * instead of crossing the public `workers.dev` host, which a Worker on the same
 * `workers.dev` subdomain cannot reach with a plain `fetch` (error 1042). The Worker
 * entry installs the bindings before the first request (`src/worker.ts`); every other
 * host (the dev server, tests) has none and keeps the configured origin.
 */

interface ServiceBinding {
	fetch(request: Request): Promise<Response>;
}

const MEMORIES_SIGN_BINDING = 'MEMORIES_SIGN';
const MEMORIES_RETRIEVE_BINDING = 'MEMORIES_RETRIEVE';

/**
 * Origin of the request URL when no retrieval origin is configured. A Service Binding
 * ignores the host; the retrieval Worker checks only the method and the path.
 */
export const MEMORIES_RETRIEVE_BINDING_ORIGIN = 'https://celebra-memories-retrieve.internal';

function isServiceBinding(value: unknown): value is ServiceBinding {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { fetch?: unknown }).fetch === 'function'
	);
}

function createWorkerBinding(name: string) {
	let installed: ServiceBinding | undefined;
	return {
		/** Adopts `env[name]` from a Worker invocation; a missing binding leaves `fetch` selected. */
		install(env: Record<string, unknown> | undefined): boolean {
			const candidate = env?.[name];
			if (!isServiceBinding(candidate)) return false;
			installed = candidate;
			return true;
		},
		has: (): boolean => installed !== undefined,
		reset(): void {
			installed = undefined;
		},
		fetch(url: URL, init?: RequestInit): Promise<Response> {
			if (installed) return installed.fetch(new Request(url.href, init));
			return fetch(url, init);
		},
	};
}

const signBinding = createWorkerBinding(MEMORIES_SIGN_BINDING);
const retrieveBinding = createWorkerBinding(MEMORIES_RETRIEVE_BINDING);

/** Adopts every memories Worker binding present in `env`. */
export function installMemoriesWorkerBindings(env: Record<string, unknown> | undefined): void {
	signBinding.install(env);
	retrieveBinding.install(env);
}

export const installMemoriesSignBinding = signBinding.install;
export const hasMemoriesSignBinding = signBinding.has;
export const resetMemoriesSignBindingForTests = signBinding.reset;
/**
 * Sends a request to the sign Worker, through the Service Binding when installed. The
 * URL keeps the configured public origin: the Worker derives the browser's upload URL
 * from it.
 */
export const fetchMemoriesSignWorker = signBinding.fetch;

export const installMemoriesRetrieveBinding = retrieveBinding.install;
export const hasMemoriesRetrieveBinding = retrieveBinding.has;
export const resetMemoriesRetrieveBindingForTests = retrieveBinding.reset;
/** Sends a request to the retrieval Worker, through the Service Binding when installed. */
export const fetchMemoriesRetrieveWorker = retrieveBinding.fetch;
