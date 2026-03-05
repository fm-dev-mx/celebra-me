# Documentation Status Dashboard (3-Layer Architecture)

**Last Updated:** 2026-03-03 **Next Review:** 2026-04-03 **Maintainer:** Workflow Governance System

---

## 🏗 Layer 1: Core (Constitución)

Documentos inamovibles de políticas transversales.

| Documento                                               | Estado                             | Última Revisión |
| :------------------------------------------------------ | :--------------------------------- | :-------------- |
| [architecture.md](./core/architecture.md)               | 🟡 (Migrando de ARCHITECTURE.md)   | 2026-02-15      |
| [git-governance.md](./core/git-governance.md)           | 🟡 (Migrando de GIT_GOVERNANCE.md) | 2026-03-03      |
| [testing-strategy.md](./core/testing-strategy.md)       | 🟡 (Migrando de TESTING.md)        | 2026-03-03      |
| [project-conventions.md](./core/project-conventions.md) | 🟡 (Migrando de .agent)            | 2026-03-03      |

---

## 🏛 Layer 2: Features/Domains

Documentación técnica organizada por submódulo o dominio.

| Dominio / Archivo                                  | Estado                               | Notas |
| :------------------------------------------------- | :----------------------------------- | :---- |
| **RSVP**                                           |                                      |       |
| [database.md](./domains/rsvp/database.md)          | 🟡 (Migrando de DB_RSVP.md)          |       |
| [architecture.md](./domains/rsvp/architecture.md)  | 🟡 (Migrando de rsvp-module.md)      |       |
| [status.md](./domains/rsvp/status.md)              | 🟡 (Migrando de RSVP_STATUS.md)      |       |
| **Theme**                                          |                                      |       |
| [architecture.md](./domains/theme/architecture.md) | 🟡 (Consolidando THEME_SYSTEM.md)    |       |
| [typography.md](./domains/theme/typography.md)     | 🟡 (Consolidando TYPOGRAPHY.md)      |       |
| **Assets**                                         |                                      |       |
| [management.md](./domains/assets/management.md)    | 🟡 (Consolidando ASSET_MANAGEMENT)   |       |
| **Security**                                       |                                      |       |
| [roadmap.md](./domains/security/roadmap.md)        | 🟡 (Consolidando security-hardening) |       |

---

## 🛠 Layer 3: Operations (Workflows & Plans)

### 🟢 Evergreen Workflows (Activos)

Workflows críticos y permanentes de mantenimiento continuo.

- [error-remediation.md](../.agent/workflows/evergreen/error-remediation.md) - 🟢
- [gatekeeper-commit.md](../.agent/workflows/evergreen/gatekeeper-commit.md) - 🟢
- [prompt-to-workflow.md](../.agent/workflows/evergreen/prompt-to-workflow.md) - 🟢
- [system-doc-alignment.md](../.agent/workflows/evergreen/system-doc-alignment.md) - 🟢
- [theme-architecture-governance.md](../.agent/workflows/evergreen/theme-architecture-governance.md) -
  🟢
- [auto-fix.md](../.agent/workflows/evergreen/auto-fix.md) - 🟢 (Recuperado de huérfanos)

### 🟡 Task-Active Workflows & Plans (En Progreso)

Tareas puntuales actualmente en desarrollo.

- [generic-section-remediation.md](../.agent/workflows/task-open/generic-section-remediation.md) -
  🟡 (Inherited)
- [task-auth-dashboard-remediation.md](../.agent/workflows/task-auth-dashboard-remediation.md) - 🟡
  (Recuperado de huérfanos, migrar a task-open)
- [invitation-evolution-march-2026](../.agent/plans/invitation-evolution-march-2026/) - 🟡 (Plan
  Activo)
- [doc-realignment-plan.md](../.agent/plans/doc-realignment-plan.md) - 🟡 (Plan de Refactorización
  Activo)

### ⚪ Archive / Legacy (Completados / Retirados)

- [task-share-flow-optimization.md](../.agent/workflows/archive/task-share-flow-optimization.md)

---

## 📜 Governance Notes

1. **Estructura 3-Layer obligatoria:** Todo archivo `.md` nuevo debe clasificarse en `docs/core`,
   `docs/domains`, o `.agent/`. No se permiten archivos sueltos en `docs/`.
2. **Nomenclatura Estricta:** Exceptuando `README.md`, `CHANGELOG.md` y `CONTRIBUTING.md`, todos los
   demás archivos deben usar **`kebab-case.md`**.
3. **Referencias a Gatekeeper:** Las configuraciones se leen exclusivamente desde
   `.agent/governance/config/policy.json` (Las referencias obsoletas a `.agent/governance/` han sido
   depreciadas).
4. **Manejo de Tareas Completadas:** El flujo correcto para workflows caducos es: `task-open` ->
   `task-completed` -> `archive`.
5. **Auditoría Origen:** Esta taxonomía deriva de `docs/audit/doc-audit-report.md`.

---

## 🚀 Próxima Fila Operativa

1. Ejecutar Fase 1 del `doc-realignment-plan.md` (Limpieza de obsoletos).
2. Ejecutar Fase 2 del `doc-realignment-plan.md` (Migración a `kebab-case` y carpetas
   `core`/`domains`).
3. Actualizar `system-doc-alignment` para validar la estructura 3-Layer.
