# 🔒 Security Hardening - Master Tracking Document

**Proyecto:** Celebra-me Admin Dashboard  
**Auditoría realizada:** 2026-02-15  
**Última actualización:** 2026-02-15  
**Estado global:** 🟡 En Progreso

---

## 📊 Dashboard de Progreso

| Fase                         | Estado         | Progreso | Tareas | Completadas | Críticas Pendientes |
| ---------------------------- | -------------- | -------- | ------ | ----------- | ------------------- |
| Fase 0 - Seguridad Inmediata | 🟡 En Progreso | 0%       | 4      | 0           | 4                   |
| Fase 1 - Core Security       | 🔴 No Iniciada | 0%       | 4      | 0           | 4                   |
| Fase 2 - Data Integrity      | 🔴 No Iniciada | 0%       | 3      | 0           | 3                   |
| Fase 3 - API Hardening       | 🔴 No Iniciada | 0%       | 3      | 0           | 0                   |
| Fase 4 - Observability       | 🔴 No Iniciada | 0%       | 4      | 0           | 0                   |
| Fase 5 - Performance         | 🔴 No Iniciada | 0%       | 3      | 0           | 0                   |

**Progreso Total: 0%**

---

## 🚨 Bloqueadores Críticos

1. **Credenciales expuestas en repositorio** - Bloquea cualquier deploy
2. **Sin rate limiting en endpoints admin** - Vulnerable a DoS
3. **Protección último super_admin solo cliente** - Riesgo de bloqueo total
4. **Sin CSRF protection** - Vulnerable a ataques cross-site

---

## 📅 Cronograma Sugerido

| Semana         | Fase   | Entregables                                             |
| -------------- | ------ | ------------------------------------------------------- |
| Semana 0 (Hoy) | Fase 0 | Credenciales rotadas, .env limpio                       |
| Semana 1       | Fase 1 | Rate limiting, CSRF, headers de seguridad               |
| Semana 2       | Fase 2 | Soft delete, protección super_admin, optimistic locking |
| Semana 3       | Fase 3 | Zod validation, API consistente, idempotency            |
| Semana 4       | Fase 4 | Sentry, logging estructurado, health checks             |
| Semana 5       | Fase 5 | Índices, paginación, timeouts                           |

---

## 📁 Documentación Relacionada

- [📋 Fase 0 - Seguridad Inmediata](./phase-0-immediate-security.md)
- [📋 Fase 1 - Core Security](./phase-1-core-security.md)
- [📋 Fase 2 - Data Integrity](./phase-2-data-integrity.md)
- [📋 Fase 3 - API Hardening](./phase-3-api-hardening.md)
- [📋 Fase 4 - Observability](./phase-4-observability.md)
- [📋 Fase 5 - Performance](./phase-5-performance.md)
- [🔍 Issues Detailados](./detailed-issues.md)
- [✅ Checklist de Deploy](./production-deploy-checklist.md)

---

## 📝 Notas y Decisiones

### 2026-02-15 - Inicio del Plan

- Auditoría completada, riesgos críticos identificados
- Plan de hardening creado con 5 fases
- Prioridad máxima: Fase 0 (credenciales expuestas)

### Decisiones Pendientes

- [ ] ¿Usar Upstash Redis o alternativa para rate limiting distribuido?
- [ ] ¿Implementar soft delete con `deleted_at` o estado `archived`?
- [ ] ¿Usar Sentry, LogRocket, o alternativa para error tracking?
- [ ] ¿Cursor-based o offset pagination?

---

## 👥 Responsables Sugeridos

| Área                   | Responsable     | Notas                            |
| ---------------------- | --------------- | -------------------------------- |
| Fase 0-1 (Security)    | @backend-lead   | Crítico, alta prioridad          |
| Fase 2 (Data)          | @database-admin | Requiere migraciones             |
| Fase 3 (API)           | @backend-dev    | Refactor significativo           |
| Fase 4 (Observability) | @devops         | Configuración servicios externos |
| Fase 5 (Performance)   | @backend-dev    | Optimizaciones                   |
| QA/Testing             | @qa-lead        | Validar cada fase                |

---

## 🎯 Criterios de Aceptación por Fase

### Fase 0

- [ ] Todas las credenciales rotadas
- [ ] `.env*` eliminado del historial git
- [ ] Validación: `git log --all --full-history -- .env*` no muestra nada

### Fase 1

- [ ] Rate limiting funciona en todos los endpoints admin
- [ ] CSRF tokens presentes en todas las mutaciones
- [ ] Security headers presentes en todas las respuestas
- [ ] No hay default secrets en código

### Fase 2

- [ ] Soft delete implementado en todas las tablas críticas
- [ ] No se puede demotear al último super_admin vía API
- [ ] Ediciones concurrentes detectan conflictos

### Fase 3

- [ ] Todos los endpoints usan Zod para validación
- [ ] Respuestas API consistentes (mismo formato)
- [ ] Idempotency keys funcionan en endpoints críticos

### Fase 4

- [ ] Sentry reportando errores de producción
- [ ] Logs estructurados en JSON
- [ ] Health check endpoint responde correctamente
- [ ] Eventos de seguridad loggeados

### Fase 5

- [ ] Todos los queries de lista tienen paginación
- [ ] Índices creados y query plans mejorados
- [ ] Timeouts configurados y funcionando

---

**Nota:** Este documento debe actualizarse al completar cada tarea.
