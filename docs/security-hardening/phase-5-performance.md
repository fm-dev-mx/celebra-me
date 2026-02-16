# 📋 Fase 5 - Performance

**Prioridad:** 🟡 BAJA  
**Estado:** 🔴 No Iniciada  
**Bloquea Deploy:** ❌ NO  
**Fecha Inicio:** Pendiente  
**Depende de:** Fase 1

---

## 🎯 Objetivo

Optimizar performance: índices de BD, paginación, y timeouts.

---

## 📋 Tareas

### Tarea 5.1: Agregar Índices Faltantes

**ID:** PERF-001  
**Prioridad:** 🟠 MEDIA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @database-admin

#### Descripción

Agregar índices para mejorar performance de queries frecuentes.

#### Checklist de Ejecución

- [ ]   1. Analizar queries frecuentes:

```sql
-- Queries sin índice óptimo encontrados:
-- 1. audit_logs por fecha (para dashboard admin)
-- 2. guest_invitations por status (para contadores)
-- 3. events por status y fecha (para listados)
```

- [ ]   2. Crear migración:

```sql
-- migrations/20260220_performance_indexes.sql

-- Para audit_logs - queries por fecha
CREATE INDEX idx_audit_logs_created_at_desc
ON audit_logs(created_at DESC);

CREATE INDEX idx_audit_logs_actor_action
ON audit_logs(actor_id, action)
WHERE actor_id IS NOT NULL;

-- Para guest_invitations - filtrado por status
CREATE INDEX idx_guest_invitations_status
ON guest_invitations(attendance_status)
WHERE attendance_status = 'pending';

-- Para events - listado admin con filtros
CREATE INDEX idx_events_status_created
ON events(status, created_at DESC)
WHERE deleted_at IS NULL;

-- Para event_claim_codes - búsqueda por evento + estado
CREATE INDEX idx_claim_codes_event_active
ON event_claim_codes(event_id)
WHERE active = true AND deleted_at IS NULL;

-- Partial index para búsquedas de slugs activos
CREATE INDEX idx_events_slug_active
ON events(slug)
WHERE deleted_at IS NULL;
```

- [ ]   3. Analizar query plans:

```sql
-- Verificar que queries usan índices
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;

-- Debe usar: idx_audit_logs_created_at_desc
```

- [ ]   4. Documentar índices:

```markdown
## Índices de Performance

| Índice                         | Tabla             | Uso                                |
| ------------------------------ | ----------------- | ---------------------------------- |
| idx_audit_logs_created_at_desc | audit_logs        | Dashboard admin, recientes primero |
| idx_guest_invitations_status   | guest_invitations | Contadores de status               |
| idx_events_status_created      | events            | Listado con filtros                |
```

- [ ]   5. Tests:
    - [ ] EXPLAIN muestra uso de índices
    - [ ] Tiempos de query mejoran
    - [ ] No hay regression en writes

#### Evidencia de Completado

- [ ] Migración aplicada
- [ ] Query plans muestran índices
- [ ] Benchmarks mejorados

---

### Tarea 5.2: Implementar Paginación

**ID:** PERF-002  
**Prioridad:** 🟠 MEDIA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @backend-lead

#### Descripción

Agregar paginación a todos los endpoints de listado.

#### Checklist de Ejecución

- [ ]   1. Modificar repositorios:

```typescript
// src/lib/rsvp-v2/repository.ts

interface PaginationOptions {
	page: number;
	perPage: number;
}

interface PaginatedResult<T> {
	items: T[];
	meta: {
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
	};
}

export async function listEventsPaginated(
	options: PaginationOptions,
): Promise<PaginatedResult<Event>> {
	const { page, perPage } = options;
	const offset = (page - 1) * perPage;

	// Query count total
	const { count } = await supabase
		.from('events')
		.select('*', { count: 'exact', head: true })
		.is('deleted_at', null);

	// Query paginada
	const { data, error } = await supabase
		.from('events')
		.select('*')
		.is('deleted_at', null)
		.order('created_at', { ascending: false })
		.range(offset, offset + perPage - 1);

	if (error) throw error;

	return {
		items: data || [],
		meta: {
			page,
			perPage,
			total: count || 0,
			totalPages: Math.ceil((count || 0) / perPage),
		},
	};
}
```

