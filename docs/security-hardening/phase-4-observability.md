# 📋 Fase 4 - Observability

**Prioridad:** 🟠 ALTA  
**Estado:** 🔴 No Iniciada  
**Bloquea Deploy:** ❌ NO (pero crítico para producción)  
**Fecha Inicio:** Pendiente  
**Depende de:** Fase 1

---

## 🎯 Objetivo

Implementar observabilidad completa: error tracking, logging estructurado, health checks, y security
event logging.

---

## 📋 Tareas

### Tarea 4.1: Integrar Sentry para Error Tracking

**ID:** OBS-001  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @devops-lead

#### Descripción

Integrar Sentry para capturar y rastrear errores en producción.

#### Checklist de Ejecución

- [ ]   1. Instalar dependencias:

```bash
npm install @sentry/astro
```

- [ ]   2. Configurar Sentry en `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';
import sentry from '@sentry/astro';

export default defineConfig({
	integrations: [
		sentry({
			dsn: process.env.SENTRY_DSN,
			sourceMapsUploadOptions: {
				project: 'celebra-me',
				authToken: process.env.SENTRY_AUTH_TOKEN,
			},
		}),
	],
});
```

- [ ]   3. Crear variable de entorno:

```bash
# .env.example
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx  # Para upload de source maps
```

- [ ]   4. Actualizar ErrorBoundary:

```typescript
// src/components/dashboard/ErrorBoundary.tsx
import * as Sentry from '@sentry/astro';

componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  Sentry.captureException(error, {
    extra: errorInfo,
    tags: {
      component: 'DashboardErrorBoundary',
    },
  });
}
```

- [ ]   5. Agregar contexto a errores de API:

```typescript
// src/lib/rsvp-v2/errors.ts
import * as Sentry from '@sentry/astro';

export function handleApiError(error: unknown, context: Record<string, unknown>) {
	if (error instanceof ApiError) {
		if (error.status >= 500) {
			Sentry.captureException(error, {
				extra: context,
				level: 'error',
			});
		}
	}
}
```

- [ ]   6. Configurar alertas en Sentry:
    - [ ] Slack integration
    - [ ] Email alerts para errores 500
    - [ ] Performance alerts para latencia alta

- [ ]   7. Tests:
    - [ ] Forzar error en staging y verificar en Sentry
    - [ ] Verificar source maps funcionan
    - [ ] Verificar contexto del usuario en errores

#### Evidencia de Completado

- [ ] Sentry dashboard con errores capturados
- [ ] Alertas configuradas y funcionando
- [ ] Documentación de uso

---

### Tarea 4.2: Implementar Logging Estructurado

**ID:** OBS-002  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @backend-lead

#### Descripción

Reemplazar console.log con logging estructurado usando Pino para producción.

#### Checklist de Ejecución

- [ ]   1. Instalar Pino:

```bash
npm install pino pino-pretty
```

- [ ]   2. Crear logger:

```typescript
// src/lib/logger.ts
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
	level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
	transport: isProduction
		? undefined // JSON en producción
		: {
				target: 'pino-pretty',
				options: {
					colorize: true,
					translateTime: 'yyyy-mm-dd HH:MM:ss',
				},
			},
	base: {
		env: process.env.NODE_ENV,
		version: process.env.npm_package_version,
	},
});

// Helper para crear child loggers con contexto
export function createRequestLogger(requestId: string, userId?: string) {
	return logger.child({ requestId, userId });
}
```

- [ ]   3. Crear middleware de correlation ID:

```typescript
// src/middleware.ts
import { randomUUID } from 'crypto';

export const onRequest = async (context, next) => {
	const requestId = context.request.headers.get('X-Request-ID') || randomUUID();
	const logger = createRequestLogger(requestId);

	// Agregar al contexto
	context.locals.requestId = requestId;
	context.locals.logger = logger;

	logger.info(
		{
			method: context.request.method,
			path: context.url.pathname,
			userAgent: context.request.headers.get('user-agent'),
		},
		'Request started',
	);

	const response = await next();

	logger.info(
		{
			status: response.status,
		},
		'Request completed',
	);

	// Agregar correlation ID a respuesta
	response.headers.set('X-Request-ID', requestId);

	return response;
};
```

- [ ]   4. Reemplazar console.log:

```typescript
// ANTES:
console.error('[Middleware] Auth error:', error);

// DESPUÉS:
logger.error({ error, requestId }, 'Authentication failed');
```

- [ ]   5. Configurar log aggregation:
    - [ ] Opción A: Logtail (Vercel integration)
    - [ ] Opción B: Datadog
    - [ ] Opción C: AWS CloudWatch

- [ ]   6. Tests:
    - [ ] Verificar logs son JSON en producción
    - [ ] Verificar correlation ID se propaga
    - [ ] Verificar logs incluyen contexto

#### Evidencia de Completado

- [ ] Logs aparecen en servicio de aggregación
- [ ] Correlation ID funciona end-to-end
- [ ] No hay console.log en producción

---

### Tarea 4.3: Crear Health Check Endpoint

**ID:** OBS-003  
**Prioridad:** 🔴 ALTA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @backend-lead

#### Descripción

Crear endpoint de health check para verificar estado del sistema.

#### Checklist de Ejecución

- [ ]   1. Crear endpoint:

