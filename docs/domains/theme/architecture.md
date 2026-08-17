# Theme And Token Architecture

**Last Updated:** 2026-08-17

Celebra-me uses a strict three-level styling architecture. The post-migration structural,
presentation, skin, fallback, and profile inventory is maintained in
[`variant-system.md`](variant-system.md).

The latest bounded corpus audit is
[`render-parity-ownership-audit-2026-08-10.md`](../../archive/reports/render-parity-ownership-audit-2026-08-10.md).
It is the evidence record for parity status and remaining compatibility ownership; it does not
authorize changes to runtime, content, or styling by itself.

Gallery section variants (as-is catalog, compatibility aliases, and the canonical layout-role
contract) are documented in [`gallery-variants.md`](gallery-variants.md).

CSS visual parity before profile LAYOUT deletion is gated by
[`css-visual-parity.md`](css-visual-parity.md). Full invitation/preset ownership inventory:
[`corpus-bundle-inventory.md`](corpus-bundle-inventory.md). Celestial-blue pilot detail:
[`celestial-blue-bundle-inventory.md`](celestial-blue-bundle-inventory.md).

## Invitation CSS ownership (normative)

Three homes. Exclusive ownership. Do not collapse looks into one SCSS file per invitation/demo.

### Section variant

- **Path / marker:** `section.variant` → `data-variant`;
  `src/styles/themes/sections/<section>/_<semantic>.scss`
- **Owns:** Layout, geometry, structural/skin behavior reusable across invitations.
- **Must not:** Read `theme.preset`, slug, `visualProfileId`, or client identity.
- **`data-variant`:** Never a `ThemePreset` name and never derived from `theme.preset`.

### Theme preset

- **Path / marker:** `.theme-preset--*`; `invitation-presets/{preset}.scss` +
  `themes/presets/_*.scss`
- **Owns:** Reusable atmosphere only — semantic color/type/radius/motion and public component
  tokens.
- **Must not:** Own section layout/geometry or client-specific overrides.
- **Existence rule:** Only when ≥2 invitations or demos share the pack; otherwise use a variant or a
  profile.

### Invitation profile

- **Path / marker:** `invitation-profiles/{id}.scss` (`id` = `visualProfileId || slug`)
- **Owns:** Client palette token remap and rhythm/intersection overrides that differ from the
  preset.
- **Must not:** Re-declare section layout; set `font-family` / `background` directly on section
  element classes (use tokens); duplicate active variant or preset rules.

Shared structural base `src/styles/invitation/` is out of scope for ownership moves in this
contract.

### Explicit non-goals

- One monolithic SCSS file per invitation/demo as the primary look home.
- Renaming or merging presets into the section-variant vocabulary.
- Blind LAYOUT deletion from mega-profiles without the CSS visual parity harness.

### Migration rule (preset section bundles)

For each change to `invitation-sections-by-preset/{preset}.scss` or its imported section modules:

1. Classify each rule as atmosphere-token, layout/skin, or duplicate-of-variant/preset.
2. Move layout/skin into the owning **semantic** variant SCSS; ensure JSON carries an explicit valid
   `section.variant`.
3. Leave only atmosphere tokens on the preset (or preset-scoped component-token modules).
4. Delete matching duplicate rules from dependent profiles.

Stop if a change only reshuffles CSS between files without changing ownership.

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

Invitation presets are reusable atmosphere packs (catalog SKUs), not per-invitation look files:

- `src/styles/themes/presets/_jewelry-box.scss`
- `src/styles/themes/presets/_jewelry-box-wedding.scss`
- `src/styles/themes/presets/_luxury-hacienda.scss`
- `src/styles/themes/presets/_editorial.scss`
- `src/styles/themes/presets/_premiere-floral.scss`
- `src/styles/themes/presets/_celestial-blue.scss`
- `src/styles/themes/presets/_enchanted-rose.scss`
- `src/styles/themes/presets/_sacred-keepsake.scss`
- `src/styles/themes/presets/_angelic-presence.scss`

Non-invitation presets are separate:

- `auth-dark` for auth surfaces
- `dashboard-dark` for dashboard surfaces
- `invitation` for shared invitation base tokens

Preset files may override semantic color, type, surface, shadow, and motion intent. They may also
override public component tokens when a theme needs specific behavior. They must not introduce
hidden theme-local token systems or own section layout.

