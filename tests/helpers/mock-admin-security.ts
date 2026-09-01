/**
 * Helper to mock security functions in admin endpoint tests.
 * Maintains middleware intent without external dependencies or global state.
 */

/**
 * Configure mocks for admin security functions (without CSRF skip).
 * Useful for endpoints requiring CSRF validation.
 */
export function mockAdminSecurityPass(): void {
	jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
		requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
	}));

	jest.mock('@/lib/rsvp/security/csrf', () => ({
		validateCsrfToken: jest.fn(), // No error thrown = valid token
		shouldSkipCsrfValidation: jest.fn().mockReturnValue(false), // Always validate CSRF
		getCsrfTokenFromCookies: jest.fn(),
		getCsrfTokenFromHeader: jest.fn(),
	}));

	jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
		checkRateLimit: jest.fn().mockResolvedValue(true as never), // Always allow
	}));

	jest.mock('@/lib/server/runtime-mutation-environment', () => ({
		assertRuntimeMutationEnvironment: jest.fn().mockResolvedValue(undefined),
	}));
}
