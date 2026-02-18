# 📋 Fase 2 - Data Integrity

**Prioridad:** 🟠 ALTA **Estado:** 🔴 No Iniciada **Bloquea Deploy:** ⚠️ Parcialmente **Fecha
Inicio:** Pendiente **Depende de:** Fase 1

---

## 🎯 Objetivo

Implementar protecciones de integridad de datos: soft delete, protección del último super_admin, y
optimistic locking para ediciones concurrentes.

---

## 📋 Tareas

### Tarea 2.1: Implementar Soft Delete

**ID:** DATA-001 **Prioridad:** 🔴 CRÍTICA **Estado:** 🔴 Pendiente **Asignado a:** @database-admin

#### Descripción

Actualmente todas las operaciones DELETE son hard delete (eliminación física). Implementar soft
delete permite recuperación de datos y auditoría completa.

**Tablas a modificar:**

- `events`
- `guest_invitations`
- `event_claim_codes`
- `event_memberships`

#### Checklist de Ejecución

- [ ]   1. Crear migración de base de datos:

```sql
-- migrations/20260220_add_soft_delete.sql

-- Agregar columnas deleted_at
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE public.guest_invitations
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE public.event_claim_codes
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Crear índices para queries frecuentes
CREATE INDEX idx_events_deleted_at ON public.events(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_guest_invitations_deleted_at ON public.guest_invitations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_claim_codes_deleted_at ON public.event_claim_codes(deleted_at) WHERE deleted_at IS NULL;

-- Actualizar RLS policies para excluir soft deleted
-- (las policies actuales filtrarán automáticamente)
```

- [ ]   2. Crear funciones RPC para soft delete:

```sql
-- Soft delete event
CREATE OR REPLACE FUNCTION soft_delete_event(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing events%ROWTYPE;
BEGIN
  -- Verificar ownership o super_admin
  SELECT * INTO v_existing
  FROM events
  WHERE id = p_event_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Verificar permisos
  IF v_existing.owner_user_id != p_user_id THEN
    -- Verificar si es super_admin
    IF NOT EXISTS (
      SELECT 1 FROM app_user_roles
      WHERE user_id = p_user_id AND role = 'super_admin'
    ) THEN
      RETURN false;
    END IF;
  END IF;

  -- Soft delete
  UPDATE events
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = p_event_id;

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, target_table, target_id, old_data)
  VALUES (p_user_id, 'soft_delete_event', 'events', p_event_id, to_jsonb(v_existing));

  RETURN true;
END;
$$;
```

- [ ]   3. Modificar repositorios para usar soft delete:

```typescript
// src/lib/rsvp/repository.ts

// ANTES:
export async function deleteEventService(eventId: string): Promise<void> {
	await supabaseRestRequest({
		method: 'DELETE',
		table: 'events',
		query: { id: `eq.${eventId}` },
	});
}

// DESPUÉS:
export async function softDeleteEventService(eventId: string, userId: string): Promise<boolean> {
	const { data, error } = await supabase.rpc('soft_delete_event', {
		p_event_id: eventId,
		p_user_id: userId,
	});

	if (error) throw error;
	return data;
}
```

- [ ]   4. Crear endpoint de restauración (solo super_admin):

```typescript
// src/pages/api/dashboard/admin/events/[eventId]/restore.ts
export const POST: APIRoute = async ({ params, request }) => {
	const { eventId } = params;
	const { actorUserId } = await requireAdminStrongSession(request);

	const restored = await restoreEventService(eventId, actorUserId);

	if (!restored) {
		throw new ApiError(404, 'not_found', 'Evento no encontrado o no puede ser restaurado');
	}

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};
```

- [ ]   5. Actualizar queries para excluir soft deleted:

```typescript
// Todas las queries SELECT deben incluir:
query: {
	deleted_at: 'is.null';
}
```

- [ ]   6. Tests:
    - [ ] Test soft delete marca deleted_at
    - [ ] Test datos no aparecen en queries normales
    - [ ] Test super_admin puede restaurar
    - [ ] Test audit log se crea

#### Evidencia de Completado

- [ ] Migración aplicada en producción
- [ ] Tests de soft delete pasando
- [ ] Documentación de proceso de restauración

---

### Tarea 2.2: Protección Server-Side Último Super Admin

**ID:** DATA-002 **Prioridad:** 🔴 CRÍTICA **Estado:** 🔴 Pendiente **Asignado a:** @backend-lead

