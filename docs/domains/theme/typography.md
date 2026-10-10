# Typography System

**Last Updated:** 2026-09-30

This document defines the active, route-scoped typography stack.

## Loaded Runtime Families

`Layout.astro` loads Montserrat for the shared application shell. Invitation font imports live in
the active preset entrypoints under `src/styles/invitation-presets/*.scss`, so a route downloads
only the families required by its preset. The supported family vocabulary includes Cinzel, Playfair
Display, Pinyon Script, EB Garamond, Montserrat, Cormorant Garamond, Bodoni Moda, Instrument Sans,
The Nautigal, and Special Elite.

## Registered Family Names

`@fontsource-variable/*` packages register their `@font-face` rules under the family name with a
` Variable` suffix. Static `@fontsource/*` packages register the plain name. A declaration that
names only the plain family of a variable package never matches the downloaded face: it renders the
fallback unless the visitor has the static font installed locally.

| Package                                   | Registered family             | System token                                |
| ----------------------------------------- | ----------------------------- | ------------------------------------------- |
| `@fontsource-variable/cinzel`             | `Cinzel Variable`             | `$sys-font-display-formal`                  |
| `@fontsource-variable/playfair-display`   | `Playfair Display Variable`   | `$sys-font-display-elegant`                 |
| `@fontsource-variable/cormorant-garamond` | `Cormorant Garamond Variable` | `$sys-font-display-hacienda`                |
| `@fontsource-variable/eb-garamond`        | `EB Garamond Variable`        | `$sys-font-body`, `$sys-font-body-hacienda` |
| `@fontsource-variable/montserrat`         | `Montserrat Variable`         | `$sys-font-ui`                              |
| `@fontsource-variable/bodoni-moda`        | `Bodoni Moda Variable`        | —                                           |
| `@fontsource-variable/instrument-sans`    | `Instrument Sans Variable`    | —                                           |
| `@fontsource/pinyon-script`               | `Pinyon Script`               | `$sys-font-calligraphy`                     |
| `@fontsource/the-nautigal`                | `The Nautigal`                | —                                           |
| `@fontsource/parisienne`                  | `Parisienne`                  | —                                           |
| `@fontsource/special-elite`               | `Special Elite`               | —                                           |

Name the registered family first and keep the plain family as a fallback, for example
`'Playfair Display Variable', 'Playfair Display', serif`. Sass interpolation (`#{...}`) emits the
list unquoted, which remains a valid `font-family` value.

## Route Loading Map

A registered name renders only on routes that also import its package. Invitation routes are
`/[eventType]/[slug]` and `/dashboard/invitaciones/[id]/preview`; the preset entrypoint comes from
`src/lib/invitation/preset-css-resolver.ts` (unknown presets fall back to `jewelry-box`), and
section variants and profiles come from `src/lib/invitation/section-css-resolver.ts`.

- **Montserrat:** every route rendered through `Layout.astro`, including `/` and invitation routes.
- **Playfair Display:** `/` (`landing.scss`); presets jewelry-box, jewelry-box-wedding, editorial
  and editorial-magazine; itinerary variant editorial-program.
- **Cinzel:** presets editorial and premiere-floral; profile melissa-y-luis-osmar.
- **Cormorant Garamond:** presets luxury-hacienda, celestial-blue, sacred-keepsake, enchanted-rose
  and angelic-presence; variants formal-register, formal-pass and ceremonial-portrait; invitation
  profiles that `@use` it.
- **EB Garamond:** presets jewelry-box, jewelry-box-wedding, editorial, luxury-hacienda and
  celestial-blue.

`DashboardLayout.astro` (every `/dashboard/*` route except `mfa-setup` and `cambiar-contrasena`) and
the Open Graph shells under `/i/[shortId]` import no font package; their `--font-*` values resolve
to the fallback families.

## Core Roles

- Display Formal: Cinzel
- Display Elegant: Playfair Display
- Display Hacienda: Cormorant Garamond
- Display Editorial: Bodoni Moda
- Calligraphy: Pinyon Script and The Nautigal
- Body Narrative: EB Garamond
- UI/Functional: Montserrat and Instrument Sans
- Accent/ornamental fallbacks: Special Elite
- Celestial Blue editorial pairing: Cormorant Garamond + Instrument Sans

## Token Sources

- System family stacks: `src/styles/tokens/system/_type.scss`
- Authoring aliases: `src/styles/tokens/_typography.scss`
- Semantic/runtime type tokens: `src/styles/tokens/semantic/_type.scss`
- Runtime CSS variables consumed by components: `src/styles/global.scss`

## Runtime Variable Surface

Current runtime typography variables include:

- `--font-display`
- `--font-display-formal`
- `--font-display-elegant`
- `--font-display-hacienda`
- `--font-calligraphy`
- `--font-body`
- `--font-body-narrative`
- `--font-body-hacienda`
- `--font-ui`
- `--font-label`

## Performance & Budget

Loading multiple font families impacts page load performance and Cumulative Layout Shift (CLS).

- **Shared shell cap**: keep the global layout to the UI family unless a cross-application need is
  proven.
- **Preset scope**: add invitation families to the owning preset stylesheet, not to `Layout.astro`.
- **Fallbacks**: Always provide generic fallbacks (`serif`, `sans-serif`) in the CSS variables to
  prevent invisible text during loading.

## Usage Rules

- Use the `--font-*` CSS variables in theme-sensitive component styles.
- Do not hardcode raw font-family declarations inside invitation section styles when a runtime token
  already exists.
- When a preset remap or `var()` fallback must name a family, use the registered name from
  [Registered Family Names](#registered-family-names) first.
- If the loaded font list changes, update this doc and the owning layout or preset entrypoint in the
  same task.
