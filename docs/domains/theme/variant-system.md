# Canonical Invitation Variant System

**Status:** Active architecture contract

**Related:** [`variant-compatibility.md`](variant-compatibility.md),
[`gallery-variants.md`](gallery-variants.md),
[`section-intersections.md`](section-intersections.md), and
[`../content/section-contracts.md`](../content/section-contracts.md)

The canonical dependency direction is:

`Invitation configuration → section-owned typed variant → renderer + isolated variant SCSS → shared primitives`

Historical origin is evidence, never architectural identity. A reusable artifact may be developed
while building a client invitation, but its identifier, code, stylesheet, data contract, and assets
must remain independent of that client.

## Boundary and authority

Each participating section owns a closed `section.variant` vocabulary in its schema. Canonical
content must select that value explicitly. The schema validates the selection before the adapter,
the adapter exposes a typed section view-model, the render descriptor propagates it, and the section
emits `data-structural-variant` when the value affects structure or renderer behavior.

Canonical selection must never read `theme.preset`, invitation slug, client or person name,
`visualProfileId`, `_assetSlug`, event-specific identifiers, another invitation's configuration, or
hidden global state. Unknown variants and variants missing their required data fail schema
validation; they do not fall back silently.

Legacy inputs are normalized once by `src/lib/invitation/variant-normalization.ts`, before the
canonical schema/adapter contract. The supported aliases, known consumers, and retirement conditions
are maintained in [`variant-compatibility.md`](variant-compatibility.md). Renderers, descriptors,
canonical CSS, and shared primitives must contain no compatibility branches.

## Canonical inventory

- **Hero:** `standard`, `editorial-cover`, `split-cover`.
  - `editorial-cover` owns its specialized renderer and semantic stylesheet.
  - `split-cover` uses the shared Hero DOM and owns all required responsive plane/title geometry in
    `_split-cover.scss`.
  - `hero.visualVariant` is an independent visual skin.
- **Family:** `standard`, `split-groups`, `asymmetric-groups`.
  - `split-groups` and `asymmetric-groups` require at least two explicit `groups` through a
    discriminated schema contract.
  - `split-groups` mirrors parallel groups; `asymmetric-groups` is left-read with staggered groups
    and optional right-set spanning godparents.
- **Location:** `standard`, `split-map`, `stacked-venue-plates`.
  - `split-map` requires at least one visible venue with coordinates or image media.
  - `stacked-venue-plates` requires at least two visible venues and owns twin plate-chapter
    geometry.
  - Map/navigation media and presentation flags remain explicit section capabilities.
- **Gallery:** `uniform-grid`, `editorial-mosaic`, `magazine-spread`, `feature-mosaic`,
  `feature-stack`, `paired-feature-band`, `index-choreography`, `single-keepsake`.
  - `gallery.variant` owns layout; `gallery.visualVariant` owns skin.
  - `single-keepsake` requires exactly one item; `feature-stack` requires ≥3 items;
    `paired-feature-band` requires ≥3 items and at least one `layoutRole=feature`.
  - Item roles and `presentationOptions.mobileBrowse` remain orthogonal typed capabilities.
- **Itinerary:** `standard`, `timeline-paper`, `editorial-ledger`, `editorial-program`.
  - The value selects the renderer path and is emitted as `data-structural-variant`.
  - `timeline-paper` uses `ItineraryProgram`; `editorial-ledger`, `editorial-program`, and `standard`
    use `TimelineList`.
  - `_timeline-paper.scss`, `_editorial-ledger.scss`, and `_editorial-program.scss` are delivered
    independently from theme and profile bundles. `editorial-program` owns the numbered magazine
    program layout, type metrics, and section-scoped chroma.
- **Gifts:** `standard`, `editorial-catalog`.
- **RSVP:** `standard`, `editorial-press-pass`.
- **Personalized Access:** `standard`, `ornamented`, `editorial-pass`.
- **Thank You:** `standard`, `editorial-back-cover`, `full-bleed-photo`.
- **Envelope / reveal:** `envelope.variant` is a `THEME_PRESETS` design selector. It is independent
  of `themeId`. When omitted, resolution falls back to the invitation `theme.preset`.
  `premiere-floral` owns reveal-scoped stationery tokens, typography, and the selectable monogram
  seal treatment. Shared envelope DOM, geometry, and animation stay in `_envelope-reveal.scss`.
  Isolated CSS delivery loads `_premiere-floral.scss` only when the selected envelope variant
  differs from the host theme bundle.

Sections without a structural choice use their shared renderer and do not receive a synthetic
variant abstraction merely for symmetry.

## Data and configuration compatibility

Canonical managed definitions, demos, templates, editor drafts, and publication mappers write
`section.variant` directly. Structural choices no longer live under `sectionStyles`, and Itinerary
behavior no longer lives under `presentation`. Gallery layout and visual skin are separate fields.

When variant-specific requirements differ, the owning schema represents them as a discriminated
contract or a typed compatibility refinement. A variant may consume only its section view-model and
documented capabilities. Cross-section composition is not variant data.

## SCSS ownership and isolation

Semantic variant entrypoints live at
`src/styles/themes/sections/<section>/_<semantic-variant>.scss`. They own the DOM geometry, order,
responsive breakpoints, and visibility required for that variant. The section CSS resolver loads
these entrypoints independently from the active theme bundle.

Theme bundles and invitation profiles may supply palette, typography, crop, decoration, motion
timing, and documented custom-property values. They may not import a canonical structural partial,
redeclare its grid/order/required breakpoint, hide required elements, or make the canonical variant
meaningful only under a particular profile.

## Assets and shared primitives

Invitation photographs and client artwork remain invitation-owned and are referenced through typed
semantic asset keys. A reusable variant receives resolved assets only through its explicit section
contract; it never imports from another invitation's asset directory. Variant-owned decorative
assets are permitted only when they are generic, stored with the variant/shared primitive, and
documented as part of that reusable contract.

Shared primitives may expose generic capabilities such as map rendering, responsive images, icons,
and formatting. They must not branch on invitation identity. A variant may depend on a primitive; a
primitive must not depend on a variant or invitation.

## Composition and invitation-specific customization

Section intersections are selected by typed `composition.intersections` configuration. Render-plan
targets and source relationships are validated by `composition-contract.ts`; the absence of an entry
is the neutral default. Identity-based intersection maps are compatibility input only and cannot be
read by the render plan.

Invitation-specific configuration may choose canonical variants, content, assets, ordering,
intersection cadence, and visual tokens. Invitation profile SCSS may add genuinely local visual
treatment within the profile boundary. A one-off composition is not promoted until it has a portable
semantic contract and a second independent use or equally strong reuse evidence.

## Promotion and validation gates

Before adding or promoting a variant:

1. Prove existing variants and permitted tokens cannot express the requirement.
2. Choose a semantic design/structure/behavior name with no theme, client, invitation, or slug
   identity.
3. Add the closed schema/type contract, incompatible-input failure, adapter/descriptor propagation,
   DOM marker or renderer selection, and isolated SCSS delivery together.
4. Prove the variant with a non-origin fixture that has no originating profile or assets.
5. Scan reusable code and CSS for client, slug, historical-theme, profile, and invitation-asset
   dependencies.
6. Run focused schema, normalization, adapter, descriptor, CSS, governance, portability, affected
   corpus, and browser checks; then run repository CI.

Compatibility or identity-specific code may be deleted only after a fresh zero-consumer search
across managed definitions, persisted-input assumptions, demos, templates, editor/publication paths,
renderers, styles, tests, and documentation.
