/**
 * Rate limiting para endpoints administrativos
 * Protege contra brute force y DoS attacks
 */

import { checkRateLimit, hashIp } from '@/lib/rsvp/security/rate-limit-provider';
import { ApiError } from '@/lib/rsvp/core/errors';

interface RateLimitConfig {
	maxHits: number;
	windowSec: number;
}

// Configuración por tipo de operación
const RATE_LIMITS: Record<string, RateLimitConfig> = {
	// Listados - más permisivo
	'admin:list': { maxHits: 60, windowSec: 60 }, // 60 req/min

	// Creación - moderado
	'admin:create': { maxHits: 20, windowSec: 60 }, // 20 req/min

	// Actualizaciones - moderado
	'admin:update': { maxHits: 30, windowSec: 60 }, // 30 req/min

	// Eliminaciones - restrictivo
	'admin:delete': { maxHits: 10, windowSec: 60 }, // 10 req/min

	// Cambios de rol - muy restrictivo
	'admin:role': { maxHits: 5, windowSec: 60 }, // 5 req/min

	// Claim codes - moderado
	'claimcodes:list': { maxHits: 60, windowSec: 60 },
	'claimcodes:create': { maxHits: 20, windowSec: 60 },
	'claimcodes:update': { maxHits: 30, windowSec: 60 },
	'claimcodes:delete': { maxHits: 10, windowSec: 60 },
	'claimcodes:validate': { maxHits: 30, windowSec: 60 },
};

/**
 * Extrae IP del request considerando proxies
 */
function extractClientIp(request: Request): string {
	// En Vercel, usar el header x-forwarded-for
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}

	const realIp = request.headers.get('x-real-ip');
	if (realIp) {
		return realIp;
	}

	// Fallback
	return 'unknown';
}

/**
 * Aplica rate limiting a operaciones administrativas
 * @param request - Request de Astro
 * @param operation - Tipo de operación (ej: 'admin:list', 'admin:role')
 * @param userId - ID del usuario (opcional, para rate limiting por usuario)
 * @throws ApiError 429 si se excede el límite
 */
export async function requireAdminRateLimit(
	request: Request,
	operation: keyof typeof RATE_LIMITS,
	userId?: string,
): Promise<void> {
	const config = RATE_LIMITS[operation];
	if (!config) {
		throw new Error(`Configuración de rate limiting no encontrada para: ${operation}`);
	}

	const ip = extractClientIp(request);

	// Usar userId si está disponible, sino IP
	const entityId = userId || hashIp(ip);

	// Mapear operación a namespace
	const namespace = operation.startsWith('claimcodes:') ? 'dashboard' : 'dashboard';

	const allowed = await checkRateLimit({
		namespace,
		entityId,
		ip,
		maxHits: config.maxHits,
		windowSec: config.windowSec,
	});

	if (!allowed) {
		throw new ApiError(
			429,
			'rate_limited',
			`Demasiadas peticiones. Por favor, espera ${config.windowSec} segundos antes de intentar de nuevo.`,
		);
	}
}

/**
 * Middleware para aplicar rate limiting a endpoints admin
 * Uso en API routes:
 *
 * export const GET: APIRoute = async ({ request }) => {
 *   await requireAdminRateLimit(request, 'admin:list');
 *   // ... resto del handler
 * };
 */
export { requireAdminRateLimit as default };
