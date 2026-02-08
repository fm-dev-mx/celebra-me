# Typography System — Celebra-me (Core Elegant)

This document defines the **Default Base Typography** for the Celebra-me platform.
These tokens serve as the foundation for the "Elegant/Classic" aesthetic used in the XV Años Demo and the Landing Page.

> **Note:** Future themes (e.g., Neon, Modern) will extend or override this system.

---

## Typography Tokens — "Core 5"

A curated font system optimized for premium digital invitations with high performance.

### Font Families

| Role | Family | Weights | Use Case |
|------|--------|---------|----------|
| **Display Formal** | Cinzel | 400, 700 | Monumental headers, XV/Wedding titles |
| **Display Elegant** | Playfair Display | 400, 700 | Editorial-style titles, Hero sections |
| **Calligraphy** | Pinyon Script | 400 | Accents, signatures, "y" separators |
| **Body Narrative** | EB Garamond | 400, 500 | Paragraphs, stories, descriptions |
| **UI/Functional** | Montserrat | 400, 600 | Buttons, navigation, metadata |

### SCSS Tokens

Defined in `src/styles/global/_variables.scss`:

```scss
$font-display-formal: 'Cinzel', serif;
$font-display-elegant: 'Playfair Display', serif;
$font-calligraphy: 'Pinyon Script', cursive;
$font-body: 'EB Garamond', Georgia, serif;
$font-ui: 'Montserrat', system-ui, sans-serif;
```

### Fluid Type Scale

Responsive sizing using `clamp()`:

```scss
$text-h1-fluid: clamp(2.5rem, 8vw, 5rem);
$text-h2-fluid: clamp(1.8rem, 5vw, 3rem);
$text-h3-fluid: clamp(1.4rem, 3vw, 2rem);
$text-body-fluid: clamp(1rem, 1.2vw, 1.25rem);
```

### Utility Classes

Defined in `src/styles/global/_typography.scss`:

- `.font-heading-formal` — Cinzel
- `.font-heading-elegant` — Playfair Display
- `.font-calligraphy` — Pinyon Script
- `.font-body` — EB Garamond
- `.font-ui` — Montserrat

---

## Principles

1. **Performance First**: Only Core 5 fonts loaded; no redundant packages.
2. **Fallback Resilience**: Each token includes system fallbacks.
3. **Fluid Scaling**: All sizes use `clamp()` for seamless responsiveness.
4. **@fontsource**: Provides `font-display: swap` by default.
