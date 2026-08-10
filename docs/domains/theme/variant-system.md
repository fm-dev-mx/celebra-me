# Canonical Variant System

**Last Updated:** 2026-08-10

**Related:** [`architecture.md`](architecture.md), [`gallery-variants.md`](gallery-variants.md),
[`../content/section-contracts.md`](../content/section-contracts.md)

The current parity and ownership evidence is recorded in
[`render-parity-ownership-audit-2026-08-10.md`](../../archive/reports/render-parity-ownership-audit-2026-08-10.md).
That report is diagnostic: its confirmed compatibility findings are not runtime fixes.

This is the post-Goal-4 inventory of supported invitation variation. It separates structural
renderer selection from presentation options and visual skins. A missing structural variant is
intentional: the section uses its shared implementation.

## Ownership and precedence

- Structural choices are owned by the section contract and are emitted as `data-structural-variant`
  (Gallery always emits the resolved layout ID). They must not be selected from `theme.preset`,
  invitation slug, or `visualProfileId` in canonical content.
- Presentation options change media, behavior, or emphasis without selecting a renderer. They are
  validated by the owning section schema.
- Skins and modifiers consume theme or invitation tokens. They may change color, typography,
  imagery, decoration, motion timing, or copy, but must not replace a canonical structural grid or
  renderer.
- Theme structural fallbacks are retired: omitted or invalid structural selectors resolve to the
  section default (`standard`, or Gallery `uniform-grid`). Legacy theme-named gallery inputs remain
  only as compatibility aliases for layout ID resolution / visual skin; they do not imply structure
  from `theme.preset` alone.
- Canonical structural resolvers and section renderers must not branch on invitation slug,
  `eventType`, or `visualProfileId`. Identity-based behavior belongs in a named compatibility or
  profile boundary with an active consumer and a removal condition.

## Final inventory

The inventory uses one record per section so each contract remains readable without horizontal
scrolling.

- **Hero**
  - **Canonical structural owner:** `hero.structuralVariant`: `standard`, `editorial-cover`,
    `split-cover` → `Hero.astro` (+ `EditorialMagazineHero.astro` for cover)
  - **Presentation / skin:** `portraitEnabled`; `hero.variant`; focal tokens; split plane/overlay
    tokens (`--hero-split-*`)
  - **Fallback / exception / evidence:** Invalid/omitted → `standard` (no theme fallback). Explicit
    selection required for `editorial-cover` and `split-cover`. Origins: Valentina / editorial demos
    (cover); Romina Ríos (`split-cover`). Tests: `structural-variants`,
    `structural-variant-portability`, `section-css-resolver-map`.
- **Thank You**
  - **Canonical structural owner:** `sectionStyles.thankYou.structuralVariant`: `standard`,
    `editorial-back-cover`, `full-bleed-photo` → `ThankYou.astro`
  - **Presentation / skin:** `sectionStyles.thankYou.variant`
  - **Fallback / exception / evidence:** Invalid/omitted → `standard` (no theme fallback). Tests:
    `structural-variants`, Victoria payload.
- **Gifts**
  - **Canonical structural owner:** `sectionStyles.gifts.structuralVariant`: `standard`,
    `editorial-catalog` → `Gifts.astro`
  - **Presentation / skin:** `gifts.presentation`: `catalog` (default) / `legend-only`;
    `sectionStyles.gifts.variant`
  - **Fallback / exception / evidence:** Invalid/omitted structural → `standard`. Absent
    presentation → catalog. `legend-only` omits the item grid and must not carry catalog items;
    section omission remains distinct (no `gifts` block). Origin: Alba Rosa (presentation);
    editorial demos (`editorial-catalog`). Tests: `presentation-options-goal-c`,
    `structural-variant-portability`, Alba payload.
- **RSVP**
  - **Canonical structural owner:** `sectionStyles.rsvp.structuralVariant`: `standard`,
    `editorial-press-pass` → RSVP components
  - **Presentation / skin:** State/access and labels are interaction/skin contracts
  - **Fallback / exception / evidence:** Invalid/omitted → `standard` (no theme fallback). Tests:
    `structural-variants`, `structural-variant-portability`, RSVP suites.
