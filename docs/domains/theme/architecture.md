# Theme And Token Architecture

**Last Updated:** 2026-09-28

Celebra-me uses a strict three-level styling architecture. The post-migration structural,
presentation, skin, fallback, and profile inventory is maintained in
[`variant-system.md`](variant-system.md).

Gallery section variants (as-is catalog, compatibility aliases, and the canonical layout-role
contract) are documented in [`gallery-variants.md`](gallery-variants.md).

CSS visual parity before profile LAYOUT deletion is gated by
[`css-visual-parity.md`](css-visual-parity.md).

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

- **Path / marker:** `invitation-profiles/{visualProfileId}.scss` (`visualProfileId` is required for
  every managed invitation)
- **Owns:** Custom-property declarations only: client palette token remap and rhythm/intersection
  token overrides that differ from the preset.
- **Must not:** Declare any non-custom property; re-declare section layout; style one section
  relative to another; render client text through `content:`; select by position or by data such as
  an image key; duplicate active variant or preset rules.
- **Demos:** A demo is styled only by a demo-owned profile (`demo-*`). A client profile never styles
  a demo, and `pnpm validate:no-pii` rejects it.
- **Enforcement:** `tests/unit/invitation-profile-boundary.test.ts`.

### Frozen delivered profiles

Profiles delivered before the token-only rule are closed deliverables, listed with their digest in
`tests/unit/invitation-profile-boundary.test.ts`. They are not edited, reused or extended, and each
is deleted together with its invitation. The list only shrinks. A look that a new invitation needs
is built as a registered section variant, an intersection pattern or preset tokens, proven on a
demo, and then selected with data; it never starts in a profile.

Shared structural base `src/styles/invitation/` is out of scope for ownership moves in this
contract.

### Transitional ownership exceptions

Files under `src/styles/invitation-sections-by-preset/**` still contain preset-named section
selectors and layout rules. They are temporary exceptions, not valid architecture: no new preset-
specific structural selector may be added, and an existing rule may be removed or moved only with
the CSS visual-parity gate. The exception ends when every rule is owned by a section base, a
registered semantic variant, or preset tokens. Frozen delivered profiles follow their own rule
above.

### Optional stationery treatments

The `editorial-ledger` itinerary exposes optional stationery tokens for its existing container:
`--editorial-ledger-panel-width`, `--editorial-ledger-panel-padding`, `--editorial-ledger-panel-bg`,
`--editorial-ledger-panel-shadow`, and `--editorial-ledger-panel-outline`. Defaults retain the
transparent, unpadded 1000px container. `--editorial-ledger-icon-display`,
`--editorial-ledger-icon-space`, and `--editorial-ledger-row-space` opt into contained line icons
and row breathing room; defaults keep icons hidden and spacing unchanged.
`--editorial-ledger-time-width` controls the desktop time column (default 7rem). The variant owns
geometry; profiles supply values only.

Decorative cutouts are typed content, not profile layout: `countdown.ornament`, `location.ornament`
(after the intro) and `thankYou.ornament` (below the signature) take a transparent image that
renders in a fixed, contained box (`object-fit: contain`), so it never crops and reserves its height
before loading. Sizing tokens: `--location-ornament-{max-width,height,margin,position,filter}`
(defaults `18rem`, `9rem`, `1.5rem auto`, `center bottom`, `none`),
`--thank-you-ornament-{max-width,height,margin,position,filter}` (`16rem`, `8rem`, `1.75rem auto 0`,
`center bottom`, `none`) and, on `magazine-folio`,
`--countdown-ornament-{max-width,height,margin,filter}` (`20rem`, `10rem`,
`clamp(1.5rem, 5vw, 2.5rem) auto 0`, `none`). Location and thank-you rules use `:where()`; content
without an ornament renders nothing new.

The editorial footer skin (`editorial` and `editorial-magazine`) resolves its ground, rule, brand
credit, contact button and replay link through `--footer-editorial-*` tokens (`bg`, `bg-image`,
`border-top`, `shadow`, `padding`, `content-gap`, `content-gap-md`, `powered-color`, `logo-width`,
`logo-filter`, `cta-border`, `cta-bg`, `cta-color`, `cta-icon-filter`, `cta-hover-border`,
`cta-hover-bg`, `cta-hover-color`, `cta-hover-shadow`, `replay-color`, `replay-hover-color`). Every
default equals the previous literal, so profiles only restate what they change.

