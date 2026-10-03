# Canonical Variant Inputs

**Status:** Active contract

**Runtime owner:** `src/lib/invitation/section-variants.ts`

The repository accepts one canonical section contract. The schema, adapter, render plan, section
descriptors, DOM renderers, and CSS resolver do not normalize legacy inputs or infer a variant from
a theme, profile, slug, or invitation identity. Every stored document in Local, Preview and
Production parses against this contract without a normalizer.

## Removed compatibility inputs

The following are rejected rather than converted:

- `*.structuralVariant` and `sectionStyles.*.structuralVariant`.
- Theme-named section variants such as `celestial-blue` or `editorial-magazine`.
- `gallery.variant=single`.
- `itinerary.presentation.behavior` as a structural selector.
- Omitted `sectionOrder` or `composition` in canonical repository-managed content.

Unknown canonical values and missing prerequisites fail validation with their field paths. The
`full-bleed-photo` Thank You variant requires `thankYou.image`; split and asymmetric family groups
require at least two explicit groups.

## CSS ownership

Every non-default registry entry has an exact independent section stylesheet owner. Defaults use
`section-base:<section>`; no `no-additional-css` owner is valid.
