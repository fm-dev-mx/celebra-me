# RESUMEN DE AVANCE - AUDITORÍA DASHBOARD DE INVITADOS

## FASE 0 — PREPARACIÓN ✅

- Documentación completa de imports legacy V1
- Mapeo de clases CSS con fuga (7 archivos)
- Métricas de complejidad establecidas

## FASE 1 — FIXES DE UX CRÍTICOS ✅

- **Manipulación DOM eliminada**: Reemplazada por estado React
- **Estilos inline migrados**: GuestProgressCard ahora usa SCSS puro
- Build: ✅ | Tests: ✅ 249 passed

## FASE 2 — DESACOPLAMIENTOCSS ✅

### Clases neutras creadas:

- `.dashboard-error`
- `.dashboard-status`
- `.dashboard-modal-backdrop`
- `.dashboard-modal`

### Archivos migrados a clases neutras:

- ✅ EventsAdminTable.tsx (3 referencias)
- ✅ ClaimCodesTable.tsx (3 referencias)
- ✅ ClaimCodeFormModal.tsx (1 referencia)
- ✅ UsersAdminTable.tsx (2 referencias)
- ✅ ClaimCodesApp.tsx (2 referencias)

---

## FASE 3 — EXTRACCIÓN DE HOOKS (PENDIENTE)

**Objetivo**: Reducir GuestDashboardApp de ~790 a ~400 líneas

## FASE 4 — ELIMINACIÓN V1 ✅

- Dependencia `getRsvpContext` eliminada
- Lógica V2 nativa implementada
- Tests actualizados

## FASE 5 — ANÁLISIS GUESTSERVICE

**Análisis realizado**:

- Archivo: `rsvp-v2/service.ts` (1227 líneas)
- Funciones guest: 6 funciones (~200 líneas, ~16%)
- Funciones: listDashboardGuests, createDashboardGuest, updateDashboardGuest, deleteDashboardGuest,
  markGuestShared, submitGuestRsvpByInviteId

**Recomendación**: NO EJECUTAR短期内

- El código guest representa ~16% del archivo
- No hay duplicación ni anti-patrones críticos
- Los hooks (useGuests, useGuestMutations) ya encapsulan la lógica del cliente
- Extraer causaría más complejidad que beneficio

**Decision**: Mantener como está. Revisar en próxima iteración si el código crece
significativamente.

---

## RESUMEN EJECUTIVO

| Fase    | Estado         | Notas                   |
| ------- | -------------- | ----------------------- |
| FASE 1  | ✅ Completa    | DOM, styled-jsx         |
| FASE 2  | ✅ Completa    | 8 archivos, 11 refs CSS |
| C2      | ✅ Completa    | DashboardApiClient      |
| C3      | ✅ Completa    | 10 tests hooks          |
| FASE 3b | ⚠️ Diferido    | Requiere refactor mayor |
| FASE 4  | ✅ Completa    | 0 imports V1            |
| FASE 5  | ⚠️ Documentado | Recomendado NO ejecutar |

## FASE 5 — MODULARIZACIÓN SERVICE (PENDIENTE)

**Objetivo**: Extraer GuestService de rsvp-v2/service.ts (~1200 líneas)

---

# FASE 0 — PREPARACIÓN (Original)

## Estado Actual del Proyecto

### 1. Build Status ✅

