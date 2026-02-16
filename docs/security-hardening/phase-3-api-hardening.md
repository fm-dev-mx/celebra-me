# 📋 Fase 3 - API Hardening

**Prioridad:** 🟡 MEDIA  
**Estado:** 🔴 No Iniciada  
**Bloquea Deploy:** ❌ NO  
**Fecha Inicio:** Pendiente  
**Depende de:** Fase 1

---

## 🎯 Objetivo

Estandarizar y endurecer la API: validación de schemas con Zod, respuestas consistentes, y
idempotencia en operaciones críticas.

---

## 📋 Tareas

### Tarea 3.1: Implementar Validación de Schema con Zod

**ID:** API-001  
**Prioridad:** 🟡 MEDIA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @backend-lead

#### Descripción

Actualmente solo 1 de 33 endpoints usa validación de schema (Zod). Implementar validación estricta
en todos los endpoints.

#### Checklist de Ejecución

- [ ]   1. Crear schemas base:

```typescript
// src/schemas/common.ts
import { z } from 'zod';

export const UuidSchema = z.string().uuid();

export const PaginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const TimestampSchema = z.string().datetime();

export const EmailSchema = z.string().email();
```

- [ ]   2. Crear schemas de dominio:

```typescript
// src/schemas/events.ts
import { z } from 'zod';

export const EventTypeSchema = z.enum(['xv', 'boda', 'bautizo', 'cumple']);

export const EventStatusSchema = z.enum(['draft', 'published', 'archived']);

export const CreateEventSchema = z.object({
	title: z.string().min(1).max(200),
	slug: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-z0-9-]+$/),
	eventType: EventTypeSchema,
	date: z.string().datetime().optional(),
	location: z.string().max(500).optional(),
	description: z.string().max(2000).optional(),
	maxAllowedAttendees: z.number().int().min(1).max(20).optional(),
});

export const UpdateEventSchema = CreateEventSchema.partial().extend({
	_version: z.string().optional(), // Para optimistic locking
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
```

- [ ]   3. Crear middleware de validación:

```typescript
// src/lib/rsvp-v2/validation.ts
import { z } from 'zod';
import { ApiError } from './errors';

export async function validateBody<T>(request: Request, schema: z.ZodSchema<T>): Promise<T> {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		throw new ApiError(400, 'bad_request', 'Body JSON inválido');
	}

	const result = schema.safeParse(body);

	if (!result.success) {
		const issues = result.error.issues.map((issue) => ({
			path: issue.path.join('.'),
			message: issue.message,
		}));

		throw new ApiError(400, 'validation_error', 'Datos de entrada inválidos', { issues });
	}

	return result.data;
}

export function validateQuery<T>(searchParams: URLSearchParams, schema: z.ZodSchema<T>): T {
	const obj = Object.fromEntries(searchParams.entries());
	const result = schema.safeParse(obj);

	if (!result.success) {
		throw new ApiError(400, 'validation_error', 'Query params inválidos');
	}

	return result.data;
}
```

- [ ]   4. Aplicar validación a endpoints:

```typescript
// src/pages/api/dashboard/admin/events.ts
import { CreateEventSchema } from '@/schemas/events';
import { validateBody } from '@/lib/rsvp-v2/validation';

export const POST: APIRoute = async ({ request }) => {
	const { actorUserId } = await requireAdminStrongSession(request);

	// Validación automática con Zod
	const body = await validateBody(request, CreateEventSchema);

	// body ya está tipado y validado
	const event = await createEventAdmin({
		...body,
		actorUserId,
	});

	return new Response(JSON.stringify({ item: event }), {
		status: 201,
		headers: { 'Content-Type': 'application/json' },
	});
};
```

- [ ]   5. Migrar endpoints uno por uno (prioridad):
    - [ ] Admin events (GET, POST, PATCH)
    - [ ] Admin users (GET, PATCH)
    - [ ] Claim codes (GET, POST, PATCH, DELETE)
    - [ ] Guests (GET, POST, PATCH, DELETE)
    - [ ] Auth endpoints

