# Canonical Invitation Variant System

**Status:** Active architecture contract

**Related:** [`variant-compatibility.md`](variant-compatibility.md),
[`section-intersections.md`](section-intersections.md), and
[`../content/section-contracts.md`](../content/section-contracts.md)

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
5. Section roots emit `data-variant={variant}` and isolated CSS is resolved from the canonical
   registry.

There is no runtime variant normalizer, legacy alias registry, identity-specific variant branch, or
silent compatibility fallback in this path. Pre-cutover persisted content may be inspected by
migration and audit tooling, but deployment remains blocked until the separately authorized
environment migration is applied and verified.

## Canonical inventory

- **Hero:** `standard`, `editorial-cover`, `split-cover`, `framed-portrait`, `bleed-portrait`,
  `ceremonial-portrait`.
- **Family:** `standard`, `split-groups`, `asymmetric-groups`, `ceremonial-family`; both group
  layouts require at least two explicit `groups`.
- **Location:** `standard`, `split-map`, `stacked-venue-plates`, `program-sheet`; prerequisites are
  enforced by the owning schema.
- **Gallery:** `uniform-grid`, `editorial-mosaic`, `magazine-spread`, `feature-mosaic`,
  `feature-stack`, `paired-feature-band`, `index-choreography`, `single-keepsake`,
  `narrative-stack`, `mirrored-mosaic`, `paired-portraits`. `single-keepsake` requires exactly one
  item; feature layouts enforce their item requirements.
- **Itinerary:** `standard`, `timeline-paper`, `editorial-ledger`, `editorial-program`.
- **Gifts:** `standard`, `editorial-catalog`.
- **RSVP:** `standard`, `editorial-press-pass`, `formal-register`, `reply-card`.
- **Personalized Access:** `standard`, `ornamented`, `editorial-pass`, `formal-pass`, `reply-card`.
- **Thank You:** `standard`, `editorial-back-cover`, `portrait-letter`, `full-bleed-photo`,
  `portrait-keepsake`, `ceremonial-closing`; `full-bleed-photo` requires `thankYou.image`.
- **Countdown:** `standard`, `editorial-folio`, `magazine-folio`, `clock-face`, `written-days`.

Header, Quote, MusicPlayer, and Footer emit `standard` where applicable. Interlude emits a fixed
`standard` DOM marker and accepts no variant input. Envelope/reveal is a theme design selector and
remains independent from section variants.

## Data and configuration

Structural choices live on the owning section object as `variant`. `sectionStyles`,
`structuralVariant`, `visualVariant`, theme-named section values, `gallery.variant=single`, and
`itinerary.presentation.behavior` are not canonical input and are rejected by the canonical schema.
Presentation capabilities such as location flourishes and gallery browsing remain explicit typed
fields on their owning section.

The optional `Gallery` named slot `last-item` replaces, rather than duplicates, the final source
photograph outside the variant mosaic. The caller must render that image and its caption/alt and
provide a separate native `button[data-gallery-item]` for enlargement. `Gallery` owns the single
collection root; `PhotoGallery` owns the existing lightbox opener. Commercial links remain sibling
controls and never open the lightbox. Without the slot, all items follow the normal variant layout.
Public-page composition owns demo opt-in; canonical variants never select commercial content.

Cross-section composition is selected only by typed `composition.intersections`. Missing
intersection entries use the neutral composition contract; omitted `composition` itself is not
accepted by the canonical schema.

## SCSS ownership and isolation

Semantic variant entrypoints live at `src/styles/themes/sections/<section>/_<semantic-variant>.scss`
when the registry assigns a section stylesheet. The registry assigns `section-base:<section>` to
defaults and an exact canonical stylesheet path to every non-default variant. Presets provide
atmosphere tokens only; they never own semantic section geometry. The section CSS resolver derives
its maps from the canonical registry and never from invitation identity.

Theme presets may supply palette, typography, crop, decoration, motion timing, and documented custom
properties under `.theme-preset--*`. Invitation profiles may add local visual treatment, but neither
profiles nor presets may make a canonical variant meaningful only for one invitation.

## Promotion and validation gates

Before adding or promoting a variant:

1. Add its closed schema/type contract and registry entry.
2. Encode incompatible-input and prerequisite failures.
3. Verify adapter, render-plan, descriptor, DOM marker, and CSS ownership together.
4. Provide a compatible non-origin fixture and a fail-closed incompatible case.
5. Scan reusable code and CSS for client, slug, profile, historical-theme, and invitation-asset
   dependencies.
6. Update the derived cutover manifest and run focused schema, portability, CSS, governance, and
   corpus checks.

The `portrait-letter` variant reuses editorial markup with an arched 2:3 portrait and display-font
letter. It requires an image and owns its geometry independently of the preset. Existing published
enchanted-rose styling shares the same SCSS mixin until its consumers explicitly migrate.

