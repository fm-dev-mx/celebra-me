# Plan de Realineación de Documentación (3-Layer Architecture)

**Objetivo:** Erradicar el "Documentation Drift", consolidar archivos huérfanos/obsoletos, y migrar
la estructura plana actual a una arquitectura jerárquica de 3 capas. **Estado:** `100% Completado`
**Duración Estimada:** 3 fases

---

## 🚀 Fase 1: Limpieza de Históricos y Eliminación de Fantasmas [100%]

**Objetivo:** Reducir el ruido del proyecto eliminando archivos obsoletos y referencias rotas.

- [x] **Eliminar tracking y audits viejos:**
    - `docs/audit/rsvp-doc-alignment-2026-02-15.md`
    - `docs/audit/rsvp-v2-gap-analysis-2026-02-15.md`
    - `docs/audit/rsvp-v2-remediation-backlog-2026-02-15.md`
    - `docs/audit/rsvp-v2-verification-2026-02-15.md`
    - `reports/ux-audit-gerardo-*`
    - `tracking/PR*` y `tracking/README.md`
- [x] **Desindexar Fantasmas:**
    - Actualizar `ASSET_MANAGEMENT.md` (remover referencias rotas a imágenes estáticas).
    - Corregir `docs/DOC_STATUS.md` (remover referencias a `.agent/gatekeeper/policy.json` y apuntar
      a `.agent/governance/config/`).

---

## 🏗 Fase 2: Implementación de la Capa Core y Domain [100%]

**Objetivo:** Mover los archivos a su dominio correspondiente usando convenciones estrictas
`kebab-case`.

- [x] **Crear la estructura base:**
    - `mkdir -p docs/core`
    - `mkdir -p docs/domains/{rsvp,theme,assets,security}`
- [x] **Migración y Renombrado (A Capa 1 - Core):**
    - Mover `docs/ARCHITECTURE.md` -> `docs/core/architecture.md`
    - Mover `docs/GIT_GOVERNANCE.md` -> `docs/core/git-governance.md`
    - Mover `docs/TESTING.md` -> `docs/core/testing-strategy.md`
    - Mover `.agent/PROJECT_CONVENTIONS.md` -> `docs/core/project-conventions.md`
    - Eliminar o fusionar `docs/GOVERNANCE.md` en `git-governance.md`.
- [x] **Migración y Consolidación (A Capa 2 - Domains):**
    - Renombrar `docs/DB_RSVP.md` -> `docs/domains/rsvp/database.md`.
    - Mover `docs/architecture/rsvp-module.md` -> `docs/domains/rsvp/architecture.md`.
    - Fusionar `docs/THEME_SYSTEM.md`, `TYPOGRAPHY_SYSTEM`, `THEME_INVENTORY` ->
      `docs/domains/theme/`.
    - Fusionar `docs/ASSET_MANAGEMENT.md`, `ASSET_REGISTRY_GUIDE.md` -> `docs/domains/assets/`.
    - Consolidar carpeta `docs/security-hardening/` -> `docs/domains/security/roadmap.md`.

---

## ⚙️ Fase 3: Estandarización de Capa Operations y Dashboard [100%]

**Objetivo:** Asegurar que todos los workflows y planes estén rastreados correctamente en el
DOC_STATUS.

- [x] **Revisión de Workflows:**
    - Asegurar que `.agent/workflows/task-auth-dashboard-remediation.md` y
      `.agent/workflows/evergreen/auto-fix.md` estén registrados en `DOC_STATUS`.
- [x] **Actualización de DOC_STATUS (`docs/DOC_STATUS.md`):**
    - Reflejar la nueva estructura 3-Layer.
    - Asegurar que apunte a las rutas `docs/core/*`, `docs/domains/*`, `.agent/workflows/*`.
    - Actualizar el formato para que indique claramente si un workflow es `Evergreen`, `Task-Active`
      o `Archive`.

---

> **Regla de Realineación:** Una vez completado este plan, cualquier PR nuevo debe pasar por el
> _Gatekeeper Commit_ y fallar automáticamente si introduce documentación fuera del formato 3-Layer
> o no actualiza el DOC_STATUS.
