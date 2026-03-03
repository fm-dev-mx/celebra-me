# Changelog - Invitation Evolution March 2026

## 2026-03-03

### Added

- Documentacion base en `.agent/plans/invitation-evolution-march-2026/`.
- Nuevo demo oficial: `src/content/events/demo-gerardo-sesenta.json`.
- Plantilla base para cliente real XV: `src/content/events/template-xv-real.json`.
- Enlace de showcase para cumpleanos demo en `src/data/landing-page.data.ts`.

### Changed

- `src/content/config.ts`: `isDemo` normalizado con default (`false`).
- `src/pages/[eventType]/[slug].astro`: validacion de URL canonica por `eventType`.
- `src/lib/adapters/event.ts`: validacion estricta de variantes con fallback controlado.
- `src/lib/adapters/types.ts`: `InvitationViewModel` incluye `isDemo`.
- `src/lib/assets/AssetRegistry.ts`: slug oficial actualizado a `demo-gerardo-sesenta`.
- `src/assets/images/events/index.ts`: nomenclatura alineada a demo.
- `src/styles/themes/sections/_gallery-theme.scss`: eliminada contaminacion de estilos `thank-you`.

### Validated

- Existe ruta de contenido para demo XV y demo Gerardo.
- Registry de assets resuelve slugs de demos.
- La validacion canonica evita desalineacion de tipo de evento en URL.

### Risk

- Falta corrida completa de suite automatizada (lint/build/e2e) para confirmar cero regresiones.
- Posible dependencia externa de URL antigua `gerardo-sesenta` fuera del repo.

### Rollback

1. Restaurar `src/content/events/gerardo-sesenta.json`.
2. Revertir mapping de `AssetRegistry` al slug anterior.
3. Remover servicio de cumpleanos demo del landing.
4. Revertir validacion canonica en `[eventType]/[slug].astro`.

## Plantilla de evidencia por checkpoint

- Fecha:
- Fase:
- Cambio:
- Ruta validada:
- Resultado visual:
- Resultado tecnico:
- Riesgo residual:
