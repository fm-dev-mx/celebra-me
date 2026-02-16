# ✅ Production Deploy Checklist

Checklist definitivo para validar que el sistema está listo para producción.

**NO deployar hasta completar todos los items de Fase 0 y Fase 1**

---

## 🔴 PRE-DEPLOY CRÍTICO (Bloquea deploy)

### Seguridad Inmediata (Fase 0)

- [ ] **SEC-001:** Todas las credenciales expuestas han sido rotadas
    - [ ] SendGrid API key rotada
    - [ ] Gmail app password regenerado
    - [ ] Supabase service_role key rotada
    - [ ] Supabase anon key rotada
    - [ ] RSVP admin password cambiado

- [ ] **SEC-002:** Archivos `.env` y `.env.local` eliminados del repositorio
    - [ ] `git log --all --full-history -- .env` no muestra nada
    - [ ] `git log --all --full-history -- .env.local` no muestra nada
    - [ ] Archivos agregados a `.gitignore`
    - [ ] Todo el equipo ha reclonado el repo

- [ ] **SEC-003:** GitHub Secret Scanning habilitado
    - [ ] Secret scanning activado en repositorio
    - [ ] Push protection habilitado
    - [ ] Pre-commit hooks instalados

- [ ] **SEC-004:** Validación de seguridad completada
    - [ ] truffleHog no encuentra secrets
    - [ ] No hay console.log con data sensible
    - [ ] `.env.example` documenta todas las variables

### Core Security (Fase 1)

- [ ] **SEC-005:** Rate limiting implementado
    - [ ] Upstash Redis configurado en producción
    - [ ] Todos los endpoints admin tienen rate limiting (30 req/min)
    - [ ] Tests de rate limiting pasan

- [ ] **SEC-006:** CSRF protection implementado
    - [ ] Token CSRF generado en middleware
    - [ ] Validación en todas las mutaciones
    - [ ] Cliente envía token en header
    - [ ] Tests de CSRF pasan

- [ ] **SEC-007:** Security headers configurados
    - [ ] CSP configurado y funcional
    - [ ] X-Content-Type-Options: nosniff
    - [ ] X-Frame-Options: DENY
    - [ ] Strict-Transport-Security
    - [ ] Calificación A+ en securityheaders.com

- [ ] **SEC-008:** Default secrets eliminados
    - [ ] No hay fallbacks en `trustedDevice.ts`
    - [ ] No hay fallbacks en `service.ts`
    - [ ] Validación de env vars en startup
    - [ ] App falla claramente si falta config

---

## 🟠 PRE-DEPLOY IMPORTANTE (Recomendado antes de deploy)

### Data Integrity (Fase 2)

- [ ] **DATA-001:** Soft delete implementado (parcialmente aceptable)
    - [ ] Columna `deleted_at` en tablas críticas
    - [ ] DELETE hace soft delete
    - [ ] Queries filtran deleted

- [ ] **DATA-002:** Protección último super_admin server-side
    - [ ] RPC `can_change_user_role()` implementado
    - [ ] API rechaza demote del último admin
    - [ ] Bypass cliente confirmado que no funciona

### Observability (Fase 4) - Mínimo viable

- [ ] **OBS-001:** Error tracking básico
    - [ ] Sentry configurado
    - [ ] ErrorBoundary envía errores a Sentry
    - [ ] Alertas configuradas para errores 500

- [ ] **OBS-003:** Health check básico
    - [ ] `GET /api/health` responde 200
    - [ ] Verifica conectividad a DB
    - [ ] Vercel usa para health checks

---

## 🟡 VALIDACIÓN PRE-DEPLOY

### Testing

- [ ] Todos los tests existentes pasan

    ```bash
    npm test
    ```

- [ ] Build exitoso

    ```bash
    npm run build
    ```

- [ ] Linting sin errores

    ```bash
    npm run lint
    ```

- [ ] Type checking sin errores
    ```bash
    npm run typecheck
    ```

### Variables de Entorno

- [ ] Todas las variables requeridas seteadas en Vercel:
    - [ ] `NODE_ENV=production`
    - [ ] `SUPABASE_URL`
    - [ ] `SUPABASE_ANON_KEY`
    - [ ] `SUPABASE_SERVICE_ROLE_KEY`
    - [ ] `TRUST_DEVICE_SECRET`
    - [ ] `RSVP_CLAIM_CODE_PEPPER`
    - [ ] `UPSTASH_REDIS_REST_URL`
    - [ ] `UPSTASH_REDIS_REST_TOKEN`
    - [ ] `SENTRY_DSN`
    - [ ] `BASE_URL=https://tu-dominio.com`

### Base de Datos

- [ ] Migraciones aplicadas en producción

    ```bash
    supabase db push
    ```

