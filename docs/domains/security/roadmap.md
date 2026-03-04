# Security Roadmap Archive

# Prompt to Continue Security Hardening - Celebra-me

---

## Goal

Continue implementing the security hardening plan for the Celebra-me Admin Dashboard.

---

## Current Plan Status

**Total Progress: ~50%**

- Phases 0-1 complete (100%)
- Phase 2 in progress (40%)
- Phases 3-5 pending (0%)

---

## Completed (Summary)

### Phase 0 - Immediate Security (100%)

- Credential rotation scripts
- Rotation guide in `docs/security-hardening/CREDENTIAL_ROTATION.md`
- Pre-commit hooks to detect secrets
- `.env.example` updated

### Phase 1 - Core Security (100%)

- **Rate limiting**: Implemented on 10 admin endpoints (`src/lib/rsvp/adminRateLimit.ts`)
- **CSRF Protection**: Module `src/lib/rsvp/csrf.ts`, integrated in DashboardLayout and apiClient
- **Security headers**: Added in `vercel.json`
- **Default secrets removed**: Modified `trustedDevice.ts` and `service.ts`, created
  `env-validation.ts`

---

## Partially Implemented

### Phase 2 - Data Integrity

- **DATA-002**: Last super_admin server-side protection COMPLETE
    - File: `src/lib/rsvp/adminProtection.ts`
    - Updated endpoint: `src/pages/api/dashboard/admin/users/[userId]/role.ts`
    - Returns 403 if attempting to delete last admin
- **DATA-001**: Soft Delete
    - Migration created: `supabase/migrations/20260220000000_add_soft_delete.sql`
    - Service created: `src/lib/rsvp/softDelete.ts`
    - PENDING: Apply migration in Supabase with `supabase db push`

- **DATA-003**: Optimistic Locking - PENDING

### Phase 3 - API Hardening

- Zod schemas created: `src/lib/schemas/index.ts`
- Validation utilities: `src/lib/rsvp/validation.ts`
- Integration in endpoints - PENDING

---

## Remaining to Implement

### Phase 2 - Data Integrity (continuation)

1. **DATA-001**: Apply soft delete migration in DB
2. **DATA-003**: Optimistic locking for concurrent edits

### Phase 3 - API Hardening

1. **API-001**: Integrate Zod schemas in all admin endpoints
2. **API-002**: Standardize API response format
3. **API-003**: Implement idempotency keys

### Phase 4 - Observability

- OBS-001: Sentry integration for error tracking
- OBS-002: Structured logging (Pino)
- OBS-003: Health check endpoint
- OBS-004: Security event logging

### Phase 5 - Performance

- PERF-001: Missing DB indexes
- PERF-002: Pagination in listings
- PERF-003: Configured timeouts

---

## Recommended Next Steps

### High Priority (Immediate)

1. Apply soft delete migration: `supabase db push`
2. Integrate Zod in events endpoint (`POST /api/dashboard/admin/events`)

### Medium Priority

1. Implement optimistic locking
2. Complete Zod validation in all endpoints

### Low Priority

1. Observability (Sentry, logging)
2. Performance (indexes, pagination)

---

## Key Files Created

