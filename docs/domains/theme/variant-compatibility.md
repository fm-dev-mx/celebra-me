# Canonical Variant Cutover

**Status:** Code-complete; deployment blocked

**Runtime owner:** `src/lib/invitation/section-variants.ts`

The repository now accepts one canonical section contract. The schema, adapter, render plan,
section descriptors, DOM renderers, and CSS resolver do not normalize legacy inputs or infer a
variant from a theme, profile, slug, or invitation identity.

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

## Cutover scope

The 29 non-default registry entries, their prerequisites, CSS owners, unresolved Goal 2 visual
verification, and required persisted-content transformations are listed in the
[single cutover manifest](variant-cutover-manifest.md). The manifest is generated from
`CANONICAL_VARIANT_CUTOVER_MANIFEST`; it is not a second runtime registry.

Every non-default entry has an independent section stylesheet owner or the explicit
`no-additional-css` declaration. The latter currently applies to `personalizedAccess.ornamented`:
the renderer emits its ornaments and the shared personalized-access base owns their geometry, so no
additional variant sheet is required.

Repository-owned definitions, demos, templates, local render fixtures, and writer tests now author
the canonical fields directly. The local non-origin corpus includes compatible fixtures for the
previously uncovered `gallery.editorial-mosaic`, `thankYou.editorial-back-cover`,
`thankYou.full-bleed-photo`, and five countdown skins.

## Deployment boundary

**Deployment blocked.** This goal changes code, schemas, fixtures, tests, and documentation only.
No Preview or Production content is modified or exposed. A separately authorized environment
migration must apply each persisted-content transformation from the manifest, verify the resulting
content against the canonical schema, and complete the Goal 2 visual verification before deployment.
