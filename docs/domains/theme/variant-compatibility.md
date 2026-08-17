# Variant Compatibility Inventory

**Status:** Documentation-only register of remaining input-normalization behaviors

**Runtime owner:** `src/lib/invitation/variant-normalization.ts`

This inventory documents what the single input normalizer still accepts or strips. It is not a
second variant system and is not mirrored by a TypeScript alias array. Canonical schemas, adapters,
descriptors, renderers, CSS, and shared primitives consume only the normalized section contracts in
[`variant-system.md`](variant-system.md).

## Still accepted (input → canonical)

- **`*.structuralVariant` / `sectionStyles.*.structuralVariant`**
  - **Canonical target:** owning section `variant`
  - **Behavior:** merged via dual-path resolve; then deleted from normalized output
  - **Retire when:** repository and persisted corpus write only `variant`
- **`gallery.variant=single`**
  - **Canonical target:** `gallery.variant=single-keepsake`
  - **Retire when:** zero `single` aliases remain in corpus and persisted content
- **`itinerary.presentation.behavior`**
  - **Canonical target:** `itinerary.variant`
  - **Retire when:** all payloads carry `itinerary.variant`
- **`visualProfileId` intersection profile table**
  - **Canonical target:** `composition.intersections`
  - **Behavior:** only when `composition` is omitted; managed definitions must author intersections
    explicitly
  - **Retire when:** all persisted managed rows carry `composition.intersections`
- **`sectionStyles.{quote,footer,…}.variant=<theme preset>`**
  - **Canonical target:** strip; section `data-variant=standard`; atmosphere via `.theme-preset--*`
  - **Retire when:** writers stop emitting theme-named style variants

## Removed (no theme→variant remapping)

Theme preset names are **never** used to invent section variants. Omitted or theme-named inputs
default as follows; non-default looks require an explicit canonical `variant`:

| Section | Default when omitted / theme-named | Author explicitly when needed |
| --- | --- | --- |
| Gallery | `uniform-grid` | layout ids (`editorial-mosaic`, `magazine-spread`, …) |
| Countdown | `standard` | `editorial-folio`, `magazine-folio`, `jeweled-panel`, … |
| Hero | `standard` | `editorial-cover`, `split-cover` |
| Gifts | `standard` | `editorial-catalog` |
| RSVP | `standard` | `editorial-press-pass`, `formal-register` |
| Personalized Access | `standard` | `editorial-pass`, `formal-pass`, `ornamented` |
| Thank You | `standard` | `editorial-back-cover`, `full-bleed-photo` |

Formerly removed alias registers (no longer in code):

- `gallery.variant=<theme preset>`
- `sectionStyles.countdown.variant=<theme preset>`
- `theme.preset=editorial-magazine` implied structural variants (hero/gifts/rsvp/thankYou)
- TypeScript alias inventory array (documentation is the SSOT for remaining input behaviors)

Unknown non-theme canonical values are deliberately preserved so the schema rejects them instead of
silently converting them.

## Removal evidence

Before retiring a remaining dual-path or the intersection profile table, search managed definitions,
local render corpus, demos, templates, intake/editor schemas, draft/publication mappers, adapters,
renderers, styles, fixtures, tests, and active documentation. A repository-only zero count is
insufficient when persisted content is a known consumer.
