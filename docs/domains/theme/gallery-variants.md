# Gallery Variants

**Status:** Active section contract

**Related:** [`variant-system.md`](variant-system.md),
[`variant-compatibility.md`](variant-compatibility.md), and [`motion.md`](motion.md)

Gallery separates reusable layout from visual skin:

- `gallery.variant` is the required canonical layout authority.
- `gallery.presentation`, `presentationOptions.mobileBrowse`, item order, focal points, captions,
  and item `layoutRole` are orthogonal typed capabilities.

Theme preset, slug, profile identity, and asset identity never select Gallery structure.

## Canonical layouts

- `uniform-grid`: regular multi-item grid; base Gallery CSS owns it.
- `editorial-mosaic`: asymmetrical editorial mosaic.
- `magazine-spread`: numbered feature/wide magazine composition.
- `feature-mosaic`: feature-led twelve-column dense composition.
- `feature-stack`: primary feature column with stacked support cells.
- `paired-feature-band`: portrait pairs with a full-width feature band (`layoutRole=feature`).
- `index-choreography`: index-driven staggered composition.
- `single-keepsake`: one-image keepsake composition; base Gallery CSS owns it; exactly one item.

Semantic structural partials live under `src/styles/themes/sections/gallery/` and are loaded by the
section CSS resolver independently from the active theme bundle. `Gallery.astro` and
`PhotoGallery.astro` always emit the section variant through `data-variant`.

Item `layoutRole` (`feature`, `wide`, or `standard`) may refine placement inside a compatible
layout. The existing presentation validator rejects incompatible item-role combinations. Mobile
`rail` is an explicit browse mode and does not change the layout identifier.

## Input compatibility

Legacy `single`, theme-named values, and `sectionStyles` aliases are rejected by the canonical
schema. Managed definitions, demos, templates, editor drafts, and publication output write the
semantic layout directly. See the deployment-only migration register in
[`variant-compatibility.md`](variant-compatibility.md).

Unknown values fail at the canonical schema boundary; they do not resolve to `uniform-grid` or any
other layout silently.

## Invitation-specific visual treatment

Profiles may tint tokens, crops, decoration, and motion. They may not supply a canonical Gallery
grid required for portability. A new layout needs a semantic name, closed schema value, independent
SCSS delivery, incompatible-input tests, and a non-origin visual proof.

- The `jewelry-box-wedding` nth-child storyboard remains a visual compatibility path. It must not be
  promoted or deleted without a current consumer inventory and parity proof.
- Celestial Blue single-keepsake rules are visual compatibility only; the index choreography lives
  in `_index-choreography.scss`.
