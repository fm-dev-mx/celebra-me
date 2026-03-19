/**
 * Helper para mockear funciones de seguridad en tests de endpoints admin.
 * Mantiene la intención del middleware sin dependencias externas/estado global.
 */

import { jest } from '@jest/globals';

/**
 * Helper para mockear funciones de seguridad en tests de endpoints admin.
 * Mantiene la intención del middleware sin dependencias externas/estado global.
 */

/**
 * Retorna configuración de mocks para funciones de seguridad admin
 * - requireAdminRateLimit: resuelve sin error (permite la operación)
 * - validateCsrfToken: no lanza error (token válido)
 * - shouldSkipCsrfValidation: retorna false (siempre validar CSRF)
 * - checkRateLimit: permite todas las operaciones
 */
export function getAdminSecurityMocksConfig() {
	return {
		adminRateLimit: () => ({
			requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
		}),
		csrf: () => ({
			validateCsrfToken: jest.fn(), // No lanza error = token válido
			shouldSkipCsrfValidation: jest.fn().mockReturnValue(false), // Siempre validar CSRF
			getCsrfTokenFromCookies: jest.fn(),
			getCsrfTokenFromHeader: jest.fn(),
		}),
		rateLimitProvider: () => ({
			checkRateLimit: jest.fn().mockResolvedValue(true as never), // Siempre permite
		}),
	};
}

/**
 * Configuración de mocks para tests que no requieren CSRF
 */
export function getAdminSecurityMocksConfigWithCsrfSkip() {
	return {
		adminRateLimit: () => ({
			requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
		}),
		csrf: () => ({
			validateCsrfToken: jest.fn(),
			shouldSkipCsrfValidation: jest.fn().mockReturnValue(true), // Saltar validación CSRF
			getCsrfTokenFromCookies: jest.fn(),
			getCsrfTokenFromHeader: jest.fn(),
		}),
		rateLimitProvider: () => ({
			checkRateLimit: jest.fn().mockResolvedValue(true as never),
		}),
	};
}

/**
 * Configura mocks para funciones de seguridad admin con CSRF skip
 * Útil para endpoints que explícitamente permiten skip CSRF en test/dev
 */
export function mockAdminSecurityPassWithCsrfSkip(): void {
	jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
		requireAdminRateLimit: jest.fn().mockResolvedValue(undefined as never),
	}));

	jest.mock('@/lib/rsvp/security/csrf', () => ({
		validateCsrfToken: jest.fn(), // No se llamará porque skip es true
		shouldSkipCsrfValidation: jest.fn().mockReturnValue(true), // Saltar validación CSRF
		getCsrfTokenFromCookies: jest.fn(),
		getCsrfTokenFromHeader: jest.fn(),
	}));
}

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
 * Obtiene instancias mockeadas de las funciones de seguridad
 * Útil para verificar llamadas o configurar comportamientos específicos
 */
export function getAdminSecurityMocks(): {
	requireAdminRateLimit: jest.Mock;
	validateCsrfToken: jest.Mock;
	shouldSkipCsrfValidation: jest.Mock;
} {
	// These will be mocked by Jest in test files
	const adminRateLimit = jest.requireMock('@/lib/rsvp/security/admin-rate-limit') as {
		requireAdminRateLimit: jest.Mock;
	};
	const csrf = jest.requireMock('@/lib/rsvp/security/csrf') as {
		validateCsrfToken: jest.Mock;
		shouldSkipCsrfValidation: jest.Mock;
	};

	return {
		requireAdminRateLimit: adminRateLimit.requireAdminRateLimit,
		validateCsrfToken: csrf.validateCsrfToken,
		shouldSkipCsrfValidation: csrf.shouldSkipCsrfValidation,
	};
}

/**
 * Configura validateCsrfToken para fallar (simular token inválido)
 * Útil para tests que verifican respuestas de error CSRF
 */
export function setupCsrfFailure(): void {
	const csrf = jest.requireMock('@/lib/rsvp/security/csrf') as {
		validateCsrfToken: jest.Mock;
	};
	csrf.validateCsrfToken.mockImplementation(() => {
		throw new Error('CSRF token inválido');
	});
}

/**
 * Configura requireAdminRateLimit para fallar (simular rate limit excedido)
 * Útil para tests que verifican respuestas 429
 */
export function setupRateLimitFailure(): void {
	const { ApiError } = jest.requireMock('@/lib/rsvp/core/errors') as {
		ApiError: new (
			status: number,
			code: string,
			message: string,
			details?: Record<string, unknown>,
		) => Error;
	};
	const adminRateLimit = jest.requireMock('@/lib/rsvp/security/admin-rate-limit') as {
		requireAdminRateLimit: jest.Mock;
	};

	adminRateLimit.requireAdminRateLimit.mockRejectedValue(
		new ApiError(429, 'rate_limited', 'Límite de tasa excedido') as never,
	);
}
