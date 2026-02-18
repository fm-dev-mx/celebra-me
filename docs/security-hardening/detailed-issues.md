# 🔍 Issues Detallados

Documento de referencia con todos los issues de seguridad encontrados durante la auditoría.

---

## CRÍTICO

### ISS-001: Credenciales Expuestas en Repositorio

**Archivos:** `.env`, `.env.local` **Líneas:** Múltiples **Riesgo:** Compromiso total del sistema

**Detalle:** Los siguientes secrets están hardcodeados en archivos trackeados por git:

```bash
# .env - Línea 12
SENDGRID_API_KEY=SG.xxx

# .env - Línea 21
GMAIL_PASS=xxxx

# .env.local - Línea 18
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# .env.local - Línea 13
RSVP_ADMIN_PASSWORD=xxxx
```

**Impacto:**

- Acceso total a base de datos
- Envío de emails spoofing
- Acceso administrativo al sistema

**Solución:**

1. Rotar TODAS las credenciales inmediatamente
2. Eliminar archivos del historial git (BFG/git-filter-branch)
3. Agregar a `.gitignore`
4. Configurar pre-commit hooks

---

### ISS-002: Protección Último Super Admin Solo Client-Side

**Archivo:** `src/components/dashboard/users/UsersAdminTable.tsx` L30-41 **Archivo:**
`src/pages/api/dashboard/admin/users/[userId]/role.ts` **Riesgo:** Bloqueo total del sistema

**Detalle:** El check de "no eliminar último super_admin" solo existe en el cliente:

```typescript
// UsersAdminTable.tsx
const superAdminCount = items.filter((item) => item.role === 'super_admin').length;
if (currentUser?.role === 'super_admin' && newRole === 'host_client' && superAdminCount <= 1) {
	alert('No se puede eliminar el último super_admin del sistema.');
	return;
}
```

El endpoint API NO tiene esta validación.

**Impacto:**

- Bypass trivial vía API directa
- Sistema queda sin admins
- Recuperación requiere acceso a BD

**Solución:**

1. Crear RPC `can_change_user_role()` con check server-side
2. Agregar validación en endpoint antes de actualizar
3. Mantener check cliente como UX improvement

---

### ISS-003: Sin Rate Limiting en Endpoints Admin

**Archivos:** Todos los endpoints en `/api/dashboard/admin/*` **Riesgo:** DoS, brute force

**Detalle:** Ningún endpoint admin tiene rate limiting. Esto permite:

- Fuerza bruta en operaciones sensibles
- DoS por saturación de requests
- Enumeración de recursos

**Endpoints vulnerables:**

- `GET /api/dashboard/admin/events` - Listado sin límite
- `PATCH /api/dashboard/admin/users/[id]/role` - Cambio de rol sin límite
- `POST /api/dashboard/claimcodes` - Creación sin límite

**Solución:**

1. Configurar Upstash Redis
2. Crear middleware `requireAdminRateLimit()`
3. Aplicar a todos los endpoints admin (30 req/min)

---

### ISS-004: Sin Protección CSRF

**Archivos:** Todos los endpoints POST/PATCH/DELETE **Riesgo:** Ataques cross-site

**Detalle:** No hay tokens CSRF implementados. Solo se usa SameSite cookies:

```typescript
// No existe implementación de CSRF tokens
```

**Impacto:**

- Ataques CSRF si SameSite es bypassed
- Operaciones no autorizadas desde sitios maliciosos

**Solución:**

1. Generar token CSRF en middleware
2. Enviar en cookie `csrf-token` (no HttpOnly)
3. Validar header `X-CSRF-Token` en mutaciones
4. Agregar token a requests del cliente

---

### ISS-005: Sin Soft Delete

**Archivos:** Todas las operaciones DELETE en BD **Riesgo:** Pérdida de datos irreversible

**Detalle:** Todas las operaciones DELETE son hard delete físico:

