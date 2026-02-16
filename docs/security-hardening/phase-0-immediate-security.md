# 📋 Fase 0 - Seguridad Inmediata

**Prioridad:** 🔴 CRÍTICA  
**Estado:** 🟡 En Progreso  
**Bloquea Deploy:** ✅ SÍ  
**Fecha Inicio:** 2026-02-15  
**Fecha Objetivo:** 2026-02-15 (Hoy)

---

## 🎯 Objetivo

Eliminar riesgos de seguridad críticos que bloquean cualquier deploy a producción. Esta fase debe
completarse ANTES de cualquier otra actividad.

---

## 📋 Tareas

### Tarea 0.1: Rotar Credenciales Expuestas

**ID:** SEC-001  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @devops-lead

#### Descripción

Las siguientes credenciales están expuestas en archivos `.env` y `.env.local` en el repositorio:

| Servicio   | Variable                    | Archivo              | Línea  | Riesgo                       |
| ---------- | --------------------------- | -------------------- | ------ | ---------------------------- |
| SendGrid   | `SENDGRID_API_KEY`          | `.env`               | 12     | Email spoofing, envío masivo |
| Gmail      | `GMAIL_PASS`                | `.env`, `.env.local` | 21, 6  | Acceso a cuenta de email     |
| Supabase   | `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`         | 18     | Acceso total a BD            |
| Supabase   | `SUPABASE_ANON_KEY`         | `.env.local`         | 17, 22 | Acceso a BD como usuario     |
| RSVP Admin | `RSVP_ADMIN_PASSWORD`       | `.env.local`         | 13     | Acceso admin sistema         |

#### Checklist de Ejecución

- [ ]   1. Generar nuevas credenciales en cada servicio:
    - [ ] SendGrid: Rotar API key en dashboard
    - [ ] Gmail: Generar nueva app password
    - [ ] Supabase: Generar nuevos service_role y anon keys
    - [ ] RSVP Admin: Cambiar contraseña

- [ ]   2. Actualizar variables en Vercel dashboard (NO en repo)
    - [ ] Production environment
    - [ ] Preview environment
    - [ ] Development environment

- [ ]   3. Invalidar credenciales antiguas:
    - [ ] Revocar old SendGrid key
    - [ ] Revocar old Gmail app password
    - [ ] Revocar old Supabase keys

- [ ]   4. Verificar funcionamiento:
    - [ ] Test envío de emails
    - [ ] Test conexión Supabase
    - [ ] Test login RSVP admin

#### Evidencia de Completado

- [ ] Screenshot de dashboard SendGrid mostrando key rotada
- [ ] Screenshot de dashboard Supabase mostrando keys rotadas
- [ ] Logs de test exitosos con nuevas credenciales

---

### Tarea 0.2: Eliminar Archivos .env del Repositorio

**ID:** SEC-002  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @backend-lead

#### Descripción

Los archivos `.env` y `.env.local` están actualmente en el repositorio y contienen secrets.

#### Checklist de Ejecución

- [ ]   1. Verificar `.gitignore`:

```bash
# Debe incluir:
.env
.env.local
.env.*.local
```

- [ ]   2. Eliminar del historial git (BFG Repo-Cleaner o git-filter-branch):

```bash
# Opción 1: git-filter-branch
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env .env.local' \
  --prune-empty --tag-name-filter cat -- --all

# Opción 2: BFG Repo-Cleaner (recomendado)
bfg --delete-files .env
bfg --delete-files .env.local
```

- [ ]   3. Forzar garbage collection:

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

- [ ]   4. Push force al remote (⚠️ Coordina con equipo):

```bash
git push origin --force --all
git push origin --force --tags
```

- [ ]   5. Verificar:

```bash
# No debe mostrar nada:
git log --all --full-history -- .env
git log --all --full-history -- .env.local
```

- [ ]   6. Notificar a todo el equipo:
    - [ ] Enviar mensaje en Slack/Teams
    - [ ] Actualizar README con instrucciones
    - [ ] Pedir a todos hacer `git clone` fresco

#### Evidencia de Completado

