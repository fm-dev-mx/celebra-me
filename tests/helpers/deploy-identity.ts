/**
 * Deploy identity switches for tests. `tests/setup.ts` resets both inputs before every
 * test (no `CELEBRA_DEPLOY_ENV`, built bundle), so tests only declare the identity they need.
 */
import { isDevEnvironment } from '@/lib/environment';

const mockIsDevEnvironment = isDevEnvironment as jest.MockedFunction<typeof isDevEnvironment>;

/** Astro dev server without a declared hosted identity: resolves to `local`. */
export function asLocalDevServer(): void {
	delete process.env.CELEBRA_DEPLOY_ENV;
	mockIsDevEnvironment.mockReturnValue(true);
}

/** Built bundle without a declared identity (the per-test default): fails closed off Local Supabase. */
export function asUndeclaredBuiltBundle(): void {
	delete process.env.CELEBRA_DEPLOY_ENV;
	mockIsDevEnvironment.mockReturnValue(false);
}

/**
 * Process declaring `CELEBRA_DEPLOY_ENV` (any value, including invalid ones). A built bundle
 * by default; `isDevServer` covers a declaration that leaked into `astro dev`.
 */
export function asHostedDeploy(environment: string, { isDevServer = false } = {}): void {
	process.env.CELEBRA_DEPLOY_ENV = environment;
	mockIsDevEnvironment.mockReturnValue(isDevServer);
}
