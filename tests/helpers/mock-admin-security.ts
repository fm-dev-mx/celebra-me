/**
 * Helper para mockear funciones de seguridad en tests de endpoints admin.
 * Mantiene la intención del middleware sin dependencias externas/estado global.
 */

/**
 * Configura mocks para funciones de seguridad admin (sin CSRF skip)
 * Útil para endpoints que requieren CSRF validation
 */
export function mockAdminSecurityPass(): void {
	jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
		requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
	}));

	jest.mock('@/lib/rsvp/security/csrf', () => ({
		validateCsrfToken: jest.fn(), // No lanza error = token válido
		shouldSkipCsrfValidation: jest.fn().mockReturnValue(false), // Siempre validar CSRF
		getCsrfTokenFromCookies: jest.fn(),
		getCsrfTokenFromHeader: jest.fn(),
	}));

	jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
		checkRateLimit: jest.fn().mockResolvedValue(true as never), // Siempre permite
	}));
}

/**
 * Configura validateCsrfToken para fallar (simular token inválido)
 * Útil para tests que verifican respuestas de error CSRF normalizadas
 */
export function setupCsrfFailure(): void {
	const { ApiError } = jest.requireMock('@/lib/rsvp/core/errors') as {
		ApiError: new (status: number, code: string, message: string) => Error;
	};
	const csrf = jest.requireMock('@/lib/rsvp/security/csrf') as {
		validateCsrfToken: jest.Mock;
	};
	csrf.validateCsrfToken.mockImplementation(() => {
		throw new ApiError(
			403,
			'forbidden',
			'Token CSRF inválido. Por favor recarga la página e intenta de nuevo.',
		);
	});
}