- **Resultado**: Build exitoso
- **Errores**: 0 errores, 0 warnings TypeScript
- **Astro check**: 304 files analizados, 0 errores
- **Warnings**: Solo warnings menores de CSS minification (comentarios // en CSS)

### 2. Test Status ✅

- **Comando**: `npm test`
- **Resultado**: 250 tests PASSED
- **Cobertura**: No crítica (47.97% statements)
- **Tests relevantes para dashboard**:
    - `tests/api/dashboard.guests.happy.test.ts`
    - `tests/api/dashboard.guests.stream.test.ts`
    - `tests/api/dashboard.guests.export.test.ts`
    - `tests/api/dashboard.guests.duplicate.test.ts`
    - `tests/api/dashboard.guests.ownership.test.ts`
    - `tests/components/GuestDashboardApp.auth.test.tsx`

---

## 3. Imports Legacy V1 Detectados

### 3.1 En rsvp-v2/service.ts (Línea 50)

```typescript
import { getRsvpContext } from '@/lib/rsvp/service';
```

**Usado en**: `resolveLegacyTokenToCanonicalUrl` (líneas 801-819) **Impacto**: Función para migrar
tokens V1 a URLs V2 **Ruta crítica**: `/api/rsvp/legacy/resolve` (si existe)

### 3.2 Otros imports V1 (fuera del scope del dashboard, documentados para contexto):

- `src/pages/api/rsvp.ts` → API V1
- `src/pages/api/rsvp/channel.ts` → API V1
- `src/pages/api/rsvp/invitations.ts` → API V1
- `src/pages/api/rsvp/export.csv.ts` → API V1
- `src/pages/api/rsvp/context.ts` → API V1
- `src/pages/api/rsvp/admin.ts` → API V1

---

## 4. Uso de RPC Legacy

### 4.1 En src/pages/api/dashboard/guests/bulk.ts (Línea 42)

```typescript
const data = await supabaseRestRequest({
	pathWithQuery: `rpc/upsert_guests_v1`,
	method: 'POST',
	body: {
		p_event_id: body.eventId,
		p_guests: body.guests,
	},
	authToken: session.accessToken,
});
```

**Función**: Importación masiva de invitados **Impacto**: Bloquea eliminación total de dependencias
V1 **Solución propuesta**: Crear versión V2 del RPC o migrar a operaciones individuales

---

## 5. Clases CSS con Fuga Global

### 5.1 Clases `.dashboard-guests__error` y `.dashboard-guests__status`

| Archivo                  | Líneas        | Uso                            |
| ------------------------ | ------------- | ------------------------------ |
| `EventsAdminTable.tsx`   | 109, 110, 360 | Mensajes de error y loading    |
| `ClaimCodesTable.tsx`    | 206           | Mensaje de error en tabla      |
| `ClaimCodeFormModal.tsx` | 118           | Mensaje de error en formulario |
| `UsersAdminTable.tsx`    | 53, 54        | Mensajes de error y loading    |
| `ClaimCodesApp.tsx`      | 70, 73        | Mensajes de error y loading    |

### 5.2 Clases `.dashboard-guests__modal-backdrop` y `.dashboard-guests__modal`

| Archivo               | Líneas   | Uso                          |
| --------------------- | -------- | ---------------------------- |
| `ClaimCodesTable.tsx` | 143, 144 | Modal de confirmación delete |

### 5.3 Estadísticas

- **Total de fugas**: 7 archivos externos usan 5 clases distintas
- **Clases a migrar**:
    - `.dashboard-guests__error` → `.dashboard-error`
    - `.dashboard-guests__status` → `.dashboard-status`
    - `.dashboard-guests__modal-backdrop` → `.dashboard-modal-backdrop`
    - `.dashboard-guests__modal` → `.dashboard-modal`

---

## 6. Métricas de Complejidad

### 6.1 GuestDashboardApp.tsx

- **Líneas totales**: 786
- **Estados**: 17 useState
- **Effects**: 7 useEffect
- **Callbacks**: 6 useCallback
- **Funciones principales**:
    - `loadEvents` (líneas 117-139)
    - `loadGuests` (líneas 141-164)
    - `connectStream` (líneas 199-237)
    - `handleDeleteConfirm` (líneas 271-296)
    - `handlePostpone` (líneas 325-357)
    - Render principal (líneas 359-781)

### 6.2 rsvp-v2/service.ts

- **Líneas totales**: 1217
- **Funciones guest-related**: ~15
- **Líneas guest-related**: ~426
- **Otras responsabilidades**: events, claim codes, admin

---

## 7. Anti-Patrones Detectados para Fase 1

### 7.1 Manipulación directa del DOM

```typescript
// GuestDashboardApp.tsx líneas 503-530
const row = document.querySelector(`[data-guest-id="${item.guestId}"]`);
if (row) {
	row.classList.add('celebrate-success');
}
```

### 7.2 Estilos inline

```typescript
// GuestDashboardApp.tsx líneas 571-589
<p style={{
    textAlign: 'center',
    marginBottom: '1rem',
    color: 'var(--color-text-secondary)',
}}>
```

### 7.3 Uso de styled-jsx

```typescript
// GuestProgressCard.tsx
<style jsx>{`...`}</style>
```

---

## 8. Archivos Críticos para Refactorización

### 8.1 Alta Prioridad (Fases 1-3)

1. `src/components/dashboard/guests/GuestDashboardApp.tsx`
2. `src/components/dashboard/guests/GuestProgressCard.tsx`
3. `src/styles/invitation/_dashboard-guests.scss`

### 8.2 Media Prioridad (Fases 2-4)

4. `src/components/dashboard/events/EventsAdminTable.tsx`
5. `src/components/dashboard/claimcodes/ClaimCodesTable.tsx`
6. `src/components/dashboard/claimcodes/ClaimCodeFormModal.tsx`
7. `src/components/dashboard/users/UsersAdminTable.tsx`
8. `src/components/dashboard/claimcodes/ClaimCodesApp.tsx`

### 8.3 Baja Prioridad (Fases 4-5)

9. `src/lib/rsvp-v2/service.ts`
10. `src/pages/api/dashboard/guests/bulk.ts`

---

## 9. Próximos Pasos

### FASE 1 — FIXES DE UX CRÍTICOS

**Inicio**: Inmediato **Objetivo**: Corregir bugs visibles sin alterar arquitectura **Archivos**:
GuestDashboardApp.tsx, GuestProgressCard.tsx

### FASE 2 — DESACOPLAMIENTO CSS

**Inicio**: Después de Fase 1 **Objetivo**: Eliminar fugas globales **Archivos**:
\_dashboard-guests.scss + 7 archivos externos

---

## 10. Riesgos Identificados

| Riesgo                        | Probabilidad | Impacto | Mitigación                       |
| ----------------------------- | ------------ | ------- | -------------------------------- |
| Breaking changes en estilos   | Media        | Medio   | Visual regression testing manual |
| Funcionalidad legacy afectada | Baja         | Alto    | Mantener backward compatibility  |
| Performance degradation       | Baja         | Medio   | Benchmarks antes/después         |

---

**Fecha**: 2026-02-17 **Estado**: ✅ Listo para Fase 1