#### Descripción

Actualmente la protección contra eliminar el último super_admin es solo cliente-side. Un atacante
puede bypass esto llamando directamente a la API.

**Archivo vulnerable:**

- `src/pages/api/dashboard/admin/users/[userId]/role.ts`

#### Checklist de Ejecución

- [ ]   1. Crear función RPC para verificación segura:

```sql
-- migrations/20260220_protect_last_super_admin.sql

CREATE OR REPLACE FUNCTION can_change_user_role(
  p_target_user_id uuid,
  p_new_role text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_super_admin_count integer;
  v_target_current_role text;
BEGIN
  -- Obtener rol actual del target
  SELECT role INTO v_target_current_role
  FROM app_user_roles
  WHERE user_id = p_target_user_id;

  -- Si no está cambiando de super_admin a otra cosa, permitir
  IF v_target_current_role != 'super_admin' OR p_new_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- Contar super_admins activos
  SELECT COUNT(*) INTO v_super_admin_count
  FROM app_user_roles
  WHERE role = 'super_admin';

  -- Permitir solo si hay más de 1 super_admin
  RETURN v_super_admin_count > 1;
END;
$$;
```

- [ ]   2. Modificar endpoint de cambio de rol:

```typescript
// src/pages/api/dashboard/admin/users/[userId]/role.ts

export const PATCH: APIRoute = async ({ params, request }) => {
	const { userId } = params;
	const { role: newRole } = await request.json();
	const { actorUserId } = await requireAdminStrongSession(request);

	// Verificación server-side del último super_admin
	const { data: canChange, error: checkError } = await supabase.rpc('can_change_user_role', {
		p_target_user_id: userId,
		p_new_role: newRole,
	});

	if (checkError || !canChange) {
		throw new ApiError(
			403,
			'forbidden',
			'No se puede eliminar el último super_admin del sistema.',
		);
	}

	// Continuar con el cambio...
	const result = await changeUserRoleAdmin({
		userId,
		role: newRole,
		actorUserId,
	});

	return new Response(JSON.stringify(result), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};
```

- [ ]   3. Mantener protección cliente como UX:

```typescript
// src/components/dashboard/users/UsersAdminTable.tsx
// Mantener el check actual pero agregar manejo de error del server

const handleRoleChange = async (userId: string, newRole: string) => {
	// Check cliente (UX improvement)
	if (isLastSuperAdmin(userId, newRole)) {
		alert('No se puede eliminar el último super_admin del sistema.');
		return;
	}

	try {
		await adminApi.updateUserRole(userId, newRole);
	} catch (error) {
		if (error.code === 'forbidden') {
			alert(error.message); // "No se puede eliminar el último super_admin..."
		}
	}
};
```

- [ ]   4. Tests:
    - [ ] Test que API rechaza eliminar último super_admin
    - [ ] Test que bypass cliente no funciona
    - [ ] Test que cambios válidos funcionan

#### Evidencia de Completado

- [ ] Tests de protección pasando
- [ ] Validación manual de bypass fallido
- [ ] Documentación de protección

---

### Tarea 2.3: Implementar Optimistic Locking

**ID:** DATA-003 **Prioridad:** 🟠 ALTA **Estado:** 🔴 Pendiente **Asignado a:** @backend-lead

#### Descripción

Implementar optimistic locking para detectar ediciones concurrentes y prevenir pérdida de datos
(last-write-wins).

**Endpoints a proteger:**

- `PATCH /api/dashboard/admin/events/[id]`
- `PATCH /api/dashboard/guests/[id]`
- `PATCH /api/dashboard/claimcodes/[id]`

#### Checklist de Ejecución

- [ ]   1. Modificar queries UPDATE para usar optimistic locking:

```typescript
// src/lib/rsvp/repository.ts

// ANTES:
export async function updateEventService(eventId: string, data: Partial<Event>): Promise<Event> {
	const { data: result, error } = await supabase
		.from('events')
		.update(data)
		.eq('id', eventId)
		.select()
		.single();

	if (error) throw error;
	return result;
}

// DESPUÉS:
export async function updateEventService(
	eventId: string,
	data: Partial<Event>,
	expectedVersion: string, // updated_at timestamp
): Promise<Event> {
	const { data: result, error } = await supabase
		.from('events')
		.update(data)
		.eq('id', eventId)
		.eq('updated_at', expectedVersion) // Optimistic locking
		.select()
		.single();

	if (!result) {
		throw new ApiError(
			409,
			'conflict',
			'El recurso fue modificado por otro usuario. Por favor, recarga y vuelve a intentar.',
		);
	}

	if (error) throw error;
	return result;
}
```

