# 🔍 System Health Audit & Architecture Master Plan

**Objetivo:** Elevar la integridad del sistema `celebra-me` eliminando vectores de deuda técnica,
alineando el código al 100% con la documentación existente y validando los estándares de ingeniería
antes de la próxima fase de escalado.

**Estado:** `50% Completado` **Duración Estimada:** 4 Fases

---

## 🎯 Hallazgos de la Auditoría Inicial

### 🔴 Bloqueadores

- **Gobernanza de Archivos (`kebab-case`):** ✅ Completado. Todos los archivos de utilidades, assets
  y documentación siguen la regla `kebab-case`.
- **Estado de Referencias:** ✅ Completado. 100% de integridad referencial en la documentación.

### 🟡 Mejoras de Arquitectura

- **Desacoplamiento (Coupling):** Archivos de la capa UI como `GuestDashboardApp.tsx`,
  `GuestRSVPForm.tsx` y otros componentes realizan llamadas de red directas (`fetch()`). Deben
  migrarse hacia ganchos dedicados (`useGuests`, etc.) o clientes API (BFF puro).
- **Consistencia de Estilos (Jewelry Box):** Se registraron múltiples fragmentos con utilidades
  ad-hoc (inline `style={{ ... }}`) en lugar de depender de los tokens de SCSS en instancias de
  interfaces UI (Ej: `ErrorBoundary.tsx`, `ClaimCodesTable.tsx`, `EventsAdminTable.tsx`).
- **Anti-patrones Astro:** El componente `Hero.astro` y posiblemente otros usan etiquetas nativas
  `<img>` en lugar del componente optimizado `<Image />` ó `<Picture />` de `astro:assets`
  dictaminado en las buenas prácticas `docs/CONTENT_COLLECTIONS.md`.
- **Eliminación de Residuos:** Existen rastros potenciales de deuda o archivos como configuraciones
  de módulos ya deprecadas (ej. `jest.config.cjs` y `commitlint.config.cjs` que necesitan validación
  de obsolescencia). El análisis de logs demostró que no hay `.gitkeeps` redundantes.

---

## 🗺️ Fases del Plan de Acción (Determinístico)

Para un mayor nivel de detalle, cada fase cuenta con su propio documento iterativo con Criterios de
Aceptación específicos y desglose de ejecución:

- **[Fase 1: Limpieza de Residuos y Referencias](./phases/01-cleanup-and-references.md) [100%]**
  Alineamiento de documentación para no contener links rotos. Limpieza de configuraciones
  deprecadas.

- **[Fase 2: Gobernanza de Archivos y Renombrado Súper-Consciente](./phases/02-kebab-case-governance.md)
  [100%]** La política de `kebab-case` documentada se ajusta a las convenciones oficiales y el
  Gatekeeper.

- **[Fase 3: Desacoplamiento (Coupling) Front-End de Lógica BFF](./phases/03-bff-decoupling.md)
  [0%]** Toda llamada a red está en un cliente de API/Hook y Astro maneja sus `Assets` vía
  componentes nativos, eliminando deuda arquitectónica técnica.

- **[Fase 4: Saneamiento Visual (Jewelry Box Architecture Refactoring)](./phases/04-jewelry-box-styling.md)
  [0%]** Mudar/eliminar todas las reglas estilísticas de `style={{...}}` por su contraparte en el
  Framework SCSS global estandarizado.

---

> **Nota de Gobernanza:** Este plan es interactuado con la directriz Antigravity y no debe someter
> cambios sin aprobación del USER por cada fase. La salud sistémica requiere precisión y prudencia
> sobre volúmenes de refactor tan amplios.