```sql
-- Actual: DELETE FROM events WHERE id = xxx
-- No hay deleted_at, is_deleted, ni status=deleted
```

**Tablas afectadas:**

- `events`
- `guest_invitations`
- `event_claim_codes`
- `event_memberships`

**Impacto:**

- Pérdida de datos accidental irreversible
- No hay recuperación posible
- Violación de compliance (auditoría)

**Solución:**

1. Agregar columna `deleted_at` a todas las tablas
2. Modificar DELETE para hacer soft delete
3. Crear endpoint de restauración (solo super_admin)
4. Agregar filtros `WHERE deleted_at IS NULL`

---

## ALTO

### ISS-006: Default Secrets en Código

**Archivo:** `src/lib/rsvp/trustedDevice.ts` L35 **Archivo:** `src/lib/rsvp/service.ts` L116
**Riesgo:** Bypass de autenticación

**Detalle:** Secrets por defecto en código:

```typescript
// trustedDevice.ts
return secret || 'dev-trust-device-secret';

// service.ts
const DEV_RSVP_TOKEN_SECRET = 'dev-rsvp-secret-change-me';
```

**Impacto:**

- Si env vars no están seteados, se usan secrets débiles
- Compromiso de tokens de autenticación

**Solución:**

1. Eliminar fallbacks
2. Throw error si secret no configurado
3. Validar env vars en startup

---

### ISS-007: Sin Headers de Seguridad

**Archivo:** `vercel.json` **Riesgo:** XSS, clickjacking, MIME sniffing

**Detalle:** Configuración actual:

```json
{
	"routes": [
		{
			"src": "^/_astro/(.*)$",
			"headers": {
				"cache-control": "public, max-age=31536000, immutable"
			}
		}
	]
}
```

Faltan:

- Content-Security-Policy
- X-Content-Type-Options
- X-Frame-Options
- Strict-Transport-Security
- Referrer-Policy

**Solución:** Actualizar `vercel.json` con headers de seguridad.

---

### ISS-008: Sin Validación de Schema

**Archivos:** 32 de 33 endpoints **Riesgo:** Data corruption, injection

**Detalle:** Solo 1 endpoint usa Zod (`/api/contact`). El resto usa validación manual o type
casting:

```typescript
// Problema: Acepta cualquier campo adicional
const body = (await request.json()) as {
	title?: string;
	slug?: string;
};
```

**Impacto:**

- Campos inesperados son aceptados silenciosamente
- No hay validación de tipos en runtime
- Posible inyección de datos

**Solución:**

1. Implementar Zod en todos los endpoints
2. Crear schemas reutilizables
3. Rechazar campos no esperados

---

### ISS-009: Race Conditions en Ediciones Concurrentes

**Archivos:** Todos los endpoints PATCH **Riesgo:** Pérdida de datos

**Detalle:** No hay optimistic locking:

```typescript
// TOCTOU vulnerability
const existing = await findEventById(eventId);
// ... tiempo para que otro usuario edite ...
const updated = await updateEvent(eventId, data); // Sobrescribe cambios
```

**Impacto:**

- Last-write-wins sin detección
- Pérdida silenciosa de datos
- Usuarios no saben que sus cambios fueron perdidos

**Solución:**

1. Implementar optimistic locking con `updated_at`
2. Incluir versión en WHERE clause
3. Retornar 409 Conflict si hay conflicto

---

### ISS-010: Sin Error Tracking

**Archivos:** Todo el proyecto **Riesgo:** Errores silenciosos en producción

**Detalle:** No hay integración con Sentry, LogRocket, o similar:

```typescript
// ErrorBoundary.tsx
console.error('ErrorBoundary caught an error:', error, errorInfo);
// Solo va a consola, nadie lo ve en producción
```

**Impacto:**

- Errores en producción no se detectan
- No hay visibilidad de estabilidad
- Tiempo de respuesta a incidentes largo

**Solución:**

1. Integrar Sentry
2. Configurar source maps
3. Agregar alertas para errores 500

---

### ISS-011: In-Memory Rate Limiting en Serverless

**Archivo:** `src/lib/rsvp/rateLimitProvider.ts` **Riesgo:** Rate limiting inefectivo

**Detalle:** Cuando Upstash no está configurado, usa in-memory:

```typescript
if (distributedEnabled && url && token) {
	cachedBackend = new UpstashRestBackend(url, token);
} else {
	cachedBackend = new InMemoryBackend(); // Inefectivo en Vercel
}
```

**Impacto:**

- En Vercel (serverless), cada invocación es instancia nueva
- Rate limiting no funciona entre requests
- Bypass trivial por round-robin

**Solución:**

1. Configurar Upstash Redis obligatorio en producción
2. Fallar startup si no está configurado

---

### ISS-012: Console.log en Producción

**Archivos:** 96 instancias encontradas **Riesgo:** Data leakage

**Detalle:** Múltiples console.log/console.error en código:

```typescript
// middleware.ts L185
console.error('[Middleware] Auth error:', error);

// service.ts L89
console.error('Audit log failed:', error);
```

**Impacto:**

- Información sensible puede filtrarse en logs
- No hay estructura ni categorización
- Logs difíciles de analizar

**Solución:**

1. Reemplazar con Pino (logging estructurado)
2. JSON format en producción
3. Correlation IDs para tracing

---

## MEDIO

### ISS-013: Respuestas API Inconsistentes

**Archivos:** Todos los endpoints **Riesgo:** Client errors, breaking changes

**Detalle:** Hay 3 formatos diferentes:

```typescript
// rsvp: { code, message, details }
// Legacy: { message }
// Contact: { error, code, meta }
```

**Solución:**

1. Crear helpers de respuesta estandarizados
2. Migrar todos los endpoints
3. Documentar formato

---

### ISS-014: Sin Health Check

**Archivo:** N/A **Riesgo:** Deploys ciegos

**Detalle:** No hay endpoint `/health` o similar.

**Solución:** Crear `GET /api/health` que verifique DB y dependencias.

---

### ISS-015: Sin Idempotency Keys

**Archivos:** POST endpoints **Riesgo:** Duplicados en retries

**Detalle:** No hay protección contra duplicados si el cliente hace retry.

**Solución:**

1. Crear tabla `idempotency_keys`
2. Aceptar header `Idempotency-Key`
3. Cachear respuestas por 24h

---

### ISS-016: Sin Security Event Logging

**Archivos:** Auth, autorización **Riesgo:** No detección de ataques

**Detalle:** No se loggean eventos de seguridad:

- Failed auth attempts
- Permission denials
- Rate limit hits

**Solución:**

1. Crear `security-logger.ts`
2. Loggear eventos con severidad
3. Alertar en eventos críticos

---

## BAJO

### ISS-017: Localhost Fallback en URLs

**Archivo:** `src/lib/rsvp/service.ts` L138, L616 **Riesgo:** Links rotos

**Detalle:** Fallback a localhost si BASE_URL no está seteado.

**Solución:** Validar que BASE_URL esté configurado en producción.

---

### ISS-018: Sin Paginación

**Archivos:** Queries de listado **Riesgo:** Performance degradation

**Detalle:** Queries retornan todas las filas:

```typescript
// findEventsForHost retorna TODOS los eventos
```

**Solución:** Agregar LIMIT/OFFSET a todas las queries de lista.

---

## Resumen por Severidad

| Severidad  | Cantidad | Issues            |
| ---------- | -------- | ----------------- |
| 🔴 CRÍTICO | 5        | ISS-001 a ISS-005 |
| 🟠 ALTO    | 7        | ISS-006 a ISS-012 |
| 🟡 MEDIO   | 4        | ISS-013 a ISS-016 |
| 🟢 BAJO    | 2        | ISS-017 a ISS-018 |

**Total: 18 issues**

---

**Documento generado:** 2026-02-15 **Próxima actualización:** Semanalmente durante hardening
