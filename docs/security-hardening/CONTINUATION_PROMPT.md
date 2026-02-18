# Prompt para Continuar Security Hardening - Celebra-me

---

## 🎯 Objetivo

Continuar la implementación del plan de hardening de seguridad para el Admin Dashboard de
Celebra-me.

---

## 📊 Estado Actual del Plan

**Progreso total: ~50%**

- ✅ Fases 0-1 completas (100%)
- 🟡 Fase 2 en progreso (40%)
- 🔴 Fases 3-5 pendientes (0%)

---

## ✅ Lo Completado (Resumen)

### Fase 0 - Seguridad Inmediata (100%)

- Scripts para rotación de credenciales
- Guía de rotación en `docs/security-hardening/CREDENTIAL_ROTATION.md`
- Pre-commit hooks para detectar secrets
- `.env.example` actualizado

### Fase 1 - Core Security (100%)

- **Rate limiting**: Implementado en 10 endpoints admin (`src/lib/rsvp/adminRateLimit.ts`)
- **CSRF Protection**: Módulo `src/lib/rsvp/csrf.ts`, integrado en DashboardLayout y apiClient
- **Security headers**: Agregados en `vercel.json`
- **Default secrets eliminados**: Modificados `trustedDevice.ts` y `service.ts`, creado
  `env-validation.ts`

---

## 🟡 Parcialmente Implementado

### Fase 2 - Data Integrity

- ✅ **DATA-002**: Protección último super_admin server-side ✅ COMPLETO
    - Archivo: `src/lib/rsvp/adminProtection.ts`
    - Endpoint actualizado: `src/pages/api/dashboard/admin/users/[userId]/role.ts`
    - Retorna 403 si se intenta eliminar último admin
- ⚠️ **DATA-001**: Soft Delete
    - ❌ Migración creada: `supabase/migrations/20260220000000_add_soft_delete.sql`
    - ❌ Servicio creado: `src/lib/rsvp/softDelete.ts`
    - ⏳ **PENDIENTE**: Aplicar migración en Supabase con `supabase db push`

- ❌ **DATA-003**: Optimistic Locking - PENDIENTE

### Fase 3 - API Hardening

- ✅ Schemas Zod creados: `src/lib/schemas/index.ts`
- ✅ Utilidades de validación: `src/lib/rsvp/validation.ts`
- ❌ Integración en endpoints - PENDIENTE

---

## 🔴 Lo Que Falta Implementar

### Fase 2 - Data Integrity (continuación)

1. **DATA-001**: Aplicar migración de soft delete en DB
2. **DATA-003**: Optimistic locking para ediciones concurrentes

### Fase 3 - API Hardening

1. **API-001**: Integrar Zod schemas en todos los endpoints admin
2. **API-002**: Estandarizar formato de respuestas API
3. **API-003**: Implementar idempotency keys

### Fase 4 - Observability

1. **OBS-001**: Integrar Sentry para error tracking
2. **OBS-002**: Logging estructurado (Pino)
3. **OBS-003**: Health check endpoint
4. **OBS-004**: Security event logging

### Fase 5 - Performance

1. **PERF-001**: Índices de BD faltantes
2. **PERF-002**: Paginación en listados
3. **PERF-003**: Timeouts configurados

---

## 🚀 Próximos Pasos Recomendados

### Prioridad Alta (Inmediata)

1. Aplicar migración de soft delete: `supabase db push`
2. Integrar Zod en endpoint de eventos (`POST /api/dashboard/admin/events`)

### Prioridad Media

3. Implementar optimistic locking
4. Completar validación Zod en todos los endpoints

### Prioridad Baja

5. Observability (Sentry, logging)
6. Performance (índices, paginación)

---

## 📁 Archivos Clave Creados

```
scripts/
├── rotate-credentials.sh
├── remove-env-from-history.sh
└── install-precommit-hooks.sh

docs/security-hardening/
├── README.md
├── phase-0-immediate-security.md
├── phase-1-core-security.md
├── phase-2-data-integrity.md
├── phase-3-api-hardening.md
├── phase-4-observability.md
├── phase-5-performance.md
├── detailed-issues.md
├── production-deploy-checklist.md
└── CREDENTIAL_ROTATION.md

supabase/migrations/
└── 20260220000000_add_soft_delete.sql

src/lib/
├── env-validation.ts
├── schemas/index.ts
└── rsvp/
    ├── adminRateLimit.ts
    ├── csrf.ts
    ├── adminProtection.ts
    ├── softDelete.ts
    └── validation.ts
```

---

## ⚠️ Notas Importantes

1. **Credenciales**: Las credenciales expuestas deben rotarse manualmente (no es código)
2. **Migración DB**: La migración de soft delete debe aplicarse manualmente con `supabase db push`
3. **Errores LSP**: Los errores shown en el LSP son pre-existentes en el proyecto, no causados por
   el hardening
4. ** CSRF**: Requiere Upstash Redis configurado para rate limiting efectivo en producción

---

## 📋 Checklist de Pendientes

- [ ] Aplicar migración soft delete en Supabase
- [ ] Integrar Zod en endpoints admin
- [ ] Implementar optimistic locking
- [ ] Completar Fase 3 (API Hardening)
- [ ] Completar Fase 4 (Observability)
- [ ] Completar Fase 5 (Performance)

---

**Prompt generado:** 2026-02-15 **Proyecto:** Celebra-me Admin Dashboard

​