- **Personalized Access**
  - **Canonical structural owner:** `rsvp.personalizedAccess.structuralVariant`: `standard`,
    `ornamented`, `editorial-pass` → `PersonalizedAccess.astro`
  - **Presentation / skin:** Parent RSVP skin and invitation tokens
  - **Fallback / exception / evidence:** Invalid/omitted → `standard` (no theme fallback). Tests:
    `structural-variants`, `structural-variant-portability`, CSS resolver map.
- **Gallery layout**
  - **Canonical structural owner:** `gallery.variant` → `Gallery.astro` / `PhotoGallery.astro`
  - **Presentation / skin:** `gallery.presentation`, `gallery.presentationOptions.mobileBrowse`
    (`stack` default / `rail`), item roles, `visualVariant`, focal/caption tokens
  - **Fallback / exception / evidence:** Invalid/omitted → `uniform-grid`. Renderer always emits
    `data-structural-variant` for the resolved layout ID. `rail` is orthogonal to `magazine-spread`.
    Retained exceptions: Abril 2×2 profile composition; `jewelry-box-wedding` nth-child storyboard.
    Tests: SV/CSS/Abril/Victoria, `structural-variant-portability`, `presentation-options-goal-c`.
- **Itinerary**
  - **Canonical structural owner:** `itinerary.presentation.behavior`: `standard`, `timeline-paper`
    → `Itinerary.astro`
  - **Presentation / skin:** Theme tokens and behavior tokens
  - **Fallback / exception / evidence:** Authority is `presentation.behavior` only. Omitted →
    `standard`. Theme-name fallback and the `celestial-blue` → `timeline-paper` alias are retired.
    Tests: itinerary adapter, Abril / Ana Sofía corpus, `structural-variant-portability`.
- **Location**
  - **Canonical structural owner:** `location.structuralVariant`: `standard`, `split-map` →
    `EventLocation.astro` / `VenueCard.astro`
  - **Presentation / skin:** `location.presentation` (`simple`, `with-map`, `with-photo`) and
    `presentationOptions.showNavigationButtons` / `showFlourishes`; map materiality/button chrome
    remain skins. Linked map-preview surfaces when `mediaMode=none` and
    `showNavigationButtons=false` (Daniela) — not a separate presentation enum.
  - **Fallback / exception / evidence:** Invalid/omitted structural → `standard`. Legacy section
    flags fold one-way; canonical options win. Origins: Alba Rosa (`split-map`); Daniela map preview
    reuses existing presentation options. Tests: `structural-variants`,
    `structural-variant-portability`, `section-css-resolver-map`, venue contract, Daniela payload.
- **Family**
  - **Canonical structural owner:** `family.structuralVariant`: `standard`, `split-groups` →
    `Family.astro`
  - **Presentation / skin:** `family.presentation`: `with-photo` / `text-only`; divider/type tokens
    (`--family-split-*`)
  - **Fallback / exception / evidence:** Invalid/omitted → `standard`. Absent presentation follows
    media availability. Origins/pilot: Daniela y Martín; Victoria y Roberto. Tests:
    `structural-variants`, `structural-variant-portability`, `section-css-resolver-map`,
    presentation contract and draft mappers.
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

Managed corpus migrations retired the Luna location-policy identity branch, Leah navigation slug
map, and Xareni seal-token bridge in favor of explicit content / profile ownership. Remaining
profile exceptions (Abril 2×2, jewelry-box-wedding gallery storyboard) are documented below and do
not change the canonical variant inventory.

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

### Parity audit checklist

- [ ] Enumerate managed published, managed `in_progress`, legacy, and representative demo sources
      from their registries; do not use a hand-maintained invitation list.
- [ ] Trace each rendered section from content/config through adapter, render descriptor, renderer
      attribute, and delivered structural/profile CSS.
- [ ] Classify each invitation × section exactly once as `MATCH`, `INTENTIONAL_CHANGE`,
      `KNOWN_DEFECT`, `REGRESSION`, or `INSUFFICIENT_EVIDENCE`.
- [ ] Scan canonical code for slug, event-type, profile-identity, invitation-label, and CSS-token
      knowledge; record legitimate compatibility roots and retirement conditions separately.
