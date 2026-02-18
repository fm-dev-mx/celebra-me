/**
 * CSRF (Cross-Site Request Forgery) Protection
 *
 * Implementación basada en tokens sincronizados (Synchronizer Token Pattern)
 * - Token CSRF generado en el servidor y almacenado en cookie
 * - Cliente debe leer la cookie y enviar el token en header X-CSRF-Token
 * - Servidor valida que el token coincida
 */

import { createHash, randomBytes } from 'node:crypto';
import type { AstroCookies } from 'astro';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

/**
 * Genera un token CSRF criptográficamente seguro
 */
export function generateCsrfToken(): string {
	return randomBytes(TOKEN_LENGTH).toString('base64url');
}

/**
 * Hashea un token para almacenamiento seguro
 */
function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('base64url');
}

/**
 * Crea y almacena un nuevo token CSRF en cookies
 * Debe llamarse al iniciar sesión o al cargar una página con formularios
 */
export function setCsrfToken(cookies: AstroCookies): string {
	const token = generateCsrfToken();
	const hashedToken = hashToken(token);

	// Cookie segura para producción
	const isProduction = process.env.NODE_ENV === 'production';

	cookies.set(CSRF_COOKIE_NAME, hashedToken, {
		httpOnly: true,
		secure: isProduction,
		sameSite: 'strict',
		path: '/',
		maxAge: 60 * 60 * 24, // 24 horas
	});

	return token;
}

/**
 * Obtiene el token CSRF hasheado de las cookies
 */
export function getCsrfTokenFromCookies(cookies: AstroCookies): string | undefined {
	return cookies.get(CSRF_COOKIE_NAME)?.value;
}

/**
 * Obtiene el token CSRF del header de la request
 */
export function getCsrfTokenFromHeader(request: Request): string | undefined {
	return request.headers.get(CSRF_HEADER_NAME)?.trim() || undefined;
}

/**
 * Valida que el token CSRF del header coincida con el de la cookie
 * @throws Error si los tokens no coinciden o faltan
 */
export function validateCsrfToken(request: Request, cookies: AstroCookies): void {
	// Solo validar para métodos que modifican estado
	const method = request.method.toUpperCase();
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
		return; // GET, HEAD, OPTIONS no requieren CSRF
	}

	// En desarrollo, permitir requests sin CSRF token (para facilitar testing)
	// En producción, siempre requerir CSRF
	const isProduction = process.env.NODE_ENV === 'production';

	const cookieToken = getCsrfTokenFromCookies(cookies);
	const headerToken = getCsrfTokenFromHeader(request);

	// Si no hay token en cookie, el usuario no tiene sesión activa
	// Esto está bien, la autenticación se maneja por otro lado
	if (!cookieToken) {
		return;
	}

	// Si hay token en cookie pero no en header, es un intento de CSRF
	if (!headerToken) {
		if (isProduction) {
			throw new Error('CSRF token faltante');
		}
		// En desarrollo, loggear warning pero permitir
		console.warn('⚠️  CSRF token faltante en desarrollo');
		return;
	}

	// Validar que los tokens coinciden
	const hashedHeaderToken = hashToken(headerToken);

	// Usar comparación de tiempo constante para prevenir timing attacks
	if (!timingSafeEqual(cookieToken, hashedHeaderToken)) {
		throw new Error('CSRF token inválido');
	}
}

/**
 * Comparación de tiempo constante para prevenir timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return result === 0;
}

/**
 * Elimina el token CSRF de las cookies
 * Útil al cerrar sesión
 */
export function clearCsrfToken(cookies: AstroCookies): void {
	cookies.delete(CSRF_COOKIE_NAME, { path: '/' });
}

/**
 * Genera un meta tag con el token CSRF para el cliente
 * El cliente debe leer este valor y enviarlo en requests
 */
export function generateCsrfMetaTag(token: string): string {
	return `<meta name="csrf-token" content="${token}">`;
}

/**
 * Middleware para validar CSRF en Astro
 * Uso en middleware.ts:
 *
 * import { csrfMiddleware } from '@/lib/rsvp/csrf';
 *
 * export const onRequest = defineMiddleware((context, next) => {
 *   // ... otra lógica de middleware ...
 *
 *   // Validar CSRF para requests que modifican estado
 *   csrfMiddleware(context);
 *
 *   return next();
 * });
 */
export function csrfMiddleware(context: { request: Request; cookies: AstroCookies }): void {
	try {
		validateCsrfToken(context.request, context.cookies);
	} catch (error) {
		// Loggear el error pero dejar que el manejador de errores de Astro lo maneje
		console.error('CSRF validation failed:', error);
		throw error;
	}
}

/**
 * Verifica si una ruta debe omitir validación CSRF
 * Útil para webhooks o APIs que usan otros métodos de autenticación
 */
export function shouldSkipCsrfValidation(pathname: string): boolean {
	// Rutas que no requieren CSRF (webhooks, APIs con autenticación alternativa)
	const skipPaths = ['/api/webhook', '/api/stripe', '/api/supabase'];

	return skipPaths.some((path) => pathname.startsWith(path));
}
