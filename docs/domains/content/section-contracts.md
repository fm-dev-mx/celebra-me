# Canonical Section Contracts — Celebra-me

This document specifies the purpose, required/optional inputs, data models, rendering behavior,
asset contracts, accessibility, and validation rules for all supported sections in Celebra-me
digital invitations.

The complete post-migration ownership matrix for structural variants, presentation options, skins,
compatibility aliases, and profile exceptions is maintained in
[`docs/domains/theme/variant-system.md`](../theme/variant-system.md).

---

## 1. Hero (`hero`)

- **Purpose**: Primary entrance fold with celebrant name, event date, venue summary, and full-bleed
  portrait or background image.
- **Required Inputs**: `name` (string), `date` (ISO date string), `backgroundImage` (AssetSource).
- **Optional Inputs**: `secondaryName`, `label`, `nickname`, `backgroundImageDesktop`,
  `backgroundImageMobile`, `portrait`, `focalPoint`, `variant`, `visualVariant`.
- **Rendering & Omission**: Mandatory first fold. Cannot be omitted.
- **Validation Rules**: `date` must be valid ISO 8601; `backgroundImage` must resolve to an accepted
  image asset.

Structural renderer selections are section-owned and bounded via each section's `variant` field.
Hero accepts `standard`, `editorial-cover`, or `split-cover`; Thank You accepts `standard`,
`editorial-back-cover`, or `full-bleed-photo`; Gifts and RSVP use `editorial-catalog` and
`editorial-press-pass` respectively. `rsvp.personalizedAccess` uses `standard`, `ornamented`, or
`editorial-pass`. These fields select markup/layout only; `visualVariant` / theme preset remains the
visual skin. Legacy `*.structuralVariant` inputs are compatibility-only (see
[`variant-compatibility.md`](../theme/variant-compatibility.md)).

Countdown and Footer have no structural selector in the current contract: their theme branches are
presentation skins only. They continue to consume the visual `variant` and must not be promoted to
structural variants without new executable evidence.

---

## 2. Envelope (`envelope`)

- **Purpose**: Interactive wax-sealed envelope opening experience for guests.
- **Required Inputs**: `enabled` (boolean), `sealStyle`, `documentLabel`, `stampText`, `stampYear`.
- **Optional Inputs**: `variant`, `sealIcon`, `sealInitials`, `sealVariant`, `sealColor`,
  `sealImage`, `closedPalette`, `coverEdition`, `revealVariant`.
- **Reveal variant**: `envelope.variant` selects the reveal design independently of `themeId`.
  Omitted values resolve to the invitation `theme.preset` (backward-compatible). `premiere-floral`
  owns its stationery palette, calligraphy, and monogram seal treatment in
  `src/styles/themes/sections/reveal/_premiere-floral.scss` and is delivered independently when the
  host theme is not `premiere-floral`.
- **Seal Renderer Model**:
  - `wax-organic` (default for new invitations): Organic melted-wax geometry with shape-conforming
    die relief.
  - `wax-medallion`: Precision circular concentric medallion seal (baseline `main` seal structure).
  - `monogram`: Flat parametric stationery initials ring.
  - `vector-icon`: Flat vector icon badge (`boot`, `heart`, `flower`, `special-edition`).
  - `raster`: Pre-rendered photo/3D asset mask (`sealImage`).
- **Resolution Precedence**: `resolveSealPresentation()` maps configuration in order:
  1. `sealImage` present -> `raster` renderer.
  2. `sealColor` is the canonical skin override; `sealVariant` supplies the skin when no color is
     present. `sealIcon` remains the structural renderer selector.
  3. Existing icon contract -> `wax-monogram` maps to `wax-organic`, `monogram` to `monogram`, etc.
  4. Default fallback -> `wax-organic`.
- **Proportional Bounded Sizing**:
  - The visible seal follows the envelope's inline size at `10cqi`, clamped between `40px` and
    `60px`.
  - The fallback is `40px` when container query units are unavailable.
  - The size declaration belongs to a descendant of `.envelope-container`; the container must not
    query itself.
  - The visual diameter is independent from the opening button hit area, which remains at least
    `48px × 48px`.
- **Closure Anchor Positioning Contract**:
  - Position `.envelope-zone--seal` absolutely at
    `top: 50%; left: 50%; transform: translate(-50%, -50%);` relative to `.envelope-container`.
  - Seal center aligns directly with the 50% flap/pocket fold seam within
    `max(2px, 1% of seal width)` tolerance.
- **Structural Invariants**:
  - Envelope opening controls belong exclusively to the reveal container (`EnvelopeReveal`).
  - `InvitationRevealCard` is presentation-only and must never contain opening controls or
    `data-envelope-open` buttons.
  - `showCardAction` is deprecated and removed from schemas and DTO models.
- **Rendering & Omission**: If `disabled: true` or envelope omitted, invitation opens directly on
  Hero fold without envelope animation.

---

## 3. Quote (`quote`)

- **Purpose**: Emotional, spiritual, or inspirational text quote from celebrant or family.
- **Required Inputs**: `text` (string), `author` (string).
- **Optional Inputs**: `subtitle`, `variant`.
- **Rendering & Omission**: Rendered if present in `sections` and `sectionOrder`. Omitted completely
  if undefined.

---

## 4. Countdown (`countdown`)

- **Purpose**: Live countdown timer to event date/time.
- **Required Inputs**: Target timing from `eventTiming` or `hero.date`.
- **Optional Inputs**: `title`, `footerText`, `variant`.
- **Rendering & Omission**: Automatically resolves target date from `eventTiming.startsAtUtc` or
  `hero.date`. Omitted if timing cannot be resolved.

