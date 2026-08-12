# Variant Compatibility Inventory

**Status:** Active, input-only compatibility register

**Runtime owner:** `src/lib/invitation/variant-normalization.ts`

This inventory exists to keep legacy acceptance visible and removable. It is not a second variant
system. Canonical schemas, adapters, descriptors, renderers, CSS, and shared primitives consume only
the normalized section contracts described in [`variant-system.md`](variant-system.md).

## Supported aliases

- **Legacy:** `hero.structuralVariant`
  - **Canonical target:** `hero.variant`
  - **Known consumers:** persisted published content and legacy fixtures
  - **Retire when:** the repository and persisted corpus use `hero.variant`
- **Legacy:** `sectionStyles.*.structuralVariant`
  - **Canonical target:** `owning section.variant`
  - **Known consumers:** persisted published content and legacy fixtures
  - **Retire when:** managed and persisted content use section-owned variants
- **Legacy:** `gallery.variant=single`
  - **Canonical target:** `gallery.variant=single-keepsake`
  - **Known consumers:** persisted legacy gallery content
  - **Retire when:** the repository and persisted corpus have zero `single` aliases
- **Legacy:** `gallery.variant=<theme preset>`
  - **Canonical target:** `matching semantic gallery layout + gallery.visualVariant=<theme preset>`
  - **Known consumers:** legacy Gallery fixtures
  - **Retire when:** the repository and persisted corpus separate Gallery layout and skin
- **Legacy:** `gifts.variant=<theme preset>`
  - **Canonical target:** `gifts.variant=standard or editorial-catalog`
  - **Known consumers:** persisted published content and legacy Gifts fixtures
  - **Retire when:** the repository and persisted corpus use a semantic Gifts variant
- **Legacy:** `itinerary.presentation.behavior`
  - **Canonical target:** `itinerary.variant`
  - **Known consumers:** persisted published content and legacy fixtures
  - **Retire when:** all persisted and fixture content carries `itinerary.variant`
- **Legacy:** `theme.preset=editorial-magazine with omitted structural variant`
  - **Canonical target:** explicit editorial section variants
  - **Known consumers:** legacy editorial-magazine payloads
  - **Retire when:** all persisted editorial-magazine payloads carry explicit variants
- **Legacy:** `visualProfileId intersection profile`
  - **Canonical target:** `composition.intersections`
  - **Known consumers:** persisted managed rows pending canonical promotion
  - **Retire when:** all persisted managed rows carry explicit `composition.intersections`

Every alias above is normalized by the same pure input function. Canonical producers must not write
these fields. Unknown canonical values are deliberately preserved by normalization so the schema
rejects them instead of converting them to a default.

The identity-keyed intersection table is retained only to read already-persisted content. Managed
repository definitions author `composition.intersections` explicitly, and the render plan never
reads `visualProfileId`.

## Removal evidence

Immediately before removing an alias, search managed definitions, the local render corpus, demos,
templates, intake/editor schemas, draft/publication mappers, adapters, renderers, styles, fixtures,
tests, and active documentation. Record the search and affected smoke result with the change. A
repository-only zero count is insufficient when persisted content is a known consumer.
