# Inventario de Secciones y Temas

Este documento proporciona un mapa detallado del sistema de temas, vinculando secciones,
componentes, archivos de estilo y variantes disponibles.

## Resumen de Estándares

- **Selector Principal**: Todos los estilos de sección se encapsulan usando `[data-variant='...']`.
- **Ubicación de Estilos**: Los estilos de tema residen en
  `src/styles/themes/sections/_<section>-theme.scss`.
- **Ley de Aislamiento**: Los estilos base NO contienen lógica de tema; los presets de tema NO
  contienen selectores de clase.

---

## Inventario de Secciones

| Sección            | Componente Principal  | Archivo de Tema (SCSS)  | Variantes Implementadas                                                        |
| :----------------- | :-------------------- | :---------------------- | :----------------------------------------------------------------------------- |
| **Hero**           | `Hero.astro`          | `_hero-theme.scss`      | `standard`, `jewelry-box`, `luxury-hacienda`                                   |
| **Reveal (Sobre)** | `EnvelopeReveal.tsx`  | `_reveal-theme.scss`    | `jewelry-box`, `luxury-hacienda`                                               |
| **Quote**          | `Quote.astro`         | `_quote-theme.scss`     | `elegant`, `modern`, `jewelry-box`, `luxury-hacienda`, `minimal`, `floral`     |
| **Countdown**      | `Countdown.astro`     | `_countdown-theme.scss` | `minimal`, `vibrant`, `jewelry-box`, `classic`, `modern`, `luxury-hacienda`    |
| **Location**       | `EventLocation.astro` | `_location-theme.scss`  | `structured`, `organic`, `minimal`, `luxury`, `jewelry-box`, `luxury-hacienda` |
| **Itinerary**      | `Itinerary.astro`     | `_itinerary-theme.scss` | `base`, `jewelry-box`, `luxury-hacienda`                                       |
| **Family**         | `Family.astro`        | `_family-theme.scss`    | `standard`, `jewelry-box`, `luxury-hacienda`                                   |
| **Gifts**          | `Gifts.astro`         | `_gifts-theme.scss`     | `standard`, `jewelry-box`, `luxury-hacienda`                                   |
| **Gallery**        | `Gallery.astro`       | `_gallery-theme.scss`   | `standard`, `jewelry-box`, `luxury-hacienda`                                   |
| **RSVP**           | `RSVP.tsx`            | `_rsvp-theme.scss`      | `standard`, `jewelry-box`, `luxury-hacienda`                                   |
| **Thank You**      | `ThankYou.astro`      | `_thank-you-theme.scss` | `standard`, `jewelry-box`, `luxury-hacienda`                                   |
| **Header**         | `EventHeader.astro`   | `_header-theme.scss`    | `standard`, `jewelry-box`, `luxury-hacienda`                                   |

---

## Detalles Técnicos por Sección

### Hero

- **Selector**: `.invitation-hero[data-variant]`
- **Características**: Maneja overlays de fondo, tipografía de título y animaciones de entrada.

### Envelope Reveal (Sobre)

- **Selector**: `.envelope-wrapper[data-variant]`
- **Características**: Controla la estética del sobre, el sello y la tarjeta de apertura. Posee
  ajustes específicos de animación por tema.

### Itinerary

- **Selector**: `.itinerary[data-variant]`
- **Características**: Define la línea de tiempo, iconos y tipografía editorial.

### Family

- **Selector**: `.family[data-variant]`
- **Características**: Utiliza un sub-componente `FamilyDecorations` para inyectar marcos y fondos
  específicos de tema.

---

## Estado de Cumplimiento (Audit Feb 2026)

- [x] Todas las secciones principales inyectan `data-variant`.
- [x] Todos los archivos en `sections/` usan selectores de atributo.
- [x] Zero fugas de estilos entre `jewelry-box` y `luxury-hacienda` en componentes clave.
