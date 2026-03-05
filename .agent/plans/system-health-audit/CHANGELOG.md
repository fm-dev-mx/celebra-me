# 📝 Registro de Cambios: Health Audit de Sistema & Documentación

Trazabilidad determinista de avance para el refactor de `celebra-me`.

## [0.0.1] - 2026-03-04

### 🧹 Fase 1 Completada (Limpieza y Referencias)

- **Verificado:** Las dependencias `jest` y `commitlint` siguen configuradas funcionalmente bajo
  `package.json` y `Husky`. No son residuales y se mantienen intactas.
- **Corregido:** Vínculo a `THEME_SYSTEM.md` restaurado direccionalmente a
  `../domains/theme/architecture.md` dentro del Core Architecture.
- **Migrado:** `PREMIUM_UX_VISION.md` movido a capa Core como `/docs/core/premium-ux-vision.md` con
  sus propios enlaces reactivados.

### 🔍 Análisis Completo

- **Añadido:** Plan Maestro de Refactor arquitectónico `.agent/plans/system-health-audit`.
- **Encontrado:** 750+ inconsistencias documentadas sobre Gobernanza de Kebab-case.
- **Encontrado:** Degradación del estándar Jewelry Box (usos de `style={...}` react).
- **Encontrado:** Vínculos caídos sobre el `THEME_SYSTEM.md`.
- **Encontrado:** Utilización de etiquetas base `<img>` frente a la estandarización `astro:assets`.
- **Enfound:** Mixed Front-end (`fetch` requests) and Backend, breaking clean BFF.

## [0.2.0] - 2026-03-04

### 🧹 Phase 2 Completed (Structure & Naming)

- **Renamed**: ~80 files to strict `kebab-case` (utilities, assets, docs).
- **Fixed**: 34 broken references in documentation (Intent Drift).
- **Refactored**: `AdminApi` to centralize error handling and satisfy duplication guards.
- **Englishized**: All core documentation to pass automated `languageGovernance` checks.
- **Signed**: New S0 system integrity baseline with zero audit findings.

## [0.3.0] - 2026-03-04

### 🔌 Phase 3 Completed (BFF Decoupling)

- **Created**: `src/lib/rsvp/auth-bridge-api.ts` — `AuthBridgeApi` class for client-side auth
  endpoints (login, register, logout).
- **Migrated**: `GuestDashboardApp.tsx` CSV export from raw `fetch()` to `guestsApi.exportCsv()`.
- **Migrated**: `login-bridge.ts` login/register from raw `fetch()` to `authBridgeApi` methods.
- **Migrated**: `logout-client.ts` logout from raw `fetch()` to `authBridgeApi.logout()`.
- **Verified**: Zero `<img>` tags in Astro components — both `Hero.astro` files already use
  `<Image>` from `astro:assets`.
- **Verified**: Zero direct `fetch('/api/...')` calls remaining in `.tsx` view components.
- **Result**: All 3 acceptance criteria passed. TypeScript compiles with zero errors.
