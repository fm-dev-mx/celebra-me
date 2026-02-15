---
description:
    'Plan de resolución para alinear el sistema con la documentación y corregir inconsistencias
    arquitectónicas.'
lifecycle: task-open
domain: governance
owner: workflow-governance
last_reviewed: 2026-02-15
---

# 🛠️ Workflow: Alineación Sistema-Documentación

Este workflow resuelve las discrepancias identificadas en la auditoría
`full-system-audit-2026-02-15.md`.

## Fase 1: Sincronización de Gobernanza (Docs)

1. **Corregir `docs/DOC_STATUS.md`**:
    - Actualizar rutas de `evergreen/` (eliminar prefijos `governance/` y `sync/`).
    - Eliminar referencias a archivos no existentes (ej. `workflow-sync.md`, `skills-sync.md`).
2. **Limpiar `docs/implementation-log.md`**:
    - Corregir los paths mencionados en la entrada `[2026-02-14]`.
3. **Actualizar `docs/RSVP_STATUS.md`**:
    - Añadir sección sobre "Plantillas avanzadas de WhatsApp (Tier 3)" reflejando los cambios en
      `RSVP.tsx`.

## Fase 2: Estandarización de Esquema y Datos

1. **Actualizar `src/content/config.ts`**:
    - Incluir `itinerary` en `sectionStyles`.
    - Añadir campos `confirmedTemplate`, `declinedTemplate` y `omitTitle` al schema de
      `whatsappConfig`.
    - Permitir etiquetas personalizadas (`labels`) en `sectionStyles.rsvp`.
2. **Migrar Contenido (`src/content/events/*.json`)**:
    - Mover `variant` de itinerario/galería a `sectionStyles` en `demo-xv.json`.
    - Mover etiquetas de RSVP de Gerardo al JSON en `gerardo-sesenta.json`.

## Fase 3: Desacoplamiento de Rutas y Lógica

1. **Refactorizar `src/pages/[eventType]/[slug].astro`**:
    - Pasar `data.sectionStyles.itinerary.variant` al componente `Itinerary`.
    - Eliminar el bloque `if (data.eventType === 'cumple')` que hardcodea etiquetas de RSVP.
    - Consumir etiquetas desde `data.sectionStyles?.rsvp` o caer en los defaults equilibrados de
      `RSVP.tsx`.

## Fase 4: Verificación y Cierre

1. **Validación de Esquema**:

    ```bash
    pnpm astro check
    ```

2. **Tests de Regresión**:

    ```bash
    pnpm test tests/api/rsvp.context.test.ts
    ```

3. **Audit Visual**:
    - Verificar que `demo-xv` e itinerarios de `gerardo-sesenta` mantienen sus estilos correctos.

// turbo

> [!IMPORTANT] No procedas a la Fase 2 sin haber validado la Fase 1 en una revisión de "dry-run".