- [ ]   2. Actualizar endpoints:

```typescript
// src/pages/api/dashboard/admin/events.ts
import { PaginationSchema } from '@/schemas/common';
import { validateQuery } from '@/lib/rsvp-v2/validation';

export const GET: APIRoute = async ({ request }) => {
	const { actorUserId } = await requireAdminStrongSession(request);

	const url = new URL(request.url);
	const pagination = validateQuery(url.searchParams, PaginationSchema);

	const result = await listEventsPaginated(pagination);

	return successResponse(result.items, result.meta);
};
```

- [ ]   3. Actualizar UI:

```typescript
// src/components/dashboard/events/EventsAdminTable.tsx
const [page, setPage] = useState(1);
const [perPage, setPerPage] = useState(20);

const { data, isLoading } = useQuery({
  queryKey: ['events', page, perPage],
  queryFn: () => adminApi.listEvents({ page, perPage }),
});

// Agregar controles de paginación
<Pagination
  page={page}
  perPage={perPage}
  total={data.meta.total}
  onPageChange={setPage}
/>
```

- [ ]   4. Cursor-based pagination (opcional, para tablas grandes):

```typescript
// Para tablas > 10k rows, usar cursor-based
interface CursorPaginationOptions {
	cursor?: string;
	perPage: number;
	direction: 'forward' | 'backward';
}
```

- [ ]   5. Tests:
    - [ ] Test paginación retorna items correctos
    - [ ] Test metadata es correcta
    - [ ] Test límites (max 100 per page)

#### Evidencia de Completado

- [ ] Todos los listados tienen paginación
- [ ] UI muestra controles de paginación
- [ ] Tests pasando

---

### Tarea 5.3: Configurar Timeouts

**ID:** PERF-003  
**Prioridad:** 🟡 BAJA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @backend-lead

#### Descripción

Configurar timeouts para prevenir queries colgadas.

#### Checklist de Ejecución

- [ ]   1. Configurar timeout en Supabase:

```sql
-- Configurar statement timeout (10 segundos)
ALTER DATABASE postgres SET statement_timeout = '10s';
```

- [ ]   2. Agregar timeout a fetch calls:

```typescript
// src/lib/rsvp-v2/repository.ts

const FETCH_TIMEOUT = 10000; // 10 segundos

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
		});
		return response;
	} finally {
		clearTimeout(timeoutId);
	}
}
```

- [ ]   3. Timeout específicos por operación:

```typescript
// Queries rápidas: 5s
// Queries de reporte: 30s
// Uploads: 60s

const TIMEOUTS = {
	query: 5000,
	mutation: 10000,
	report: 30000,
	upload: 60000,
} as const;
```

- [ ]   4. Manejar timeout errors:

```typescript
try {
	const result = await fetchWithTimeout(url, options);
} catch (error) {
	if (error.name === 'AbortError') {
		throw new ApiError(504, 'gateway_timeout', 'La operación tomó demasiado tiempo');
	}
	throw error;
}
```

- [ ]   5. Tests:
    - [ ] Test que timeout funciona
    - [ ] Test que error 504 se retorna
    - [ ] Test que UI maneja timeout gracefully

#### Evidencia de Completado

- [ ] Timeouts configurados
- [ ] Tests de timeout pasando
- [ ] Documentación de límites

---

## 🚫 Bloqueos

| Bloqueo | Descripción                  | Impacto | Mitigación |
| ------- | ---------------------------- | ------- | ---------- |
| Ninguno | Puede trabajarse en paralelo | -       | -          |

---

## ✅ Criterios de Aceptación

Esta fase se considera completa cuando:

1. ✅ Índices creados y queries los usan
2. ✅ Todos los listados tienen paginación
3. ✅ Timeouts configurados (DB, API, cliente)
4. ✅ Performance mejoró significativamente
5. ✅ No hay queries sin paginación

---

## 📊 Métricas de Éxito

| Métrica                  | Objetivo | Actual |
| ------------------------ | -------- | ------ |
| Query time p95           | < 100ms  | N/A    |
| Queries usando índices   | 100%     | N/A    |
| Endpoints con paginación | 100%     | 0%     |
| Timeouts configurados    | ✅       | ❌     |

---

**Última actualización:** 2026-02-15  
**Próxima revisión:** Al iniciar Fase 5