```text
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

## Important Notes

1. **Credentials**: Exposed credentials must be rotated manually (not code)
2. **DB Migration**: Soft delete migration must be applied manually with `supabase db push`
3. **LSP Errors**: Errors shown in the LSP are pre-existing in the project, not caused by hardening
4. **CSRF**: Requires Upstash Redis configured for effective rate limiting in production

---

## Pending Checklist

- [ ] Apply soft delete migration in Supabase
- [ ] Integrate Zod in admin endpoints
- [ ] Implement optimistic locking
- [ ] Complete Phase 3 (API Hardening)
- [ ] Complete Phase 4 (Observability)
- [ ] Complete Phase 5 (Performance)

---

**Prompt generated:** 2026-02-15 **Project:** Celebra-me Admin Dashboard

​

---

# Credential Rotation Guide

## URGENT - Action Required

Las siguientes credenciales están expuestas en el repositorio y DEBEN ser rotadas ANTES de cualquier
deploy a producción.

---

## Credentials to Rotate List

### 1. SendGrid API Key

**Risk:** Email spoofing, quota usage

**Pasos:**

1. Ir a: <https://app.sendgrid.com/settings/api_keys>
2. Localizar la API key existente (termina en las últimas 4 dígitos del archivo .env)
3. Click en "Delete" para revocar
4. Click en "Create API Key"
5. Nombre: "Celebra-me Production"
6. Permisos: "Full Access" o "Restricted Access" (Mail Send)
7. Copiar la nueva key (solo se muestra una vez)
8. Actualizar en Vercel:
    - Ir a: <https://vercel.com/dashboard>
    - Seleccionar proyecto
    - Settings > Environment Variables
    - Actualizar `SENDGRID_API_KEY`

**Test:**

```bash
# Verify emails work
npm run test:email
```

---

### 2. Gmail App Password

**Risk:** Full access to Gmail account

**Pasos:**

1. Ir a: <https://myaccount.google.com/apppasswords>
2. Iniciar sesión con la cuenta de Gmail
3. Localizar el app password existente
4. Click en "Delete" para revocar
5. Click en "Select app" > "Other (Custom name)"
6. Nombre: "Celebra-me Production"
7. Click "Generate"
8. Copiar el password de 16 caracteres (sin espacios)
9. Actualizar en Vercel:
    - Variable: `GMAIL_PASS`
    - Valor: El nuevo password de 16 caracteres

**Note:** Account must have 2FA enabled to use App Passwords.

---

### 3. Supabase Service Role Key

**Risk:** Full database access (bypass RLS)

**Pasos:**

1. Ir a: <https://supabase.com/dashboard/project/_/settings/api>
2. Seleccionar el proyecto
3. Sección "Project API keys"
4. Localizar `service_role` key
5. Click en "Regenerate" junto a service_role
6. Confirmar regeneración
7. Copiar la nueva key
8. Actualizar en Vercel:
    - Variable: `SUPABASE_SERVICE_ROLE_KEY`
    - Valor: Nueva service_role key

**Important:** This action will invalidate all sessions/operations using the previous key.

**Test:**

```bash
# Verify connection
npm run db:test-connection
```

---

### 4. Supabase Anon Key

**Risk:** Database access as anonymous user

**Pasos:**

1. Ir a: <https://supabase.com/dashboard/project/_/settings/api>
2. Sección "Project API keys"
3. Localizar `anon` key
4. Click en "Regenerate" junto a anon
5. Confirmar regeneración
6. Copiar la nueva key
7. Actualizar en Vercel:
    - Variable: `SUPABASE_ANON_KEY`
    - Valor: Nueva anon key

**Note:** Authenticated users will need to re-login after this change.

---

### 5. RSVP Admin Password

**Risk:** Administrative access to RSVP system

**Pasos:**

1. Si es un usuario de Supabase Auth:
    - Ir a: <https://supabase.com/dashboard/project/_/auth/users>
    - Localizar el usuario admin
    - Click en "Edit" > "Password"
    - Generar nuevo password seguro (12+ caracteres, mezcla de tipos)
2. Si es variable de entorno:
    - Generar nuevo password: `openssl rand -base64 24`
    - Actualizar en Vercel:
        - Variable: `RSVP_ADMIN_PASSWORD`
        - Valor: Nuevo password

---

## Post-Rotation Checklist

After rotating ALL credentials:

- [ ] New SendGrid API Key works (email send test)
- [ ] New Gmail App Password works
- [ ] New Supabase Service Role Key works
- [ ] New Supabase Anon Key works
- [ ] New RSVP Admin Password works
- [ ] All credentials are in Vercel (Production, Preview, Development)
- [ ] Application works correctly locally
- [ ] Application works correctly in preview deploy

---

## After Rotating

1. **DO NOT commit new credentials to repo**
2. **Execute:** `./scripts/remove-env-from-history.sh`
3. **Configure:** Pre-commit hooks to prevent future leaks
4. **Notify:** Team must re-clone repo or do `git pull --force`

---

## Support

If you have issues:

- SendGrid: https://support.sendgrid.com
- Supabase: https://supabase.com/support
- Gmail: https://support.google.com/accounts

---

**Document created:** 2026-02-15  
**Last updated:** 2026-02-15