- [ ] Backup creado antes de migraciones

    ```bash
    supabase db dump > backup-$(date +%Y%m%d).sql
    ```

- [ ] Índices críticos creados
    - [ ] `idx_audit_logs_created_at_desc`
    - [ ] `idx_events_status_created`

### Seguridad Manual

- [ ] **Prueba de rate limiting:**

    ```bash
    for i in {1..35}; do curl -s -o /dev/null -w "%{http_code}\n" https://api/dashboard/admin/events; done
    # Debe retornar 429 después de 30 requests
    ```

- [ ] **Prueba de CSRF:**

    ```bash
    curl -X POST https://api/dashboard/admin/events \
      -H "Content-Type: application/json" \
      -d '{"title":"test"}'
    # Debe retornar 403 sin CSRF token
    ```

- [ ] **Prueba de headers de seguridad:**

    ```bash
    curl -I https://tu-dominio.com
    # Debe incluir: CSP, X-Frame-Options, HSTS, etc.
    ```

- [ ] **Prueba de bypass último admin:**
    ```bash
    # Intentar demote del último super_admin vía API
    curl -X PATCH https://api/dashboard/admin/users/last-admin-id/role \
      -H "Authorization: Bearer ..." \
      -H "X-CSRF-Token: ..." \
      -d '{"role":"host_client"}'
    # Debe retornar 403
    ```

---

## 🚀 DEPLOY

### Deploy a Staging/Preview

- [ ] Deploy a preview environment:

    ```bash
    git push origin feature/hardening-phase-1
    # Crear PR y deploy preview
    ```

- [ ] Validar en preview:
    - [ ] Login funciona
    - [ ] Dashboard admin carga
    - [ ] CRUD operations funcionan
    - [ ] Rate limiting funciona
    - [ ] CSRF tokens presentes
    - [ ] Security headers presentes
    - [ ] Sentry recibe errores

### Deploy a Producción

- [ ] Coordinar ventana de mantenimiento
- [ ] Notificar stakeholders
- [ ] Deploy:
    ```bash
    git checkout main
    git merge feature/hardening-phase-1
    git push origin main
    # Vercel deploy automático
    ```

---

## ✅ POST-DEPLOY VALIDATION

### Inmediato (primeros 5 minutos)

- [ ] Health check responde 200

    ```bash
    curl https://tu-dominio.com/api/health
    ```

- [ ] Homepage carga sin errores
- [ ] Login funciona
- [ ] Dashboard admin carga

### Corto plazo (primeras 2 horas)

- [ ] Monitorear Sentry:
    - [ ] No hay errores 500
    - [ ] No hay spikes de errores

- [ ] Monitorear Vercel Analytics:
    - [ ] No hay degradación de performance
    - [ ] Error rate < 1%

- [ ] Monitorear Upstash Redis:
    - [ ] Rate limiting funcionando
    - [ ] No hay anomalías

- [ ] Monitorear Supabase:
    - [ ] Conexiones normales
    - [ ] No hay queries lentos

### Largo plazo (primeras 24 horas)

- [ ] Revisar logs de seguridad:
    - [ ] Failed auth attempts
    - [ ] Rate limit hits
    - [ ] Permission denials

- [ ] Validar funcionalidad crítica:
    - [ ] Creación de eventos
    - [ ] Cambio de roles
    - [ ] Claim codes
    - [ ] RSVP flow

- [ ] Checklist de usuario final:
    - [ ] Admin puede login
    - [ ] Admin puede crear evento
    - [ ] Admin puede gestionar usuarios
    - [ ] Guest puede hacer RSVP

---

## 🚨 ROLLBACK PLAN

Si algo sale mal:

1. **Inmediato (< 5 min):**
    - Revertir deploy en Vercel dashboard
    - O ejecutar: `git revert HEAD && git push`

2. **Si DB está afectada:**
    - Restaurar desde backup
    - `psql $DATABASE_URL < backup-20260215.sql`

3. **Notificar:**
    - Equipo en Slack
    - Stakeholders por email
    - Status page si existe

---

## 📊 VALIDACIÓN FINAL

| Check                | Estado | Notas |
| -------------------- | ------ | ----- |
| Fase 0 completa      | ⬜     |       |
| Fase 1 completa      | ⬜     |       |
| Tests pasan          | ⬜     |       |
| Build exitoso        | ⬜     |       |
| Security scan limpio | ⬜     |       |
| Staging validado     | ⬜     |       |
| Deploy producción    | ⬜     |       |
| Post-deploy OK       | ⬜     |       |

**Deploy aprobado por:** **\*\*\*\***\_**\*\*\*\***  
**Fecha:** **\*\*\*\***\_**\*\*\*\***  
**Hora:** **\*\*\*\***\_**\*\*\*\***

---

**Documento generado:** 2026-02-15  
**Última actualización:** 2026-02-15