## Invitation Theme CSS Boundaries

### Core Principle

**Presets expose tokens. Section variant files own section structure and section-specific visuals.
Profiles remap client palette and rhythm only.**

If a rule targets section DOM internals (selectors, pseudo-elements, layout overrides), it does
**not** belong in a preset or a profile.

### Layer Responsibilities

Invitation section styling has a strict responsibility boundary:

1. **`src/styles/invitation/_<section>.scss`** — Shared structural and base styles for the section.
   No preset-specific or invitation-specific visuals.

2. **`src/styles/themes/presets/_<preset>.scss`** — Theme tokens and custom properties only (pure
   atmosphere). No section DOM selectors such as `.family__panel`, `.location__card`, `.rsvp`,
   `.hero`. No section pseudo-elements or structural overrides.

3. **`src/styles/themes/sections/<section>/_<variant>.scss`** — Concrete layout and visual rules for
   one **semantic** section variant (e.g. `_split-cover.scss`, `_formal-register.scss`,
   `_magazine-folio.scss`). Consumes theme tokens from the parent `.theme-preset--*` wrapper.
   Emitted on DOM as a single `data-variant` that is never a theme preset name.

4. **`src/styles/invitation-profiles/{id}.scss`** — Client palette token remap and
   intersection/rhythm overrides only.

### Decision Rules

| Situation                                                                                           | Where it belongs                                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Whole-theme change (colors, surfaces, shadows, motion)                                              | Preset (`_<preset>.scss`)                                     |
| Shared behavior across all variants of one section                                                  | Section base (`invitation/_<section>.scss`)                   |
| Shared visual behavior across some variants of one section                                          | Section theme base (`themes/sections/<section>/_base.scss`)   |
| One section variant with selectors, pseudo-elements, or decorative rules that tokens cannot express | Section variant (`themes/sections/<section>/_<variant>.scss`) |
| Client palette or rhythm that differs from the shared preset                                        | Invitation profile (`invitation-profiles/{id}.scss`)          |
| Tokens are sufficient for the variation                                                             | Do **not** create a new variant file                          |

Detailed decision rule:

- If a change can be expressed as a value, token, or custom property, keep it in the preset or
  consume it from the section base.
- If a change needs a selector, layout rule, pseudo-element, internal section class, structural
  override, or section DOM knowledge, place it under `src/styles/themes/sections/<section>/` with a
  **semantic** variant name.
- If a rule applies to every variant of a section, keep it in
  `src/styles/invitation/_<section>.scss`.
- If a rule is shared by multiple variants of the same section, keep it in
  `src/styles/themes/sections/<section>/_base.scss`.
- If a rule is unique to one variant of one section, keep it in
  `src/styles/themes/sections/<section>/_<variant>.scss`.
- If a rule is unique to one invitation's palette or cadence, keep it in the invitation profile as
  tokens / rhythm only.
- Create a new variant file only when tokens are insufficient to express the required behavior.

Presets must not target concrete section DOM selectors, internal section classes, IDs, `[data-*]`
selectors, or pseudo-elements. Section variant files are optional and should exist only when they
add real section-specific behavior. Files should not exist only for symmetry.

### Token Inheritance Constraint

Section theme base files (`themes/sections/<section>/_base.scss`) must not declare CSS custom
properties that preset files also declare. Because `:where()` targets the section element itself,
declaring a token there shadows the preset's value on the `.theme-preset--*` ancestor, making the
preset value unreachable to descendants.

**If a token should be configurable by presets**, declare it only in the preset and use a
`var(--token, <default>)` fallback at the point of consumption (in the component section or the base
invitation stylesheet).

✅ Correct — fallback at consumption point:

```scss
/* src/styles/invitation/_section.scss */
.section__label {
  color: var(--section-label-color, var(--color-text-emphasis));
}
```

❌ Wrong — section theme base shadows preset:

```scss
/* src/styles/themes/sections/section/_base.scss */
:where(.section) {
  --section-label-color: var(--color-text-emphasis);
}
```

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

**Prefer semantic section variant** — structure lives under a behavior name, not a theme name:

