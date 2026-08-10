# Canonical Variant System

**Last Updated:** 2026-08-10

**Related:** [`architecture.md`](architecture.md), [`gallery-variants.md`](gallery-variants.md),
[`../content/section-contracts.md`](../content/section-contracts.md)

This is the post-Goal-4 inventory of supported invitation variation. It separates structural
renderer selection from presentation options and visual skins. A missing structural variant is
intentional: the section uses its shared implementation.

## Ownership and precedence

- Structural choices are owned by the section contract and are emitted as `data-structural-variant`
  when explicitly configured. They must not be selected from `theme.preset`, invitation slug, or
  `visualProfileId` in canonical content.
- Presentation options change media, behavior, or emphasis without selecting a renderer. They are
  validated by the owning section schema.
- Skins and modifiers consume theme or invitation tokens. They may change color, typography,
  imagery, decoration, motion timing, or copy, but must not replace a canonical structural grid or
  renderer.
- Legacy theme-named inputs remain only at documented adapter/schema boundaries. Explicit canonical
  values take precedence; removal requires a repository-wide zero-dependency check.

## Final inventory

The inventory uses one record per section so each contract remains readable without horizontal
scrolling.

- **Hero**
  - **Canonical structural owner:** `hero.structuralVariant`: `standard`, `editorial-cover`,
    `split-cover` → `Hero.astro` (+ `EditorialMagazineHero.astro` for cover)
  - **Presentation / skin:** `portraitEnabled`; `hero.variant`; focal tokens; split plane/overlay
    tokens (`--hero-split-*`)
  - **Fallback / exception / evidence:** Theme fallback only (`editorial-magazine` → cover).
    `split-cover` requires explicit selection (no theme fallback). Origins: Romina Ríos. Tests:
    `structural-variants`, `section-css-resolver-map`.
- **Thank You**
  - **Canonical structural owner:** `sectionStyles.thankYou.structuralVariant`: `standard`,
    `editorial-back-cover`, `full-bleed-photo` → `ThankYou.astro`
  - **Presentation / skin:** `sectionStyles.thankYou.variant`
  - **Fallback / exception / evidence:** Sacred/editorial theme fallbacks remain. Tests:
    `structural-variants`, Victoria payload.
- **Gifts**
  - **Canonical structural owner:** `sectionStyles.gifts.structuralVariant`: `standard`,
    `editorial-catalog` → `Gifts.astro`
  - **Presentation / skin:** `gifts.presentation`: `catalog` (default) / `legend-only`;
    `sectionStyles.gifts.variant`
  - **Fallback / exception / evidence:** Absent presentation → catalog. `legend-only` omits the item
    grid and must not carry catalog items; section omission remains distinct (no `gifts` block).
    Origin: Alba Rosa. Tests: `presentation-options-goal-c`, Alba payload.
- **RSVP**
  - **Canonical structural owner:** `sectionStyles.rsvp.structuralVariant`: `standard`,
    `editorial-press-pass` → RSVP components
  - **Presentation / skin:** State/access and labels are interaction/skin contracts
  - **Fallback / exception / evidence:** Editorial theme fallback remains. Tests:
    `structural-variants` and RSVP suites.
- **Personalized Access**
  - **Canonical structural owner:** `rsvp.personalizedAccess.structuralVariant`: `standard`,
    `ornamented`, `editorial-pass` → `PersonalizedAccess.astro`
  - **Presentation / skin:** Parent RSVP skin and invitation tokens
  - **Fallback / exception / evidence:** Theme fallback remains. Tests: `structural-variants`, CSS
    resolver map.
- **Gallery layout**
  - **Canonical structural owner:** `gallery.variant` → `Gallery.astro` / `PhotoGallery.astro`
  - **Presentation / skin:** `gallery.presentation`, `gallery.presentationOptions.mobileBrowse`
    (`stack` default / `rail`), item roles, `visualVariant`, focal/caption tokens
  - **Fallback / exception / evidence:** `rail` is orthogonal to `magazine-spread` (desktop grid
    unchanged; mobile scroll-snap). Aliases; Abril and wedding exceptions. Origin: Valentina. Tests:
    SV/CSS/Abril/Victoria, `presentation-options-goal-c`.
- **Itinerary**
  - **Canonical structural owner:** `itinerary.presentation.behavior`: `standard`, `timeline-paper`
    → `Itinerary.astro`
  - **Presentation / skin:** Theme tokens and behavior tokens
  - **Fallback / exception / evidence:** Legacy `sectionStyles.itinerary.variant`; `celestial-blue`
    aliases paper. Tests: itinerary adapter, Abril content.
