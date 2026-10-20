/**
 * Synthetic host account for browser tests of the dashboard. The canonical fixture transport
 * answers `/auth/v1/user` for this token only, so the middleware admits a `host_client` session
 * without a database; dashboard APIs stay mocked in the browser. Never a real account or credential.
 */
export const CANONICAL_HOST_ACCESS_TOKEN = 'canonical-host-fixture-not-a-credential';

export function buildCanonicalHostUser(): Record<string, unknown> {
	return {
		id: 'aaaaaaaa-0000-4000-8000-000000000001',
		aud: 'authenticated',
		email: 'anfitrion@fixture.test',
		app_metadata: { role: 'host_client' },
		user_metadata: {},
	};
}
