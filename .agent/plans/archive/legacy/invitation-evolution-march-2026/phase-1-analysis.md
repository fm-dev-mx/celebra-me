# Phase 1 - Deep Analysis and Decoupling

Status: 100%

## Objetivo

Auditar desacoplamiento entre contenido, adapter, ruteo y estilos para reducir regresiones entre
tipos de evento.

## Tareas ejecutadas

1. Revisado `src/content/config.ts` para contrato de `theme`, `sectionStyles` e `isDemo`.
2. Auditado `src/lib/adapters/event.ts` para mapeo de variantes y fallbacks.
3. Revisado `src/pages/[eventType]/[slug].astro` para coherencia de ruta.
4. Auditados presets y secciones en `src/styles/themes`.
5. Detectada y corregida contaminacion de seccion en `_gallery-theme.scss`.

## Matriz de fuente de verdad por seccion

1. Preset global:
    - Fuente: `theme.preset`.
    - Aplicacion: clase `theme-preset--{preset}`.
2. Quote:
    - Fuente: `sectionStyles.quote.variant`.
    - Fallback: `elegant`.
3. Countdown:
    - Fuente: `sectionStyles.countdown.variant`.
    - Fallback: `minimal`.
4. Location:
    - Fuente: `sectionStyles.location.variant`.
    - Fallback: `structured`.
5. Family/Gallery/Gifts/ThankYou:
    - Fuente: `sectionStyles.{seccion}.variant`.
    - Fallback: `standard`.
6. Itinerary/RSVP:
    - Fuente: `sectionStyles.{seccion}.variant`.
    - Fallback: `theme.preset`.

## Deuda tecnica identificada y tratada

1. Variantes casteadas sin validacion.
    - Estado: mitigado con validacion centralizada y warnings.
2. Ruta sin canonicalidad por `eventType`.
    - Estado: mitigado con redireccion 301 a URL canonica.
3. Estilos cruzados gallery/thank-you.
    - Estado: mitigado removiendo reglas fuera de alcance.

## Criterios de salida

- No estilos cruzados entre presets o secciones.
- No dependencia implicita entre demo y real.
- Rutas canonicas definidas por tipo de evento.
