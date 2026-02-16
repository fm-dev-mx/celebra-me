# 📋 Fase 1 - Core Security

**Prioridad:** 🔴 ALTA  
**Estado:** 🔴 No Iniciada  
**Bloquea Deploy:** ✅ SÍ  
**Fecha Inicio:** Pendiente  
**Depende de:** Fase 0

---

## 🎯 Objetivo

Implementar protecciones de seguridad fundamentales: rate limiting, CSRF protection, security
headers y eliminar secrets por defecto.

---

## 📋 Tareas

### Tarea 1.1: Implementar Rate Limiting en Endpoints Admin

**ID:** SEC-005  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @backend-lead

#### Descripción

Actualmente los endpoints admin no tienen rate limiting, haciéndolos vulnerables a ataques DoS y
brute force.

**Endpoints a proteger:**

- `GET /api/dashboard/admin/events`
- `POST /api/dashboard/admin/events`
- `PATCH /api/dashboard/admin/events/[id]`
- `GET /api/dashboard/admin/users`
- `PATCH /api/dashboard/admin/users/[id]/role`
- `GET /api/dashboard/claimcodes`
- `POST /api/dashboard/claimcodes`
- `PATCH /api/dashboard/claimcodes/[id]`
- `DELETE /api/dashboard/claimcodes/[id]`

#### Checklist de Ejecución

- [ ]   1. Configurar Upstash Redis en producción:
    - [ ] Crear cuenta Upstash
    - [ ] Crear database Redis
    - [ ] Copiar URL y token
    - [ ] Agregar a Vercel env vars:
        - `UPSTASH_REDIS_REST_URL`
        - `UPSTASH_REDIS_REST_TOKEN`
        - `RSVP_V2_DISTRIBUTED_RATELIMIT=true`

- [ ]   2. Crear middleware de rate limiting para admin:

```typescript
// src/lib/rsvp-v2/rateLimitAdmin.ts
export async function requireAdminRateLimit(request: Request, namespace: string): Promise<void> {
	const provider = getRateLimitProvider();
	const result = await provider.check(
		extractClientIdentifier(request),
		namespace,
		{ maxHits: 30, windowSec: 60 }, // 30 req/min
	);

	if (!result.allowed) {
		throw new ApiError(429, 'rate_limited', 'Demasiadas peticiones. Intenta en 1 minuto.');
	}
}
```

- [ ]   3. Aplicar rate limiting a cada endpoint admin:

```typescript
// Ejemplo: events.ts
export const GET: APIRoute = async ({ request }) => {
	await requireAdminRateLimit(request, 'admin:events:list');
	// ... resto del handler
};
```

- [ ]   4. Ajustar límites según endpoint:
    - [ ] List operations: 30 req/min
    - [ ] Create operations: 10 req/min
    - [ ] Update/Delete: 20 req/min
    - [ ] Role changes: 5 req/min (muy sensible)

- [ ]   5. Tests:
    - [ ] Test que rate limiting funciona
    - [ ] Test que headers Retry-After están presentes
    - [ ] Test que diferentes namespaces son independientes

#### Evidencia de Completado

- [ ] Upstash Redis configurado y funcionando
- [ ] Tests de rate limiting pasando
- [ ] Documentación de límites creada

---

### Tarea 1.2: Implementar CSRF Protection

**ID:** SEC-006  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @backend-lead

#### Descripción

El sistema actualmente solo usa SameSite cookies para protección CSRF. Necesitamos implementar
tokens CSRF para operaciones de mutación.

#### Checklist de Ejecución

- [ ]   1. Crear utilidad de CSRF:

```typescript
// src/lib/rsvp-v2/csrf.ts
const CSRF_TOKEN_SECRET = process.env.CSRF_TOKEN_SECRET!;
const CSRF_COOKIE_NAME = 'csrf-token';

export function generateCsrfToken(): string {
	return crypto.randomBytes(32).toString('hex');
}

export function verifyCsrfToken(token: string, cookieToken: string): boolean {
	return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cookieToken));
}
```

