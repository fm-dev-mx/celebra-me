// =============================================================================
// CELEBRA-ME | Screenshot Tool — Base URL reachability preflight
// =============================================================================

import { ScreenshotScopeError } from './scope.js';

type FetchLike = (
	input: string,
	init?: { signal?: AbortSignal; redirect?: RequestRedirect },
) => Promise<unknown>;

/**
 * Fail closed when the configured screenshot base URL is not reachable.
 *
 * Auto-starting `pnpm dev` from this tool is intentionally not supported:
 * process ownership, long cold starts, per-lane ports, and CI/agent runs make
 * an in-process server lifecycle brittle. Keep the server in a separate terminal.
 */
export async function assertScreenshotBaseUrlReachable(
	baseUrl: string,
	options?: { fetchImpl?: FetchLike; timeoutMs?: number },
): Promise<void> {
	const normalized = baseUrl.trim().replace(/\/+$/, '');
	if (!normalized) {
		throw new ScreenshotScopeError(
			'Screenshot base URL is empty. Pass --base-url or start from a known worktree lane.',
			'BASE_URL_UNREACHABLE',
		);
	}

	const probeUrl = `${normalized}/`;
	const timeoutMs = options?.timeoutMs ?? 3_000;
	const fetchImpl = options?.fetchImpl ?? fetch;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		await fetchImpl(probeUrl, { signal: controller.signal, redirect: 'manual' });
	} catch (error: unknown) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new ScreenshotScopeError(
			`Dev server not reachable at ${normalized}. Start it in another terminal with: pnpm dev` +
				(detail ? ` (${detail})` : ''),
			'BASE_URL_UNREACHABLE',
		);
	} finally {
		clearTimeout(timer);
	}
}