Collector cutouts are typed content too: `envelope.coverOrnament` (one image on the printed cover
face) and `envelope.spreadOrnaments` (one or two on the first inner page) render as contained,
token-anchored boxes (`--ec-face-ornament-{inset,width,height,position,filter}`, defaults
`auto auto 10% 4%`, `30%`, `12%`, `left bottom`, drop shadow;
`--ec-page-ornament-{1,2}-{inset,width,height,position}` and `--ec-page-ornament-filter`, defaults
left/right bottom corners above the folio strip). The editorial-cover hero renders `hero.ornament`
as an emblem above the title (`--hero-ornament-{align,max-width,height,margin,position,filter}`,
defaults `center`, `7rem`, `4rem`, `0 0 1rem`, `center bottom`, `none`) and `hero.accentOrnament` as
a cutout below the details (`--hero-accent-ornament-*`, defaults `center`, `12rem`, `6rem`,
`1.25rem 0 0`, `center bottom`, `none`). Content without these renders nothing new. Lazy cutouts
declare `width`/`height` so the browser reserves their box. On phones,
`--hero-content-padding-block-start` (default `clamp(2.8rem, 7svh, 4.25rem)`) lets a profile whose
stacked hero fills the screen start the content below the absolute folio rail, and
`--hero-section-height` (default `100svh`, the base hero's fixed height) set to `auto` lets the
section grow so the portrait keeps its aspect ratio instead of flex-shrinking.

Multi-word cover marks: `--hero-watermark-size` (editorial-cover, default
`clamp(12rem, 36vw, 44rem)`) and `--ec-inside-mark-size` (collector inside cover, default
`calc(var(--ec-book-w) * 0.26)`) size the watermark figures; both are `white-space: nowrap`.
`envelope.coverEditionLabel` (typed content) replaces the collector rail's `NÚM.` label before
`coverEdition`; an empty string prints the edition alone (e.g. `3 AÑOS`), omitted keeps `NÚM.`.

Quote exposes `--quote-divider-bottom-display` for a closing ornament independently of the top
divider. It falls back to `--quote-divider-display`, preserving other invitations. Its optional
decorative SVG is controlled by `--quote-mark-display` (default `none`) and uses
`--quote-accent-color`. `--quote-content-weight` defaults to `500`; `--quote-ornament-display`
defaults to `block` for the attribution flourishes. These opt-ins do not select a renderer or change
the default presentation. Profile token overrides must target `.quote-section`, which owns the
existing component-local defaults, rather than relying on inherited values from the outer wrapper.
Attribution typography uses `--quote-author-font` (fallback `var(--font-display)`) and
`--quote-author-transform` (fallback `uppercase`), independently of the quotation typography.
Alignment and rhythm use `--quote-min-height` (`40svh`), `--quote-text-align` (`center`),
`--quote-container-max-width` (`800px`), `--quote-mark-margin` (`0 auto 1.5rem`), and
`--quote-author-justify` (`center`). `--quote-continuation-indent` defaults to `0` and applies only
to paragraphs following another quotation paragraph, not to wrapped lines. Defaults preserve the
centered composition; profiles can opt into left-aligned quotations without new renderers.
`--quote-line-margin-start` defaults to the paragraph's native `1em`; a profile can use `0` for
continuous verse lines without changing other quotations' spacing. An incoming quote wrapper may opt
into the shared `arch` intersection with `source: hero`. The arch uses the primary surface, a
restrained 1.5–2.75rem height, and an asymmetric mask; other quote boundaries remain neutral unless
selected in composition data.

`family.featuredImageAlt` supplies a descriptive image alternative through the existing
`ImageAsset`; omission retains the celebrant-name fallback. Source preservation uses the existing
image `delivery` contract, independently of the CSS crop. The shared Family media contract exposes
`--family-media-aspect-ratio` (fallback `3 / 4`), `--family-media-image-height` (fallback `100%`),
and `--family-media-image-fit` (fallback `cover`). Profiles can preserve an uncropped photograph
with `auto`, `auto`, and `contain` without replacing the canonical layout. `--family-item-align`
controls member alignment (fallback `center`); it complements the existing group text alignment,
padding, and parent-margin tokens without changing the standard split layout.

Gallery subtitles expose `--gallery-subtitle-max-width` (fallback `none`) and
`--gallery-subtitle-margin-inline` (fallback `0`) for bounded text measures and optional centering
without redefining the gallery header or grid in an invitation profile. Other variants retain their
existing sizing and alignment. The lightbox is a sibling of the gallery section: its property
consumers provide local fallbacks without shadowing inherited theme tokens. Atmospheric
intersections exclude direct dialog children from section stacking so viewport-fixed overlays retain
their positioning and stacking order.

### Gifts flatten

Gifts section styling is the flattened section-level variable contract in
`src/styles/invitation/_gifts.scss`. Theme-section Gifts partials under
`src/styles/themes/sections/gifts/` are not used. Other sections that retain real structural,
layout, content, or behavior variants must not be flattened through the Gifts pattern without
explicit parity evidence. `--gifts-card-description-color` falls back to
`var(--color-text-secondary)`; dark-section profiles can provide a readable description color
without changing invitation-wide text semantics.

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
- `dashboard-ivory` for dashboard surfaces (light ivory ground, charcoal chrome)
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
behavior-named skins; preset-named section modules under `invitation-sections-by-preset/` are
retired delivery and must thin toward tokens + semantic variants.

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
invitation-specific CSS custom-property names. No identity-specific compatibility branch may execute
in the canonical schema, adapter, render-plan, or section-rendering path. Historical inputs may be
handled only at a named migration or audit boundary with a documented consumer and removal
condition. Do not treat high fan-in alone as a leak when the module is an explicit composition root
(for example, intersection profiles).

## Behavior-Named Section Variants

Reusable section mechanics use behavior names instead of borrowing another theme's identity. The
paper itinerary behavior is `timeline-paper`, the flat ledger is `editorial-ledger`, the numbered
magazine program is `editorial-program`, the credential pass is `formal-pass`, and the underline
confirmation register is `formal-register`. Itinerary variants are selected only via
`itinerary.variant`; Personalized Access and RSVP variants are selected only via
`rsvp.personalizedAccess.variant` and `rsvp.variant`. The historical
`itinerary.presentation.behavior` input is rejected by the canonical schema and may appear only in
explicit migration/audit code. Theme presets remain visual skins.

The formal chapter owners expose optional profile controls for bounded typography and density:
`--formal-chapter-label-font`, `--pa-seal-display`, `--pa-guest-size`, `--pa-count-size`,
`--formal-register-shell-width`, `--formal-register-shell-padding`, and
`--formal-register-title-size`. Unconfigured consumers retain their previous font, seal, size and
spacing defaults. Profiles may set these controls and existing material tokens; structural
selectors, responsive behavior and interaction remain variant-owned.

Bounded controls retain their canonical section owner:

- `framed-portrait` consumes `--hero-portrait-radius`, `--hero-portrait-max-width`, mobile/desktop
  `--hero-portrait-width-*` and `--hero-portrait-height-*`, `--hero-section-padding`,
  `--hero-section-padding-desktop`, `--hero-title-size`, `--hero-title-max-width`, and
  `--hero-label-size`. Defaults retain the original arch, dimensions, spacing, and typography;
  profiles may preserve a complete rectangular photograph without adding layout selectors.
- `paired-feature-band` consumes the existing `--gallery-grid-columns-mobile`,
  `--gallery-item-aspect-ratio`, and `--gallery-item-aspect-ratio-feature` tokens. Unconfigured
  consumers retain one mobile column, 4:5 portraits, and an 8:5 feature band; the variant owns the
  paired desktop grid and full-width `feature` role.
- `ceremonial-family` consumes `--family-filigree-display` with a `block` fallback.
- The jewelry-box countdown skin consumes existing `--countdown-segment-inset`,
  `--countdown-label-size`, `--countdown-label-spacing`, and `--countdown-label-color` controls,
  plus `--countdown-label-opacity` (default `60%`). Existing visual defaults remain unchanged.

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

### Portrait letter composition

`thankYou.variant=portrait-letter` explicitly selects the narrow arched portrait and display-font
letter composition. `ThankYou.astro` reuses editorial markup; `_portrait-letter.scss` owns delivery
and `_portrait-letter-layout.scss` provides the shared implementation for its retained published
skin. The preset supplies atmosphere tokens only and cannot select this variant.

The `thankYou` variant `portrait-keepsake` owns the narrow rectangular portrait, serif letter,
responsive grid and signature geometry. It reuses the editorial DOM without selecting by theme or
invitation identity. It requires an explicit image. Managed definitions need canonical publication
before public database-backed routes use this variant.

## Image delivery and surface defaults

The retained Celestial standard hero consumes `--hero-title-max-width` with its existing 12ch
default. The demo narrows that token only at tablet widths to keep its title clear of the portrait;
photograph identity and focal points do not change.

RSVP supports `--rsvp-shell-background` (transparent by default), `--rsvp-shell-padding-block` (the
existing header/player clearance calculation by default), and `--rsvp-subcopy-color` (the existing
secondary text by default). The retained Celestial skin consumes `--rsvp-card-shadow` and
`--rsvp-skin-title-color` with its existing fallbacks. These hooks allow a profile to set a dark
finale without duplicating RSVP structure or changing other profiles.

Canonical image references carry explicit delivery intent when a section requires a particular
original or transformation. Preserve it through publication and adaptation; source identity alone is
not proof that the browser receives the same image. Gallery references may override delivery without
changing another section that uses the same source.

Content-only reconciliation may change or remove `delivery` only when the uploaded reference has
identical type, asset ID, URL and other identity fields in all three merge states. Concurrent
presentation edits still require conflict resolution. Asset replacement and Storage mutation remain
outside content-only; assets-only does not authorize presentation edits.

Explicit source preservation is limited to 6000 pixels per side and 24 megapixels, with the existing
transfer-weight, format, orientation, single-frame and full-decode checks. Normalized output remains
limited to 2560 pixels. Role transfer budgets still apply; do not remove a role to evade them.

The personalized-access skin supplies its paper finish through `--pa-card-glow`. Generic variant
fallbacks consume that same token so deferred stylesheet order cannot erase an authored texture. The
single-keepsake gallery owns its 0.68rem label size; profiles supply label color and tracking.

Section diagnosis measurement version 2 includes every visible text-owning HTML element, including
labels and spans, and records font style and letter spacing. Earlier measurements that sampled only
headings and paragraphs cannot certify complete typography coverage.

The public diagnostic can include complete pages with `--full-pages true`, using the existing
document-strip capture and crop-integrity checks. Visible Astro islands must hydrate before a
capture is valid. Nested screenshot helpers restore only overlay state they changed. Image evidence
retains delivered bytes and, for supported optimizer URLs, separately verifies the original input;
matching inputs do not waive requested transformations, natural dimensions, crops or pixel checks.
SVG identity normalizes only XML line endings while preserving the delivered-byte hash.

RSVP skins that create absolute decorative pseudo-elements must establish their own positioning
context on every matching RSVP shell, including the nested shells of the interactive island.
Decorations must remain inside RSVP and must not paint over the hero or neighboring sections.

The RSVP presence boundary disables initial animations for the first render. Server markup and
client hydration therefore stay visible and consistent when reduced motion is enabled; subsequent
form/status transitions retain their existing motion behavior.

Managed Storage and Cloudinary media bypass implicit Astro/Vercel re-encoding, even when URLs are
versioned. Canonical references use prepared files and `delivery.mode=original`; the name means
original bytes of the delivery file, which may itself be a prepared derivative. Existing explicit
`optimized` references retain compatibility until publication replaces them. Bundled demos and
unmanaged images retain their separate delivery policy; do not disable the adapter globally to
change managed-media delivery.

The narrative-stack gallery classifies orientation from explicit delivery dimensions before bundled
metadata. Landscape chapters span its desktop grid; portrait chapters alternate, and captions remain
visible. This behavior belongs to the canonical variant and does not branch on invitation identity.

Envelope, venue preview, RSVP and portrait-letter surface hooks retain legacy defaults. Profiles can
simplify paper finish, decorative map visibility, section height, ambient color and signature scale
through public component tokens. Hiding a decorative venue preview must preserve independent map
navigation.

The framed-portrait and narrative-stack variants own photographic contours: a portrait arch by
default and softly rounded album corners. The bounded framed-portrait controls above also support
complete rectangular photographs. Native image proportions and full gallery viewer images are
preserved. Quote and countdown expose optional surface-radius tokens with zero-radius defaults;
profiles select the shape without duplicating section DOM styling.