- [ ]   6. Tests:
    - [ ] Test que campos inválidos retornan 400
    - [ ] Test que campos extra son rechazados
    - [ ] Test que tipos incorrectos son detectados
    - [ ] Test que mensajes de error son claros

#### Evidencia de Completado

- [ ] Todos los endpoints usan Zod
- [ ] Tests de validación pasando
- [ ] Documentación de schemas

---

### Tarea 3.2: Estandarizar Respuestas API

**ID:** API-002  
**Prioridad:** 🟡 MEDIA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @backend-lead

#### Descripción

Actualmente hay 3 formatos de respuesta diferentes. Estandarizar todos los endpoints a un formato
único.

#### Checklist de Ejecución

- [ ]   1. Crear helpers de respuesta:

```typescript
// src/lib/rsvp-v2/response.ts

interface SuccessResponse<T> {
	success: true;
	data: T;
	meta?: {
		page?: number;
		perPage?: number;
		total?: number;
		totalPages?: number;
	};
}

interface ErrorResponse {
	success: false;
	error: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
	};
}

export function successResponse<T>(data: T, meta?: SuccessResponse<T>['meta']): Response {
	const body: SuccessResponse<T> = {
		success: true,
		data,
		...(meta && { meta }),
	};

	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

export function createdResponse<T>(data: T): Response {
	return new Response(JSON.stringify({ success: true, data }), {
		status: 201,
		headers: { 'Content-Type': 'application/json' },
	});
}

export function errorResponse(
	code: string,
	message: string,
	status: number = 400,
	details?: Record<string, unknown>,
): Response {
	const body: ErrorResponse = {
		success: false,
		error: {
			code,
			message,
			...(details && { details }),
		},
	};

	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

// Shorthands comunes
export const badRequest = (msg: string, details?: unknown) =>
	errorResponse('bad_request', msg, 400, details ? { details } : undefined);

export const unauthorized = (msg = 'No autorizado') => errorResponse('unauthorized', msg, 401);

export const forbidden = (msg = 'Acceso denegado') => errorResponse('forbidden', msg, 403);

export const notFound = (resource: string) =>
	errorResponse('not_found', `${resource} no encontrado`, 404);

export const conflict = (msg: string, details?: unknown) =>
	errorResponse('conflict', msg, 409, details ? { details } : undefined);

export const tooManyRequests = (msg = 'Demasiadas peticiones') =>
	errorResponse('rate_limited', msg, 429, { retryAfter: 60 });

export const internalError = (msg = 'Error interno del servidor') =>
	errorResponse('internal_error', msg, 500);
```

- [ ]   2. Migrar endpoints al nuevo formato:

```typescript
// ANTES:
return new Response(JSON.stringify({ item: event }), {
	status: 200,
	headers: { 'Content-Type': 'application/json' },
});

// DESPUÉS:
return successResponse({ item: event });
```

- [ ]   3. Actualizar cliente API:

```typescript
// src/lib/dashboard/apiClient.ts

async request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json();

  if (!body.success) {
    throw new ApiError(
      response.status,
      body.error.code,
      body.error.message,
      body.error.details
    );
  }

  return body.data;
}
```

- [ ]   4. Documentar formato:

````markdown
## Formato de Respuesta API

### Éxito

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 100,
    "totalPages": 5
  }
}
```
````

### Error

```json
{
	"success": false,
	"error": {
		"code": "validation_error",
		"message": "Datos de entrada inválidos",
		"details": {
			"issues": [{ "path": "email", "message": "Email inválido" }]
		}
	}
}
```

````

- [ ] 5. Tests:
  - [ ] Test que formato es consistente
  - [ ] Test que meta incluye paginación
  - [ ] Test que errores incluyen código

#### Evidencia de Completado
- [ ] Todos los endpoints usan nuevo formato
- [ ] Documentación actualizada
- [ ] Tests pasando

---

### Tarea 3.3: Implementar Idempotency Keys

**ID:** API-003
**Prioridad:** 🟡 BAJA
**Estado:** 🔴 Pendiente
**Asignado a:** @backend-lead

#### Descripción
Agregar idempotencia a operaciones POST para evitar duplicados en caso de retries.

#### Checklist de Ejecución

- [ ] 1. Crear tabla de idempotency keys:
```sql
-- migrations/20260220_idempotency_keys.sql

CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  request_path TEXT NOT NULL,
  request_body_hash TEXT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

-- Cleanup job para keys expiradas
````

- [ ]   2. Crear middleware de idempotencia:

```typescript
// src/lib/rsvp-v2/idempotency.ts

export async function handleIdempotentRequest<T>(
	request: Request,
	handler: () => Promise<T>,
): Promise<T> {
	const idempotencyKey = request.headers.get('Idempotency-Key');

	if (!idempotencyKey) {
		// No idempotency requested, ejecutar normalmente
		return handler();
	}

	// Verificar si ya existe
	const cached = await getCachedResponse(idempotencyKey);

	if (cached) {
		// Verificar que es el mismo request
		const bodyHash = hashRequestBody(await request.clone().text());

		if (cached.requestBodyHash !== bodyHash) {
			throw new ApiError(
				409,
				'idempotency_conflict',
				'Idempotency key ya usada con request diferente',
			);
		}

		return cached.responseBody;
	}

	// Ejecutar y cachear
	const response = await handler();

	await cacheResponse(idempotencyKey, {
		requestPath: request.url,
		requestBodyHash: hashRequestBody(await request.clone().text()),
		responseBody: response,
		expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
	});

	return response;
}
```

- [ ]   3. Aplicar a endpoints críticos:

```typescript
// src/pages/api/dashboard/admin/events.ts

export const POST: APIRoute = async ({ request }) => {
	const { actorUserId } = await requireAdminStrongSession(request);
	const body = await validateBody(request, CreateEventSchema);

	const event = await handleIdempotentRequest(request, async () => {
		return createEventAdmin({ ...body, actorUserId });
	});

	return createdResponse(event);
};
```

- [ ]   4. Actualizar cliente:

```typescript
// Cliente genera key para operaciones idempotentes
async createEvent(data: CreateEventDTO): Promise<Event> {
  const idempotencyKey = generateUUID();

  return this.post('/api/dashboard/admin/events', data, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
}
```

- [ ]   5. Tests:
    - [ ] Test que retry con misma key retorna mismo resultado
    - [ ] Test que retry con body diferente falla
    - [ ] Test que key expira después de 24h

#### Evidencia de Completado

- [ ] Tests de idempotencia pasando
- [ ] Documentación de uso
- [ ] Cleanup job configurado

---

## 🚫 Bloqueos

| Bloqueo | Descripción             | Impacto        | Mitigación                   |
| ------- | ----------------------- | -------------- | ---------------------------- |
| Fase 1  | Esperando core security | Baja prioridad | Puede trabajarse en paralelo |

---

## ✅ Criterios de Aceptación

Esta fase se considera completa cuando:

1. ✅ Todos los endpoints usan Zod para validación
2. ✅ Todos los endpoints usan formato de respuesta estándar
3. ✅ Endpoints críticos soportan idempotency keys
4. ✅ Documentación de API actualizada
5. ✅ Tests de contrato API pasan

---

## 📊 Métricas de Éxito

| Métrica                          | Objetivo | Actual |
| -------------------------------- | -------- | ------ |
| Endpoints con Zod                | 100%     | 3%     |
| Formato de respuesta consistente | 100%     | 30%    |
| Endpoints con idempotencia       | 30%      | 0%     |
| Errores de validación claros     | ✅       | ❌     |

---

**Última actualización:** 2026-02-15  
**Próxima revisión:** Al iniciar Fase 3
