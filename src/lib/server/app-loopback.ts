/**
 * Sends a request to this application without leaving the process. Behind zone routes a
 * Worker's `fetch()` to a hostname of its own zone skips the Worker and reaches the zone's
 * DNS origin, so a self-check over HTTP measures that origin instead of the Worker. The
 * Worker entry installs the adapter's handler before the first request (`src/worker.ts`);
 * every other host (the dev server, the preflight script, tests) has none and
 * keeps `fetch`.
 */

type AppHandler = (request: Request) => Promise<Response>;

let installedHandler: AppHandler | undefined;

/** Adopts the handler that renders this application inside the current Worker isolate. */
export function installAppLoopback(handler: AppHandler): void {
	installedHandler = handler;
}

/** Forgets the installed handler (tests). */
export function resetAppLoopbackForTests(): void {
	installedHandler = undefined;
}

/** Whether requests to this application stay in process. */
export function hasAppLoopback(): boolean {
	return installedHandler !== undefined;
}

/** Fetches a URL from this application, through the installed handler when there is one. */
export function fetchFromApp(url: string, init?: RequestInit): Promise<Response> {
	if (installedHandler) return installedHandler(new Request(url, init));
	return fetch(url, init);
}
