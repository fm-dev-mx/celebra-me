# RSVP Status - Gerardo 60 (`luxury-hacienda`) - Cierre Final

Fecha de cierre: 2026-02-15

## 1) Estado Ejecutivo

**Dictamen final:** RSVP quedó **listo para lanzamiento operativo** con hardening mínimo aplicado,
persistencia durable integrada y cobertura crítica de pruebas backend.

**Estrategia preservada:**

- Persistencia RSVP primero (fuente primaria de verdad)
- WhatsApp como canal posterior/complementario
- Soporte de links personalizados + genéricos
- Compatibilidad legado `attendance=yes/no`

---

## 2) Implementación cerrada

### 2.1 Blindaje operativo mínimo

✅ `RSVP_TOKEN_SECRET` endurecido en `src/lib/rsvp/service.ts`

- En `production`, si falta secreto, se lanza error explícito.
- En `development/test`, se mantiene fallback de DX controlado.

✅ Capa de autenticación Basic Auth implementada

- Nuevo helper: `src/lib/rsvp/adminAuth.ts`
- Variables requeridas:
    - `RSVP_ADMIN_USER`
    - `RSVP_ADMIN_PASSWORD`

✅ Endpoints/panel protegidos

- `src/pages/api/rsvp/admin.ts`
- `src/pages/api/rsvp/export.csv.ts`
- `src/pages/api/rsvp/invitations.ts`
- `src/pages/admin/rsvp.astro`
- Respuesta no autorizada: `401` + `WWW-Authenticate`

### 2.2 Confiabilidad de datos

✅ Persistencia encapsulada por repositorio

- Nuevo: `src/lib/rsvp/repository.ts`
- Contratos implementados:
    - `saveRsvpRecord`
    - `getRsvpByStoreKey`
    - `getRsvpById`
    - `listRsvpByEvent`
    - `appendAuditEvent`
    - `appendChannelEvent`
    - `getLastChannelEventByRsvpId`

✅ Implementación durable para Supabase (REST)

- Activada cuando existen:
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_ROLE_KEY`
- En `production`, si no están configuradas, falla controladamente.
- En `test/dev`, fallback a memoria para DX local.

✅ Reglas de negocio preservadas en `src/lib/rsvp/service.ts`

- `declined => attendeeCount=0`
- `confirmed => attendeeCount>=1`
- `yes/no` legado mapeado a estado canónico
- `personalized/generic` + fallback token inválido
- Política efectiva: última respuesta gana

### 2.3 Calidad y pruebas

✅ Nuevas suites API RSVP:

- `tests/api/rsvp.context.test.ts`
- `tests/api/rsvp.channel.test.ts`
- `tests/api/rsvp.admin.test.ts`
- `tests/api/rsvp.export.test.ts`
- `tests/api/rsvp.post-canonical.test.ts`

✅ Infra de pruebas ajustada:

- `tests/mocks/astro-content.ts`
- `tests/setup.ts` con polyfill de `Response`
- `jest.config.cjs` mapper para `astro:content`

✅ Alineación copy en pruebas UI:

- `tests/components/RSVP.test.tsx` actualizado a label vigente

### 2.4 UX y fricción (sin cambios cosméticos amplios)

✅ `src/components/invitation/RSVP.tsx`

- Copy más consistente:
    - `Nombre completo *`
    - `Número total de asistentes`
    - `Confirmar asistencia`

✅ Ajustes de claridad visual

- `src/styles/invitation/_rsvp.scss`
    - error más legible (peso, borde, padding)
    - radio seleccionado con sombra de estado
    - WhatsApp CTA degradado a secundario visual
- `src/styles/themes/sections/_rsvp-theme.scss`
    - contraste de error reforzado
    - selección de radio más evidente

### 2.5 Operación cliente no-técnico (UI-first)

✅ Panel admin extendido en `src/pages/admin/rsvp.astro`

- Nuevo módulo "Invitaciones" en la misma interfaz:
    - carga de links por `eventSlug`
    - link genérico (copiar/abrir)
    - links personalizados por invitado (copiar/abrir)
    - acceso directo a WhatsApp con mensaje prellenado

✅ Endpoint admin-only para links

- `GET /api/rsvp/invitations?eventSlug=<slug>`
- Requiere Basic Auth
- Respuesta incluye:
    - `eventSlug`, `eventType`, `baseInviteUrl`, `genericUrl`
    - `guests[]` con `guestId`, `displayName`, `maxAllowedAttendees`, `token`, `personalizedUrl`,
      `waShareUrl`

---

## 3) Evidencia de validación

### 3.1 Pruebas automáticas corridas

✅ RSVP API críticas:

- `pnpm test -- --runInBand tests/api/rsvp.context.test.ts tests/api/rsvp.post-canonical.test.ts tests/api/rsvp.channel.test.ts tests/api/rsvp.admin.test.ts tests/api/rsvp.export.test.ts tests/api/rsvp.invitations.test.ts`
- Resultado: **6 suites, 14 tests, todos passing**

✅ Suite completa del proyecto:

- `pnpm test -- --runInBand`
- Resultado: **13 suites, 68 tests, todos passing**

### 3.2 Casos manuales/operativos verificados

Validaciones funcionales verificadas en handlers y flujo API durante QA técnico:

- Token válido -> modo `personalized`
- Token inválido -> fallback `generic` con mensaje
- Reconfirmación -> misma entidad canónica (última respuesta prevalece)
- `declined` fuerza asistentes `0`
- Admin/export sin auth -> `401`
- Admin/export con auth -> `200`
- CSV incluye columnas críticas y escape de comillas
- Carga de links desde UI admin (personalizado/genérico) operativa
- Deeplink de WhatsApp operativo desde UI admin

---

## 4) Configuración operativa requerida

Variables de entorno obligatorias para producción:

- `RSVP_TOKEN_SECRET`
- `RSVP_ADMIN_USER`
- `RSVP_ADMIN_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Esquema mínimo Supabase recomendado