- [ ]   2. Middleware para generar/validar CSRF:

```typescript
// src/middleware.ts - Agregar
if (isStateChangingMethod(request.method)) {
	const csrfToken = request.headers.get('x-csrf-token');
	const csrfCookie = cookies.get('csrf-token')?.value;

	if (!csrfToken || !csrfCookie || !verifyCsrfToken(csrfToken, csrfCookie)) {
		return new Response('Invalid CSRF token', { status: 403 });
	}
}
```

- [ ]   3. Exponer token CSRF al cliente:

```typescript
// En layout o página inicial
<script>
  window.CSRF_TOKEN = '${csrfToken}';
</script>
```

- [ ]   4. Actualizar API client para incluir token:

```typescript
// src/lib/dashboard/apiClient.ts
private async fetchWithCsrf(url: string, options: RequestInit): Promise<Response> {
  const csrfToken = this.getCsrfToken(); // De cookie o meta tag

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-CSRF-Token': csrfToken,
    },
  });
}
```

- [ ]   5. Aplicar a todas las mutaciones:
    - [ ] POST endpoints
    - [ ] PATCH endpoints
    - [ ] DELETE endpoints

- [ ]   6. Tests:
    - [ ] Test que mutación sin token falla (403)
    - [ ] Test que mutación con token válido funciona
    - [ ] Test que token expira correctamente

#### Evidencia de Completado

- [ ] Tests de CSRF pasando
- [ ] Documentación de implementación
- [ ] Validación manual de protección

---

### Tarea 1.3: Agregar Security Headers

**ID:** SEC-007  
**Prioridad:** 🔴 ALTA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @devops-lead

#### Descripción

Configurar headers de seguridad esenciales en todas las respuestas HTTP.

#### Checklist de Ejecución

- [ ]   1. Actualizar `vercel.json`:

```json
{
	"headers": [
		{
			"source": "/(.*)",
			"headers": [
				{
					"key": "Content-Security-Policy",
					"value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://analytics.vercel.app; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.vercel.app; font-src 'self'; connect-src 'self' https://*.supabase.co https://api.vercel.app; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
				},
				{
					"key": "X-Content-Type-Options",
					"value": "nosniff"
				},
				{
					"key": "X-Frame-Options",
					"value": "DENY"
				},
				{
					"key": "X-XSS-Protection",
					"value": "1; mode=block"
				},
				{
					"key": "Strict-Transport-Security",
					"value": "max-age=31536000; includeSubDomains; preload"
				},
				{
					"key": "Referrer-Policy",
					"value": "strict-origin-when-cross-origin"
				},
				{
					"key": "Permissions-Policy",
					"value": "camera=(), microphone=(), geolocation=()"
				}
			]
		},
		{
			"src": "^/_astro/(.*)$",
			"headers": {
				"cache-control": "public, max-age=31536000, immutable"
			}
		}
	]
}
```

- [ ]   2. Validar CSP:
    - [ ] Usar https://csp-evaluator.withgoogle.com/
    - [ ] Testear que la app funciona con CSP activado
    - [ ] Ajustar directivas si hay bloqueos legítimos

- [ ]   3. Test headers:

```bash
# Verificar headers
curl -I https://tu-app.vercel.app/
# Debe mostrar todos los security headers
```

- [ ]   4. Escaneo de seguridad:
    - [ ] https://securityheaders.com/
    - [ ] Debe obtener calificación A o A+

#### Evidencia de Completado

- [ ] Screenshot de vercel.json actualizado
- [ ] Report de securityheaders.com con calificación A+
- [ ] Tests de funcionamiento con CSP activo

---

### Tarea 1.4: Eliminar Default Secrets

**ID:** SEC-008  
**Prioridad:** 🔴 ALTA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @backend-lead

#### Descripción

Eliminar secrets por defecto en el código que pueden comprometer la seguridad si las variables de
entorno no están seteadas.

**Ubicaciones encontradas:**

