# Canonical Section Contracts — Celebra-me

This document specifies the purpose, required/optional inputs, data models, rendering behavior,
asset contracts, accessibility, and validation rules for all supported sections in Celebra-me
digital invitations.

---

## 1. Hero (`hero`)

- **Purpose**: Primary entrance fold with celebrant name, event date, venue summary, and full-bleed
  portrait or background image.
- **Required Inputs**: `name` (string), `date` (ISO date string), `backgroundImage` (AssetSource).
- **Optional Inputs**: `secondaryName`, `label`, `nickname`, `backgroundImageDesktop`,
  `backgroundImageMobile`, `portrait`, `focalPoint`, `variant`.
- **Rendering & Omission**: Mandatory first fold. Cannot be omitted.
- **Validation Rules**: `date` must be valid ISO 8601; `backgroundImage` must resolve to an accepted
  image asset.

---

## 2. Envelope (`envelope`)

- **Purpose**: Interactive wax-sealed envelope opening experience for guests.
- **Required Inputs**: `enabled` (boolean), `sealStyle`, `documentLabel`, `stampText`, `stampYear`.
- **Optional Inputs**: `sealIcon`, `sealInitials`, `sealVariant`, `sealColor`, `sealImage`,
  `closedPalette`, `coverEdition`, `revealVariant`.
- **Seal Renderer Model**:
  - `wax-organic` (default for new invitations): Organic melted-wax geometry with shape-conforming
    die relief.
  - `wax-medallion`: Precision circular concentric medallion seal (baseline `main` seal structure).
  - `monogram`: Flat parametric stationery initials ring.
  - `vector-icon`: Flat vector icon badge (`boot`, `heart`, `flower`, `special-edition`).
  - `raster`: Pre-rendered photo/3D asset mask (`sealImage`).
- **Resolution Precedence**: `resolveSealPresentation()` maps configuration in order:
  1. `sealImage` present -> `raster` renderer.
  2. `sealVariant` / `sealIcon` explicit selection -> `wax-organic` or `wax-medallion`.
  3. Existing icon contract -> `wax-monogram` maps to `wax-organic`, `monogram` to `monogram`, etc.
  4. Default fallback -> `wax-organic`.
- **Discrete Fixed-Size Tiers & Container Queries**:
  - Sizing follows `.envelope-container` inline size via progressive `@container` queries:
    - `--env-seal-size-compact: 44px;` (Default / `< 360px` container width)
    - `--env-seal-size-standard: 56px;` (`@container (min-width: 360px)`)
    - `--env-seal-size-large: 68px;` (`@container (min-width: 480px)`)
  - Seal size is constant within each tier. Fluid `clamp()`, `cqw`, or `vw` scaling is forbidden.
- **Closure Anchor Positioning Contract**:
  - Position `.envelope-zone--seal` absolutely at
    `top: 50%; left: 50%; transform: translate(-50%, -50%);` relative to `.envelope-container`.
  - Seal center aligns directly with the 50% flap/pocket fold seam within
    `max(2px, 1% of seal width)` tolerance.
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
- **Optional Inputs**: `visibility`, `presentation`, `indications`, `indicationsHeading`, `mapUrl`,
  `wazeUrl`, `appleMapsUrl`.
- **Rendering & Omission**: Optional section. If omitted, no empty location container is rendered.

---

## 6. Family (`family`)

- **Purpose**: Parents, godparents, honor court, and family members.
- **Required Inputs**: `parents` array (father, mother names) or `sponsors` array.
- **Optional Inputs**: `title`, `subtitle`, `featuredImage`, `variant`.
- **Rendering & Omission**: Optional section.

---

## 7. Gallery (`gallery`)

- **Purpose**: Interactive photo gallery grid / carousel of celebrant photos.
- **Required Inputs**: `items` array of photo asset references with `image` and `alt`.
- **Optional Inputs**: `title`, `subtitle`, `variant`, `aspectRatio`.
- **Rendering & Omission**: Rendered if `items` contains 1 or more resolved photo assets; omitted if
  empty or missing.

---

## 8. Itinerary (`itinerary`)

- **Purpose**: Timeline of event activities (ceremony, reception, dinner, party, toast).
- **Required Inputs**: `items` array with `time`, `title`.
- **Optional Inputs**: `subtitle`, `description`, `icon`, `variant`.
- **Variant Contract**: Use the behavior name `timeline-paper` for the reusable paper program.
  `celestial-blue` is accepted only as a stored-content compatibility alias.
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
- **Required Inputs**: `title` (string), `message` (string).
- **Optional Inputs**: `image`, `variant`, `showThankYouBranding`.
- **Rendering & Omission**: Optional closing fold.

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