- **Location**
  - **Canonical structural owner:** `location.structuralVariant`: `standard`, `split-map` →
    `EventLocation.astro` / `VenueCard.astro`
  - **Presentation / skin:** `location.presentation` (`simple`, `with-map`, `with-photo`) and
    `presentationOptions.showNavigationButtons` / `showFlourishes`; map materiality/button chrome
    remain skins. Linked map-preview surfaces when `mediaMode=none` and
    `showNavigationButtons=false` (Daniela) — not a separate presentation enum.
  - **Fallback / exception / evidence:** Invalid/omitted structural → `standard`. Legacy section
    flags fold one-way; canonical options win. Origins: Alba Rosa (`split-map`); Daniela map preview
    reuses existing presentation options. Tests: `structural-variants`, `section-css-resolver-map`,
    venue contract, Daniela payload.
- **Family**
  - **Canonical structural owner:** `family.structuralVariant`: `standard`, `split-groups` →
    `Family.astro`
  - **Presentation / skin:** `family.presentation`: `with-photo` / `text-only`; divider/type tokens
    (`--family-split-*`)
  - **Fallback / exception / evidence:** Invalid/omitted → `standard`. Absent presentation follows
    media availability. Origins/pilot: Daniela y Martín; Victoria y Roberto. Tests:
    `structural-variants`, `section-css-resolver-map`, presentation contract and draft mappers.
- **Gallery item roles**
  - **Canonical structural owner:** Shared item renderer; `feature`, `wide`, `standard`
  - **Presentation / skin:** Focal/image treatment; `pet-keepsake` presentation
  - **Fallback / exception / evidence:** Incompatible role/presentation combinations are
    schema-rejected. Tests: presentation/editor schema.
- **Envelope seal**
  - **Canonical structural owner:** `resolveSealPresentation`: five renderer types → reveal renderer
  - **Presentation / skin:** `sealColor` / `sealVariant`
  - **Fallback / exception / evidence:** `wax-monogram` aliases organic wax; style/icon aliases
    remain. Tests: reveal-card contract.
- **Quote, Countdown, Footer, Interludes**
  - **Canonical structural owner:** Shared implementations; no independent structural variant
  - **Presentation / skin:** Countdown `presentationOptions.visibleUnits` (default all four units;
    empty selection rejected). Theme/preset skins plus motion/intersection modifiers.
  - **Fallback / exception / evidence:** Theme names are visual compatibility only. Countdown
    days-only origin: Alba Rosa. Tests: style-boundary, section suites,
    `presentation-options-goal-c`.

Gallery layout identifiers are `uniform-grid`, `editorial-mosaic`, `magazine-spread`,
`feature-mosaic`, `index-choreography`, and `single-keepsake`.

## Profile boundary

Profiles may provide scoped tokens, typography, color, crop, decorative treatment, and motion
timing. They must not choose a renderer, replace a canonical selector, or supply structural CSS
needed by a canonical variant. The known exceptions are deliberately explicit:

- Abril's `uniform-grid` selector adds a local 2×2 composition and feature crop. It is not promoted
  to a new variant because no second reusable invitation contract currently proves that semantic
  difference.
- Celestial Blue's Gallery profile changes reveal sequencing only.
- Victoria's single-keepsake profile supplies visual tokens; the canonical single-image structure is
  owned by `src/styles/invitation/_gallery.scss`.
- The `jewelry-box-wedding` Gallery storyboard remains a compatibility path until a replacement
  proves equivalent nth-child behavior.

Any new exception must record the invitation, canonical mechanism extended, reason extraction is
unjustified, and the evidence that would trigger reevaluation.

## Required change and retirement checks

Before adding a structural variant, prove that existing variants and tokens cannot express the
requirement. Add the schema/type contract, renderer and CSS delivery, explicit representative
configuration, focused valid/invalid/fallback tests, and documentation together.

Before removing compatibility, search managed definitions, demos, fixtures, tests, schemas,
adapters/resolvers, preview/publishing paths, and operational documentation. A path is removable
only after all of those consumers are zero; otherwise retain it with the exact blocker documented.

The directed validation set is the focused variant/contract suites plus `pnpm run ci`. Cross-theme
browser comparison is reserved for changes that affect renderer selection, structural CSS, layout,
or profile interaction.