---

## 5. Location (`location`)

- **Purpose**: Ceremony and reception venue names, addresses, interactive map URLs (Google Maps,
  Waze, Apple Maps), and travel indications.
- **Required Inputs**: Venue entries (`venues` array) or legacy `ceremony`/`reception` venues with
  `venueName`, `address`, `city`.
- **Optional Inputs**: `visibility`, `presentation`, `presentationOptions.showFlourishes`,
  `presentationOptions.showNavigationButtons`, `indications`, `indicationsHeading`, `mapUrl`,
  `wazeUrl`, `appleMapsUrl`.
- **Rendering & Omission**: Optional section. If omitted, no empty location container is rendered.

---

## 6. Family (`family`)

- **Purpose**: Parents, godparents, honor court, and family members.
- **Required Inputs**: `parents` array (father, mother names) or `sponsors` array.
- **Optional Inputs**: `title`, `subtitle`, `featuredImage`, `presentation` (`with-photo` or
  `text-only`), `variant`.
- **Rendering & Omission**: Optional section.

---

## 7. Gallery (`gallery`)

- **Purpose**: Interactive photo gallery grid / carousel of celebrant photos.
- **Required Inputs**: `items` array of photo asset references with `image` and `alt`.
- **Optional Inputs**: `title`, `subtitle`, `variant`, `visualVariant`, `presentation`, item
  `layoutRole`, and responsive focal-point fields. Canonical layout values are `uniform-grid`,
  `editorial-mosaic`, `magazine-spread`, `feature-mosaic`, `feature-stack`, `paired-feature-band`,
  `index-choreography`, and `single-keepsake`.
- **Precedence**: `gallery.variant` is the sole post-normalization layout authority. Legacy
  `sectionStyles.gallery.variant` / theme-named values / `single` are compatibility aliases only and
  conflict with a different canonical layout.
- **Rendering & Omission**: Rendered if `items` contains 1 or more resolved photo assets; omitted if
  empty or missing. `single-keepsake` requires exactly one item.

---

## 8. Itinerary (`itinerary`)

- **Purpose**: Timeline of event activities (ceremony, reception, dinner, party, toast).
- **Required Inputs**: `items` array with `time`, `title`.
- **Optional Inputs**: `subtitle`, `description`, `icon`, `variant`.
- **Variant Contract**: Canonical `itinerary.variant` values are `standard`, `timeline-paper`, and
  `editorial-ledger`. `timeline-paper` selects `ItineraryProgram`; `editorial-ledger` and `standard`
  select `TimelineList`. Legacy `itinerary.presentation.behavior` is compatibility-only.
- **Rendering & Omission**: Optional section.

---

## 9. RSVP (`rsvp`)

- **Purpose**: Guest attendance confirmation form, attendee count selector, dietary notes, and
  WhatsApp/API submission.
- **Required Inputs**: `confirmationMode` (`api` | `whatsapp`), `deadlineIso`, `guestCap`.
- **Optional Inputs**: `title`, `subtitle`, `whatsappConfig`, `personalizedAccess`.
- **Rendering & Omission**: Mandatory for invitations requiring RSVP confirmation. A public
  `personalized-only` RSVP without guest context renders a static locked Astro state; demo and
  guest-backed states render the interactive React island.

---

## 10. Gifts (`gifts`)

- **Purpose**: Gift registry information, Mesa de Regalos links (Liverpool, Amazon), or bank account
  / CLABE transfer details.
- **Required Inputs**: `items` array of gift options (`type: 'registry' | 'transfer' | 'cash'`).
- **Optional Inputs**: `title`, `subtitle`, `note`, `variant`.
- **Rendering & Omission**: Optional section. Bank account details must be handled securely without
  raw SQL or log exposure.

---

## 11. Thank You (`thankYou`)

- **Purpose**: Closing gratitude message to guests.
- **Required Inputs**: `message` (string), `closingName` (string).
- **Optional Inputs**: `closingPhrase`, `date` (editorial closing-date display string; not derived
  from `eventTiming`), `image`, `focalPoint`, `overlayAnchor`, `overlaySafeArea`. Section variant
  comes from `sectionStyles.thankYou.variant`, not from the thankYou object.
- **Rendering & Omission**: Optional closing fold. `closingPhrase` is consumed by the invitation
  footer; `date` renders as the Thank You closing-date line when present.
- **Editing**: Managed invitations own `date` / `closingPhrase` / section variant via the provision
  package and `pnpm invitation:release`. The dashboard Agradecimiento card edits message, firma, and
  image only; preview and publish preserve the remaining prior-published fields.

---

## 12. Interludes (`interludes`)

- **Purpose**: Full-bleed background photo dividers between sections.
- **Required Inputs**: `afterSection` (string), `image` (AssetSource).
- **Optional Inputs**: `alt`, `height`, `variant`, `focalPoint`, `overlayOpacity`.

---

## 13. Music (`music`)

- **Purpose**: Background music player for invitation atmosphere.
- **Required Inputs**: `audioUrl` or internal track reference, `title`.
- **Optional Inputs**: `artist`, `autoPlay`, `revealMode`.

---

## 14. Sharing & Metadata (`sharing`)

- **Purpose**: OpenGraph social media preview metadata for WhatsApp, Facebook, Instagram.
- **Required Inputs**: `ogImage`, `ogDescription`, `whatsappTemplate`.
- **Optional Inputs**: `shareMessages`.
