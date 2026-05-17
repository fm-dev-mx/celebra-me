# Theme And Token Architecture

**Last Updated:** 2026-05-17

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
- `src/styles/themes/presets/_sacred-keepsake.scss`
- `src/styles/themes/presets/_angelic-presence.scss`

Non-invitation presets are separate: `auth-dark` for auth surfaces and `jewelry-box-landing` for
landing pages.

Preset files may override semantic color, type, surface, shadow, and motion intent. They may also
override public component tokens when a theme needs specific behavior. They must not introduce
hidden theme-local token systems or own section layout.

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