- `src/lib/rsvp/service.ts` L116: `DEV_RSVP_TOKEN_SECRET`
- `src/lib/rsvp-v2/trustedDevice.ts` L35: `'dev-trust-device-secret'`

#### Checklist de Ejecución

- [ ]   1. Modificar `trustedDevice.ts`:

```typescript
// ANTES:
return secret || 'dev-trust-device-secret';

// DESPUÉS:
if (!secret) {
	if (process.env.NODE_ENV === 'production') {
		throw new Error('TRUST_DEVICE_SECRET no configurado en producción');
	}
	throw new Error('TRUST_DEVICE_SECRET no configurado');
}
return secret;
```

- [ ]   2. Modificar `service.ts` (legacy RSVP):

```typescript
// ANTES:
const DEV_RSVP_TOKEN_SECRET = 'dev-rsvp-secret-change-me';

// DESPUÉS:
if (!process.env.RSVP_TOKEN_SECRET) {
	throw new Error('RSVP_TOKEN_SECRET no configurado');
}
```

- [ ]   3. Crear validación en startup:

```typescript
// src/lib/rsvp-v2/validateEnv.ts
export function validateRequiredEnv(): void {
	const required = [
		'SUPABASE_URL',
		'SUPABASE_ANON_KEY',
		'SUPABASE_SERVICE_ROLE_KEY',
		'TRUST_DEVICE_SECRET',
		'RSVP_CLAIM_CODE_PEPPER',
	];

	if (process.env.NODE_ENV === 'production') {
		required.push('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN');
	}

	const missing = required.filter((key) => !process.env[key]);

	if (missing.length > 0) {
		throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}`);
	}
}

// Llamar en middleware.ts o punto de entrada
validateRequiredEnv();
```

- [ ]   4. Actualizar `.env.example`:

```bash
# Indicar que no deben haber defaults
TRUST_DEVICE_SECRET= # Requerido - generar con: openssl rand -hex 32
RSVP_CLAIM_CODE_PEPPER= # Requerido - generar con: openssl rand -hex 32
```

- [ ]   5. Tests:
    - [ ] Test que la app no inicia sin variables requeridas
    - [ ] Test que mensaje de error es claro
    - [ ] Test que con variables seteadas funciona

#### Evidencia de Completado

- [ ] Código sin secrets por defecto
- [ ] Validación de startup funcionando
- [ ] Tests pasando

---

## 🚫 Bloqueos

| Bloqueo | Descripción                        | Impacto                          | Mitigación               |
| ------- | ---------------------------------- | -------------------------------- | ------------------------ |
| Fase 0  | Esperando limpieza de credenciales | No se puede continuar sin Fase 0 | Completar Fase 0 primero |

---

## ✅ Criterios de Aceptación

Esta fase se considera completa cuando:

1. ✅ Todos los endpoints admin tienen rate limiting (30 req/min)
2. ✅ Todas las mutaciones requieren token CSRF válido
3. ✅ Todos los requests incluyen security headers
4. ✅ No hay secrets por defecto en el código
5. ✅ La app valida variables requeridas en startup
6. ✅ Calificación A+ en securityheaders.com

---

## 📊 Métricas de Éxito

| Métrica                           | Objetivo | Actual |
| --------------------------------- | -------- | ------ |
| Endpoints admin con rate limiting | 100%     | 0%     |
| Mutaciones con CSRF protection    | 100%     | 0%     |
| Security headers presentes        | 100%     | 0%     |
| Secrets por defecto en código     | 0        | 2      |
| Calificación securityheaders.com  | A+       | N/A    |

---

## 📝 Notas

- **💡 TIP:** El CSP puede requerir ajustes iterativos si bloquea recursos legítimos
- **⚠️ ALERTA:** El rate limiting puede afectar tests automatizados - considerar whitelist para test
  environment
- **📚 Ref:** https://owasp.org/www-project-secure-headers/

---

**Última actualización:** 2026-02-15  
**Próxima revisión:** Al iniciar Fase 1