- [ ]   2. Modificar API endpoints para aceptar versión:

```typescript
// src/pages/api/dashboard/admin/events/[eventId].ts

export const PATCH: APIRoute = async ({ params, request }) => {
	const { eventId } = params;
	const body = await request.json();
	const { actorUserId } = await requireAdminStrongSession(request);

	// Extraer versión del body o header
	const expectedVersion = body._version || request.headers.get('If-Match');

	if (!expectedVersion) {
		throw new ApiError(400, 'bad_request', 'Versión requerida (_version o If-Match header)');
	}

	// Remover _version del data
	const { _version, ...updateData } = body;

	try {
		const updated = await updateEventService(eventId, updateData, expectedVersion);

		return new Response(JSON.stringify({ item: updated }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		if (error instanceof ApiError && error.code === 'conflict') {
			return new Response(
				JSON.stringify({
					code: 'conflict',
					message: error.message,
					currentVersion: await getEventVersion(eventId), // Retornar versión actual
				}),
				{ status: 409, headers: { 'Content-Type': 'application/json' } },
			);
		}
		throw error;
	}
};
```

- [ ]   3. Actualizar cliente para manejar versiones:

```typescript
// src/lib/dashboard/adminApi.ts

async updateEvent(
  eventId: string,
  data: Partial<Event>,
  version: string
): Promise<Event> {
  const response = await this.patch(`/api/dashboard/admin/events/${eventId}`, {
    ...data,
    _version: version,
  });

  if (response.status === 409) {
    const error = await response.json();
    throw new ConflictError(error.message, error.currentVersion);
  }

  return response.json();
}
```

- [ ]   4. UI para manejar conflictos:

```typescript
// En componentes React
const handleSave = async () => {
	try {
		await updateEvent(eventId, data, currentVersion);
	} catch (error) {
		if (error instanceof ConflictError) {
			// Mostrar modal de conflicto
			showConflictModal({
				message: 'El evento fue modificado por otro usuario',
				currentVersion: error.currentVersion,
				onReload: () => reloadEvent(),
				onForceUpdate: () => updateEvent(eventId, data, error.currentVersion),
			});
		}
	}
};
```

- [ ]   5. Tests:
    - [ ] Test que edición concurrente detecta conflicto
    - [ ] Test que edición secuencial funciona
    - [ ] Test que UI muestra conflicto correctamente

#### Evidencia de Completado

- [ ] Tests de optimistic locking pasando
- [ ] Demostración de manejo de conflicto
- [ ] Documentación de patrón

---

## 🚫 Bloqueos

| Bloqueo     | Descripción                    | Impacto                          | Mitigación               |
| ----------- | ------------------------------ | -------------------------------- | ------------------------ |
| Fase 1      | Esperando rate limiting y CSRF | No se puede probar en producción | Completar Fase 1 primero |
| Migraciones | Requieren downtime planificado | Deploy cuidadoso                 | Hacer en horario bajo    |

---

## ✅ Criterios de Aceptación

Esta fase se considera completa cuando:

1. ✅ Todas las tablas críticas tienen soft delete implementado
2. ✅ API rechaza cambios de rol que eliminen el último super_admin
3. ✅ Ediciones concurrentes detectan conflictos (409)
4. ✅ UI maneja conflictos de forma amigable
5. ✅ Tests de integridad de datos pasan
6. ✅ Documentación de recuperación de datos creada

---

## 📊 Métricas de Éxito

| Métrica                           | Objetivo | Actual |
| --------------------------------- | -------- | ------ |
| Tablas con soft delete            | 100%     | 0%     |
| Protección último admin (server)  | ✅       | ❌     |
| Endpoints con optimistic locking  | 100%     | 0%     |
| Pérdida de datos por concurrencia | 0        | N/A    |

---

## 📝 Notas

- **⚠️ ALERTA:** Las migraciones de soft delete requieren backup antes de aplicar
- **💡 TIP:** Considerar agregar UI de "papelera" para restaurar datos borrados
- **📚 Ref:** https://martinfowler.com/eaaCatalog/optimisticOfflineLock.html

---

**Última actualización:** 2026-02-15 **Próxima revisión:** Al iniciar Fase 2