```scss
/* ✅ CORRECT — src/styles/themes/sections/family/_split-groups.scss */
.family[data-variant='split-groups'] {
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

**Correct profile usage** — client palette remap only:

```scss
.event--america-johana.theme-preset--celestial-blue {
  --america-red: rgb(132 21 30);
  --color-action-accent: var(--america-red);
}
```

Controlled exceptions for real layout, pseudo-element, responsive, or decorative behavior belong
under `src/styles/themes/sections/<section>/` with a semantic `data-variant`, not in presets or
profiles. Countdown skin variants (`editorial-folio`, `magazine-folio`, …) are the reference for
behavior-named skins; preset-named section modules under `invitation-sections-by-preset/` are legacy
delivery and must thin toward tokens + semantic variants.

Delete or avoid a section theme file when it is empty, only repeats base defaults, exists only for
symmetry, or contains rules that can be represented as preset tokens without section DOM knowledge.

## Section Partials

Section partials under `src/styles/themes/sections/**` are file organization, not a fourth token
layer. They may define layout, responsive behavior, section presentation, and scoped component
tokens. They should consume semantic tokens and component tokens by default.

Theme identity belongs in the preset. If a section requires theme-specific behavior, expose that
behavior through a public component token and let the preset provide the value.

Canonical TypeScript and section renderers must remain invitation-agnostic: they consume canonical
section contracts and semantic roles, not invitation slugs, event types, profile identities, or
invitation-specific CSS custom-property names. A legacy identity branch is permitted only at a named
adapter, schema, navigation, policy, or profile compatibility boundary with a documented consumer
and removal condition. Do not treat high fan-in alone as a leak when the module is an explicit
composition root (for example, intersection profiles).

## Behavior-Named Section Variants

Reusable section mechanics use behavior names instead of borrowing another theme's identity. The
paper itinerary behavior is `timeline-paper`, the flat ledger is `editorial-ledger`, the numbered
magazine program is `editorial-program`, the credential pass is `formal-pass`, and the underline
confirmation register is `formal-register`. Itinerary variants are selected only via
`itinerary.variant`; Personalized Access and RSVP variants are selected only via
`rsvp.personalizedAccess.variant` and `rsvp.variant`. Legacy `itinerary.presentation.behavior`
remains a compatibility input. Omitted behavior resolves to `standard`. Theme presets remain visual
skins.

## Runtime CSS Delivery

- `src/styles/invitation.scss` keeps shared invitation structure and imports the existing
  `src/styles/themes/sections/_index.scss` barrel for shared section bases.
- `src/styles/invitation-presets/*.scss` remain the preset and font entrypoints.
- `src/styles/invitation-sections-by-preset/*.scss` import canonical `src/styles/themes/sections/**`
  modules directly. Their import order is the emitted cascade order, and a bundle may explicitly
  compose multiple canonical modules when a variant depends on both. Over time these bundles must
  shrink to atmosphere/component-token modules; layout/skin must move to semantic variant
  entrypoints.
- `src/lib/invitation/section-css-resolver.ts` emits one active section bundle plus requested
  canonical Gallery/structural partials, a footer visual override, envelope reveal CSS, and the
  active visual profile. Canonical section partials are not exposed through a general per-section
  passthrough directory.
- Invitation routes keep preset, envelope-reveal, and visual-profile stylesheets render-blocking for
  the sealed-envelope first paint. Section bundles, gallery/footer overrides, and structural
  partials start as `media="not all"` and are promoted after first paint, when `envelope:opened`
  fires, after a bounded paint-observer fallback, or immediately when the envelope is skipped
  (`skipEnvelope`, returning `envelope-opened-{slug}`, or no envelope). Document order is unchanged
  so profile CSS still wins the cascade.

Gallery CSS starts with the theme-preset bundle. When an explicit semantic `gallery.variant` differs
from the active theme, the section CSS resolver emits the matching layout partial independently.
Theme preset alone does not select gallery structure; the renderer always emits `data-variant` for
the resolved layout ID. See [`gallery-variants.md`](gallery-variants.md) for the current map,
compatibility boundary, and retained profile exceptions.

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
pnpm validate:changed
pnpm test tests/provision/local-render-corpus-regression.test.ts
pnpm lint:styles
```

Profile LAYOUT deletions additionally require the CSS visual parity harness in
[`css-visual-parity.md`](css-visual-parity.md).