- [ ] Output de git log vacío
- [ ] Screenshot de `.gitignore` actualizado
- [ ] Confirmación de equipo que reclonaron repo

---

### Tarea 0.3: Verificar GitHub Secret Scanning

**ID:** SEC-003  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @devops-lead

#### Descripción

Activar protecciones de GitHub para detectar secrets en commits futuros.

#### Checklist de Ejecución

- [ ]   1. Verificar GitHub Secret Scanning:
    - [ ] Ir a Settings > Security > Secret scanning
    - [ ] Habilitar "Secret scanning" si está disponible
    - [ ] Habilitar "Push protection"

- [ ]   2. Configurar protección de ramas:
    - [ ] Settings > Branches > Add rule
    - [ ] Proteger `main` y `develop`
    - [ ] Requerir PR reviews
    - [ ] Requerir status checks

- [ ]   3. Instalar pre-commit hooks:

```bash
# Instalar pre-commit
pip install pre-commit

# Crear .pre-commit-config.yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
```

- [ ]   4. Test pre-commit:

```bash
pre-commit install
# Intentar commitear un archivo .env - debe bloquear
```

#### Evidencia de Completado

- [ ] Screenshot de configuración GitHub
- [ ] Archivo `.pre-commit-config.yaml` en repo
- [ ] Test exitoso de bloqueo de commit

---

### Tarea 0.4: Validación Post-Limpieza

**ID:** SEC-004  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** 🔴 Pendiente  
**Asignado a:** @security-lead

#### Descripción

Validar exhaustivamente que no queden secrets expuestos.

#### Checklist de Ejecución

- [ ]   1. Scan completo del repositorio:

```bash
# Instalar truffleHog
docker run -it --rm trufflesecurity/trufflehog:latest \
  git file://. --only-verified

# O usar git-secrets
git secrets --scan-history
```

- [ ]   2. Revisar manualmente archivos sensibles:
    - [ ] Buscar patrones de API keys: `api_key`, `apikey`, `api-key`
    - [ ] Buscar patrones de secrets: `secret`, `password`, `token`
    - [ ] Revisar archivos de config: `*.config.js`, `*.config.ts`

- [ ]   3. Verificar que la app funciona sin archivos .env:

```bash
# Limpiar
rm -f .env .env.local

# Intentar build - debe fallar con mensaje claro
npm run build
```

- [ ]   4. Documentar proceso:
    - [ ] Actualizar README.md con sección de configuración
    - [ ] Crear `.env.example` sin valores reales
    - [ ] Documentar cómo obtener cada credencial

#### Evidencia de Completado

- [ ] Report de truffleHog sin findings
- [ ] README actualizado
- [ ] `.env.example` creado

---

## 🚫 Bloqueos

| Bloqueo | Descripción | Impacto | Mitigación |
| ------- | ----------- | ------- | ---------- |
| Ninguno | -           | -       | -          |

---

## ✅ Criterios de Aceptación

Esta fase se considera completa cuando:

1. ✅ Todas las credenciales expuestas han sido rotadas
2. ✅ `.env` y `.env.local` han sido eliminados del historial git
3. ✅ GitHub Secret Scanning está activado
4. ✅ Pre-commit hooks detectan secrets
5. ✅ README documenta cómo configurar variables de entorno
6. ✅ Build falla claramente si faltan variables requeridas

---

## 📊 Métricas de Éxito

| Métrica                         | Objetivo | Actual |
| ------------------------------- | -------- | ------ |
| Secrets expuestos en repo       | 0        | 5+     |
| Archivos .env en historial      | 0        | 2      |
| Detección automática de secrets | ✅       | ❌     |
| Documentación de setup          | ✅       | ❌     |

---

## 📝 Notas

- **⚠️ ALERTA:** El `git push --force` requiere coordinación con todo el equipo
- **⚠️ ALERTA:** Las credenciales rotadas invalidarán sesiones activas
- **💡 TIP:** Considerar usar un gestor de secrets como 1Password o Vault

---

**Última actualización:** 2026-02-15  
**Próxima revisión:** Al completar Tarea 0.1