The `thankYou` variant `portrait-keepsake` owns the narrow rectangular portrait, serif letter,
responsive grid and signature geometry. It reuses the editorial DOM without selecting by theme or
invitation identity. It requires an explicit image. Managed definitions need canonical publication
before public database-backed routes use this variant.

### Hero venue selection

`hero.presentation.venueIndex` optionally selects a zero-based entry from `location.venues` for the
hero time and venue name, without reordering location cards. Without it, the first visible entry
with the requested value remains the default. Hidden, missing, or protected selected entries must
not expose location details. The same presentation schema is used by published content, drafts, and
the editor so a save cannot discard the selection.

The `framed-portrait` hero displays the complete background image in a paper frame with a separate
name and details. It stacks photograph before copy on mobile and uses two columns on desktop. The
`narrative-stack` gallery preserves image proportions and displays each caption permanently,
alternating desktop columns while retaining image-before-caption reading order. It requires at least
one item, non-empty captions, and no forced item aspect ratios. Both layouts are independent of
invitation profiles.

## Ceremonial stationery variants

- hero.ceremonial-portrait: centered calligraphic lockup, complete rectangular portrait, optional
  typed ornament and accentOrnament assets. The standalone renderer also supports no photograph.
- family.ceremonial-family: centered family groups on continuous paper with restrained filigree.
- countdown.clock-face: decorative dial without clock hands; real countdown values remain text.
- gallery.paired-portraits: exactly two complete photographs, paired on desktop.
- thankYou.ceremonial-closing: compact closing copy and optional decorative image.
- envelope.revealVariant satin-filigree: triangular satin envelope, existing sealImage and optional
  backdropImage; preserves the shared reveal lifecycle.
- envelope.revealVariant seaside-lineart: a shoreline letter. Flat sky field with a fine grain, a
  clean envelope front (name, recipient, pearl wax `shell` seal), one instruction, a wave liner
  shown while the flap opens, and a deckle-edged card with a single shell over a hand-drawn
  shoreline. Keeps the shared card-rise lifecycle. Profiles tune it only through optional
  `--seaside-*` tokens. Proven on the unlisted `demo-xv-seaside`.
- composition.ornaments seaside-lineart: one hand-drawn shoreline (a ribbon of variable weight) at
  four thresholds — quote opening, family close, location close and the closing signature, where a
  shell rests on it. Generic dividers and flourishes are hidden rather than replaced by icons. CSS
  pseudo-elements only; static and never announced. Tuned through `--ornament-*`.
- interludes[].presentation framed: the whole photograph on paper inside a hairline double frame, so
  edge marks (watermarks, handwritten dates) are never cropped. Tuned through
  `--interlude-framed-*`.
- location.presentationOptions.indicationsLayout band: indications as a titled band without per-item
  cards; the first is featured and the rest follow a separator. `--location-band-*`.
- location.presentationOptions.indicationsLayout enclosure: the details card of a suite — one small
  card with an inner hairline, short notes without icons or numbering, and a single color swatch for
  a `reserved` note. `--location-enclosure-*`.
- location.program-sheet: venues as printed-program entries (line drawing for ceremony/reception,
  label, time in words, venue, address, text links of 44 px for map, calendar and copy). No cards
  and no section nav button; two columns with a vertical hairline on wide screens.
  `--location-program-*`.
- hero.bleed-portrait: framed-portrait markup with the photograph to the edges (full width at its
  own proportion on phones, full-height left half on wide screens), written when/where facts and a
  silver scroll line. `--hero-bleed-*`.
- countdown.written-days: one composed fact — small-caps lead, a light display day count with an
  italic "días", and the date in lowercase with old-style numerals; no tiles, the timer updates once
  a minute. `--countdown-written-*`.
- gallery.mirrored-mosaic: contact sheet in blocks of three (principal photograph over two thirds
  plus two stacked), every second block mirrored; square corners, hairline gaps, per-item focal
  points, captions only in the lightbox. Requires three items. `--gallery-mosaic-*`.
- rsvp.reply-card + personalizedAccess.reply-card: a printed reply card split across both sections
  and joined into one surface — seats written out above, then the heading, two 56 px answers in the
  stationery formula ("Con gusto asistiré" / "Lamento no poder asistir"), message and one button; no
  eyebrow or seal. `--reply-card-*`.
- location.presentationOptions.showCalendarLinks: native `<details>` "Agendar en el calendario" per
  venue (Google, .ics data URL, Outlook), resolved from the venue local date/time in
  `eventTiming.timeZone`; works without JavaScript.

These variants carry no client identity or profile dependency. The profile supplies color and
rhythm; human visual acceptance remains separate from structural verification.