Migraciones versionadas activas:

- `supabase/migrations/20260215000100_rsvp_init.sql`
- `supabase/migrations/20260215000200_rsvp_hardening.sql`

Incluyen:

- constraints de estado/asistentes en DB
- FK con `on delete cascade` para audit y channel
- trigger de respaldo para `last_updated_at`
- RLS habilitado/forzado y políticas de bloqueo para `anon`/`authenticated`
- índices para listados admin y consultas por evento/estado/nombre

Contingencia operativa si Supabase falla:

- Mantener export CSV frecuente como respaldo operativo.
- Habilitar captura manual temporal y reconciliación posterior.

---

## 5) Riesgo residual real

### Riesgo medio

- No se implementó rate limiting en endpoints públicos RSVP.

### Riesgo bajo

- Fallback de memoria en `test/dev` existe por DX, pero en producción queda bloqueado por validación
  de configuración.

---

## 6) Checklist Go-Live

- [x] `RSVP_TOKEN_SECRET` endurecido (sin fallback inseguro en producción)
- [x] Admin protegido con auth explícita
- [x] Export CSV protegido con auth explícita
- [x] Panel `/admin/rsvp` protegido con auth explícita
- [x] Módulo UI para generar/copiar/abrir links RSVP en panel admin
- [x] Persistencia durable por repositorio Supabase
- [x] Migraciones Supabase versionadas en repo (`supabase/migrations`)
- [x] RLS habilitado con acceso backend-only (service role)
- [x] Compatibilidad legado `yes/no` preservada
- [x] Política última respuesta gana validada
- [x] Escenario `declined => attendeeCount=0` validado
- [x] Pruebas críticas API agregadas y pasando
- [x] Suite completa de pruebas pasando
- [x] Copy/claridad RSVP ajustados para `luxury-hacienda`

---

## 7) DoD

- [x] Flujo invitado completo (personalized/generic/fallback)
- [x] Registro estructurado consistente
- [x] Admin y export protegidos
- [x] Pruebas críticas pasando
- [x] Estado de lanzamiento documentado en este archivo
