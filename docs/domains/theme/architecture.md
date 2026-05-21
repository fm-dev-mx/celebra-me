# Theme And Token Architecture

**Last Updated:** 2026-05-20

Celebra-me uses a strict three-level styling architecture.

## Token Levels

1. **Foundation tokens** live in `src/styles/tokens/system/**`. They are SCSS variables only and
   contain raw values such as palette colors, spacing, radius, typography families, motion values,
   and shadows. They do not express product intent.

2. **Semantic tokens** live in `src/styles/tokens/semantic/**` and are published through
   `src/styles/global.scss`. They are `:root` CSS custom properties for reusable system intent, such
   as `--color-text-primary`, `--color-surface-elevated`, `--color-action-accent`,
   `--color-border-subtle`, `--color-state-danger`, `--font-display`, `--shadow-soft`,
   `--duration-fast`, and `--ease-premium`.

3. **Component tokens** live with the component, layout, section, or surface that owns them. They
   are scoped CSS custom properties for public component contracts, such as
   `--header-nav-color-scrolled`, `--mobile-drawer-bg-open`, `--hero-card-bg`,
   `--dashboard-card-bg`, `--auth-panel-bg`, and `--rsvp-error-field`.

Themes and states are not separate token layers. Themes override semantic tokens and public
component tokens. States are represented inside component token contracts.

## Theme Presets

Invitation presets are the canonical source of visual identity for invitation themes:

- `src/styles/themes/presets/_jewelry-box.scss`
- `src/styles/themes/presets/_jewelry-box-wedding.scss`
- `src/styles/themes/presets/_luxury-hacienda.scss`
- `src/styles/themes/presets/_editorial.scss`
- `src/styles/themes/presets/_premiere-floral.scss`
- `src/styles/themes/presets/_celestial-blue.scss`
- `src/styles/themes/presets/_enchanted-rose.scss`
- `src/styles/themes/presets/_sacred-keepsake.scss`
- `src/styles/themes/presets/_angelic-presence.scss`

Non-invitation presets are separate: `auth-dark` for auth surfaces and `jewelry-box-landing` for
landing pages.

Preset files may override semantic color, type, surface, shadow, and motion intent. They may also
override public component tokens when a theme needs specific behavior. They must not introduce
hidden theme-local token systems or own section layout.

## Invitation Theme CSS Boundaries

### Core Principle

**Presets expose tokens. Section files own section structure and section-specific visuals.**

If a rule targets section DOM internals (selectors, pseudo-elements, layout overrides), it does
**not** belong in a preset.

### Layer Responsibilities

Invitation section styling has a strict responsibility boundary:

1. **`src/styles/invitation/_<section>.scss`** — Shared structural and base styles for the section.
   No preset-specific or invitation-specific visuals.

2. **`src/styles/themes/presets/_<preset>.scss`** — Theme tokens and custom properties only. No
   section DOM selectors such as `.family__panel`, `.location__card`, `.gallery__item`. No section
   pseudo-elements or structural overrides.

3. **`src/styles/themes/sections/<section>/_base.scss`** — Shared visual rules for one section. May
   use section-scoped selectors. No global theme tokens or unrelated sections.

4. **`src/styles/themes/sections/<section>/_<variant>.scss`** — Concrete visual rules for one
   section variant. Use for section-specific selectors, pseudo-elements, and decorative rules that
   tokens cannot express cleanly.

### Decision Rules

| Situation                                                                                           | Where it belongs                                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Whole-theme change (colors, surfaces, shadows, motion)                                              | Preset (`_<preset>.scss`)                                     |
| Shared behavior across all variants of one section                                                  | Section base (`invitation/_<section>.scss`)                   |
| Shared visual behavior across some variants of one section                                          | Section theme base (`themes/sections/<section>/_base.scss`)   |
| One section variant with selectors, pseudo-elements, or decorative rules that tokens cannot express | Section variant (`themes/sections/<section>/_<variant>.scss`) |
| One invitation or demo only                                                                         | Content/config first — avoid global CSS                       |
| Tokens are sufficient for the variation                                                             | Do **not** create a new variant file                          |

Detailed decision rule:

- If a change can be expressed as a value, token, or custom property, keep it in the preset or
  consume it from the section base.
- If a change needs a selector, layout rule, pseudo-element, internal section class, structural
  override, or section DOM knowledge, place it under `src/styles/themes/sections/<section>/`.
- If a rule applies to every variant of a section, keep it in
  `src/styles/invitation/_<section>.scss`.
- If a rule is shared by multiple variants of the same section, keep it in
  `src/styles/themes/sections/<section>/_base.scss`.
- If a rule is unique to one variant of one section, keep it in
  `src/styles/themes/sections/<section>/_<variant>.scss`.
- If a rule applies to only one specific invitation or demo, express it through content/config
  rather than adding global CSS.
- Create a new variant file only when tokens are insufficient to express the required behavior.

Presets must not target concrete section DOM selectors, internal section classes, IDs, `[data-*]`
selectors, or pseudo-elements. Section variant files are optional and should exist only when they
add real section-specific behavior. Files should not exist only for symmetry.

### Examples

**Avoid in presets** — section DOM selectors do not belong here:

```scss
/* ❌ WRONG — preset targeting section DOM internals */
.theme-preset--celestial-blue {
  .family__panel {
    width: min(calc(100% - 2rem), 42rem);
  }
}
```

**Prefer section variant** — section-specific behavior lives in its own file:

```scss
/* ✅ CORRECT — src/styles/themes/sections/family/_celestial-blue.scss */
.family[data-variant='celestial-blue'] {
  .family__panel {
    width: min(calc(100% - clamp(2rem, 8vw, 7rem)), var(--family-panel-max-width));
  }
}
```

**Correct preset usage** — tokens and custom properties only:

```scss
.theme-preset--celestial-blue {
  --color-action-accent: var(--color-satin-blue);
  --family-panel-bg: rgb(var(--color-diamond-white-rgb) / 86%);
}
```

Controlled exceptions are allowed when a variant has real layout, pseudo-element, responsive, or
decorative behavior. Those exceptions belong under `src/styles/themes/sections/<section>/`, not in
presets. Countdown is a reference example for this boundary after its cleanup; it is not proof that
every section needs a `_base.scss` file or one file per variant.

Delete or avoid a section theme file when it is empty, only repeats base defaults, exists only for
symmetry, or contains rules that can be represented as preset tokens without section DOM knowledge.

## Section Partials

Section partials under `src/styles/themes/sections/**` are file organization, not a fourth token
layer. They may define layout, responsive behavior, section presentation, and scoped component
tokens. They should consume semantic tokens and component tokens by default.

Theme identity belongs in the preset. If a section requires theme-specific behavior, expose that
behavior through a public component token and let the preset provide the value.

## Runtime Contract

`src/lib/theme/theme-contract.ts` owns active event types and active invitation preset names.
Schemas consume that contract through `src/lib/schemas/content/**`.

`src/lib/theme/color-tokens.ts` is a content color role contract. It maps approved content roles to
semantic CSS custom properties and must not grow into a parallel color system.

## Hardcoded Values

Hardcoded colors should normally exist only in:

- foundation token files,
- explicit email constants where CSS variables are unreliable,
- rare one-off decorative effects that are intentionally non-reusable.

Reusable UI colors must flow through semantic or component tokens.

## Validation

After token, preset, or section architecture changes, run the available relevant commands:

```bash
pnpm lint:styles
pnpm type-check
pnpm build
pnpm validate:ui-governance
pnpm validate:event-parity
```
