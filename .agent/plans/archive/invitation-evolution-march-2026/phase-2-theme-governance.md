# Phase 2 - Theme Governance Documentation

Status: 100%

## Objetivo

Formalizar la arquitectura de color en 3 capas para consistencia entre presets Jewelry Box y Luxury
Hacienda.

## Arquitectura de 3 capas

1. Capa 1 - Tokens:
    - Archivo base: `src/styles/tokens/*`.
    - Responsabilidad: primitives, semantic, typography, spacing, motion.
2. Capa 2 - Theme Presets:
    - Archivos: `src/styles/themes/presets/_jewelry-box.scss`, `_luxury-hacienda.scss`.
    - Responsabilidad: mapear tokens semanticos por preset.
3. Capa 3 - Component Styles:
    - Archivos: `src/styles/themes/sections/*`.
    - Responsabilidad: aplicar comportamiento visual por `data-variant` sin redefinir arquitectura
      global.

## Mapeo explicito JSON -> CSS

1. `theme.primaryColor` -> `--color-primary` (runtime wrapper en pagina).
2. `theme.accentColor` -> `--color-accent` (runtime wrapper en pagina).
3. `theme.preset` -> clase `theme-preset--{preset}`.
4. `sectionStyles.{section}.variant` -> selector `[data-variant='{variant}']`.

## Reglas anti-regresion

1. No declarar estilos de una seccion en archivo de otra seccion.
2. No hardcodear colores premium en componente sin pasar por token/preset.
3. Toda variante debe validarse en adapter antes de llegar al componente.
4. Los fallbacks deben ser explicitos y logueados.

## Comparativa operativa: Jewelry Box vs Luxury Hacienda

1. Hero:
    - Jewelry: glassmorphism luminoso, calligraphy premium.
    - Luxury: dark editorial, metal aged-gold.
2. Countdown:
    - Jewelry: superficie clara con reflejos suaves.
    - Luxury: bloques oscuros con acento dorado y acabado cuero.
3. Location:
    - Jewelry: tarjetas claras translúcidas.
    - Luxury: tarjetas oscuras con marco y textura.
4. Itinerary:
    - Jewelry: linea elegante y alto contraste claro.
    - Luxury: estilo editorial clasico y tipografia hacienda.
5. RSVP:
    - Jewelry: CTA elegante de alto contraste claro.
    - Luxury: CTA oscuro con acento dorado.
6. Gallery:
    - Jewelry: brillo suave, marco fino, lectura clara.
    - Luxury: curaduria cinematica con foco en textura y profundidad.
7. Gifts:
    - Jewelry: limpio y luminoso.
    - Luxury: oscuro, sobrio y texturizado.
8. Thank-you:
    - Jewelry: cierre luminoso sentimental.
    - Luxury: cierre editorial con firma premium.