```typescript
// src/pages/api/health.ts
import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';

export const GET: APIRoute = async () => {
	const checks = {
		timestamp: new Date().toISOString(),
		status: 'healthy',
		version: process.env.npm_package_version || 'unknown',
		checks: {
			database: false,
			// cache: false, // Si usas Redis
		},
	};

	let status = 200;

	// Check database
	try {
		const { error } = await supabase.from('events').select('id').limit(1);
		checks.checks.database = !error;
		if (error) {
			checks.status = 'degraded';
			status = 503;
		}
	} catch {
		checks.checks.database = false;
		checks.status = 'unhealthy';
		status = 503;
	}

	return new Response(JSON.stringify(checks), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-cache',
		},
	});
};
```

- [ ]   2. Crear health check profundo (opcional):

```typescript
// src/pages/api/health/deep.ts
// Verifica todas las dependencias críticas
// - Database connectivity
// - External APIs
// - Queue workers
// - etc.
```

- [ ]   3. Configurar en Vercel:

```json
// vercel.json
{
	"checks": {
		"health": {
			"path": "/api/health",
			"interval": "30s"
		}
	}
}
```

- [ ]   4. Tests:
    - [ ] Test que retorna 200 cuando todo OK
    - [ ] Test que retorna 503 cuando DB caída
    - [ ] Test que headers incluyen no-cache

#### Evidencia de Completado

- [ ] `/api/health` responde correctamente
- [ ] Vercel usa health check para deploys
- [ ] Tests pasando

---

### Tarea 4.4: Implementar Security Event Logging

**ID:** OBS-004  
**Prioridad:** 🔴 ALTA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @backend-lead

#### Descripción

Loggear eventos de seguridad para detectar y responder a ataques.

#### Checklist de Ejecución

- [ ]   1. Crear logger de seguridad:

```typescript
// src/lib/security-logger.ts
import { logger } from './logger';

export interface SecurityEvent {
	type: 'auth_failure' | 'permission_denied' | 'rate_limit_hit' | 'suspicious_activity';
	severity: 'low' | 'medium' | 'high' | 'critical';
	userId?: string;
	ip: string;
	userAgent?: string;
	details: Record<string, unknown>;
}

export function logSecurityEvent(event: SecurityEvent) {
	logger.warn(
		{
			...event,
			category: 'security',
			timestamp: new Date().toISOString(),
		},
		`Security event: ${event.type}`,
	);

	// Alertar si es crítico
	if (event.severity === 'critical') {
		// Enviar alerta a Slack/PagerDuty
		sendSecurityAlert(event);
	}
}
```

- [ ]   2. Loggear failed auth:

```typescript
// src/pages/api/auth/login-host.ts
try {
	auth = await signInWithPassword({ email, password });
} catch (error) {
	logSecurityEvent({
		type: 'auth_failure',
		severity: 'medium',
		ip: getClientIp(request),
		userAgent: request.headers.get('user-agent') || undefined,
		details: { email, reason: 'invalid_credentials' },
	});

	throw new ApiError(401, 'unauthorized', 'Credenciales inválidas.');
}
```

- [ ]   3. Loggear rate limit hits:

```typescript
// src/lib/rsvp-v2/rateLimitProvider.ts
if (!result.allowed) {
	logSecurityEvent({
		type: 'rate_limit_hit',
		severity: 'low',
		ip: identifier,
		details: { namespace, retryAfter: result.retryAfter },
	});

	throw new ApiError(429, 'rate_limited', 'Demasiadas peticiones');
}
```

- [ ]   4. Loggear permisos denegados:

```typescript
// src/lib/rsvp-v2/authorization.ts
if (!isSuperAdmin) {
	logSecurityEvent({
		type: 'permission_denied',
		severity: 'high',
		userId: session.user.id,
		ip: getClientIp(request),
		details: {
			attemptedAction: 'admin_access',
			requiredRole: 'super_admin',
		},
	});

	throw new ApiError(403, 'forbidden', 'Acceso denegado');
}
```

- [ ]   5. Crear dashboard/análisis:
    - [ ] Queries para detectar patrones:
        - IPs con múltiples failed auth
        - Usuarios con permisos denegados repetidos
        - Spikes en rate limit hits

- [ ]   6. Tests:
    - [ ] Test que eventos de seguridad se loguean
    - [ ] Test que severidad correcta se asigna
    - [ ] Test que alerts funcionan para críticos

#### Evidencia de Completado

- [ ] Eventos de seguridad aparecen en logs
- [ ] Queries de análisis funcionan
- [ ] Alertas enviadas para eventos críticos

---

## 🚫 Bloqueos

| Bloqueo | Descripción                  | Impacto | Mitigación |
| ------- | ---------------------------- | ------- | ---------- |
| Ninguno | Puede trabajarse en paralelo | -       | -          |

---

## ✅ Criterios de Aceptación

Esta fase se considera completa cuando:

1. ✅ Sentry captura errores de producción
2. ✅ Logs son estructurados (JSON) y agregados
3. ✅ `/api/health` responde 200/503 correctamente
4. ✅ Eventos de seguridad se loguean con contexto
5. ✅ Alertas funcionan para eventos críticos
6. ✅ Correlation ID traza requests end-to-end

---

## 📊 Métricas de Éxito

| Métrica                      | Objetivo | Actual |
| ---------------------------- | -------- | ------ |
| Errores en Sentry            | ✅       | ❌     |
| Logs estructurados           | 100%     | 0%     |
| Health check uptime          | 99.9%    | N/A    |
| Security events logged       | ✅       | ❌     |
| MTTR (Mean Time To Recovery) | < 1h     | N/A    |

---

**Última actualización:** 2026-02-15  
**Próxima revisión:** Al iniciar Fase 4
