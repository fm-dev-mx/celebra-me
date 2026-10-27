/**
 * Synthetic host and owner accounts for dashboard browser tests. The loopback fixture transport
 * recognizes only the explicit fixture tokens; dashboard APIs stay mocked in the browser.
 * Never real accounts or credentials.
 */
export const CANONICAL_HOST_ACCESS_TOKEN = 'canonical-host-fixture-not-a-credential';
export const CANONICAL_ADMIN_ACCESS_TOKEN = 'canonical-orders-admin-not-a-credential';

export function buildCanonicalAdminUser(): Record<string, unknown> {
	return {
		...buildCanonicalHostUser(),
		id: 'aaaaaaaa-0000-4000-8000-000000000002',
		email: 'pedidos@fixture.test',
		app_metadata: { role: 'super_admin' },
		amr: [{ method: 'totp' }],
	};
}

export function buildCanonicalHostUser(): Record<string, unknown> {
	return {
		id: 'aaaaaaaa-0000-4000-8000-000000000001',
		aud: 'authenticated',
		email: 'anfitrion@fixture.test',
		app_metadata: { role: 'host_client' },
		user_metadata: {},
	};
}
