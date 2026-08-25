# Canonical Invitation Variant System

**Status:** Active architecture contract

**Related:** [`variant-compatibility.md`](variant-compatibility.md), [`variant-cutover-manifest.md`](variant-cutover-manifest.md), [`section-intersections.md`](section-intersections.md), and [`../content/section-contracts.md`](../content/section-contracts.md)

The canonical dependency direction is:

`Invitation source → canonical schema → adapter → render plan → section DOM + isolated CSS`

The executable single source of truth is `src/lib/invitation/section-variants.ts`. Its registry owns
the closed vocabulary, prerequisites, CSS owner, visual-verification status, and persisted-content
transformation for every section variant. The cutover manifest is derived from that registry.

## Boundary and authority

Every repository-managed definition, demo, template, fixture, editor writer, and publication mapper
must declare `sectionOrder`, `composition`, and each section-owned `variant` that it writes. The
canonical schema validates the complete content object before adaptation. Unknown variants, legacy
aliases, missing required data, and incompatible discriminated inputs fail with explicit errors.

Canonical selection must never read `theme.preset`, invitation slug, client or person name,
`visualProfileId`, `_assetSlug`, event-specific identifiers, another invitation's configuration, or
hidden global state. A theme preset supplies visual tokens and bundle selection; it never invents a
section variant.

The runtime path is intentionally linear:

1. `eventContentSchema` parses the canonical object.
2. `adaptEvent` exposes typed section view-models without normalization or compatibility merging.
3. `buildInvitationRenderPlan` follows the explicit `sectionOrder` and `composition`.
4. `buildInvitationSectionRenderDescriptors` passes the section-owned variant to the renderer.
5. Section roots emit `data-variant={variant}` and isolated CSS is resolved from the canonical registry.

There is no runtime variant normalizer, legacy alias registry, identity-specific variant branch, or
silent compatibility fallback in this path. Persisted legacy content may be inspected by migration
and audit tooling, but deployment remains blocked until the separately authorized environment
migration is applied and verified.

## Canonical inventory

- **Hero:** `standard`, `editorial-cover`, `split-cover`.
- **Family:** `standard`, `split-groups`, `asymmetric-groups`; both non-default group layouts require
  at least two explicit `groups`.
- **Location:** `standard`, `split-map`, `stacked-venue-plates`; prerequisites are enforced by the
  owning schema.
- **Gallery:** `uniform-grid`, `editorial-mosaic`, `magazine-spread`, `feature-mosaic`,
  `feature-stack`, `paired-feature-band`, `index-choreography`, `single-keepsake`.
  `single-keepsake` requires exactly one item; feature layouts enforce their item requirements.
- **Itinerary:** `standard`, `timeline-paper`, `editorial-ledger`, `editorial-program`.
- **Gifts:** `standard`, `editorial-catalog`.
- **RSVP:** `standard`, `editorial-press-pass`, `formal-register`.
- **Personalized Access:** `standard`, `ornamented`, `editorial-pass`, `formal-pass`.
- **Thank You:** `standard`, `editorial-back-cover`, `full-bleed-photo`; `full-bleed-photo` requires
  `thankYou.image`.
- **Countdown:** `standard`, `editorial-folio`, `magazine-folio`, `jeweled-panel`, `rose-ornament`,
  `hacienda-ornament`.

Header, Quote, MusicPlayer, and Footer emit `standard` where applicable. Interlude emits a fixed
`standard` DOM marker and accepts no variant input. Envelope/reveal is a theme design selector and
remains independent from section variants.

## Data and configuration

Structural choices live on the owning section object as `variant`. `sectionStyles`,
`structuralVariant`, `visualVariant`, theme-named section values, `gallery.variant=single`, and
`itinerary.presentation.behavior` are not canonical input and are rejected by the canonical schema.
Presentation capabilities such as location flourishes and gallery browsing remain explicit typed
fields on their owning section.

Cross-section composition is selected only by typed `composition.intersections`. Missing intersection
entries use the neutral composition contract; omitted `composition` itself is not accepted by the
canonical schema.

## SCSS ownership and isolation

Semantic variant entrypoints live at `src/styles/themes/sections/<section>/_<semantic-variant>.scss`
when the registry assigns a section stylesheet. The registry may assign a shared theme bundle when
that bundle owns the geometry. A variant may instead declare `no-additional-css` when its renderer
and shared section base already own the complete presentation; that declaration is explicit and is
not a runtime fallback. The section CSS resolver derives its maps from the canonical registry and
never from invitation identity.

Theme presets may supply palette, typography, crop, decoration, motion timing, and documented custom
properties under `.theme-preset--*`. Invitation profiles may add local visual treatment, but neither
profiles nor presets may make a canonical variant meaningful only for one invitation.

## Promotion and validation gates

Before adding or promoting a variant:

1. Add its closed schema/type contract and registry entry.
2. Encode incompatible-input and prerequisite failures.
3. Verify adapter, render-plan, descriptor, DOM marker, and CSS ownership together.
4. Provide a compatible non-origin fixture and a fail-closed incompatible case.
5. Scan reusable code and CSS for client, slug, profile, historical-theme, and invitation-asset dependencies.
6. Update the derived cutover manifest and run focused schema, portability, CSS, governance, and corpus checks.
