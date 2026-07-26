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
- **Required Inputs**: `enabled` (boolean), `sealStyle`, `sealIcon`, `documentLabel`, `stampText`,
  `stampYear`.
- **Optional Inputs**: `sealInitials`, `sealVariant`, `sealImage`, `closedPalette`, `coverEdition`,
  `revealVariant`.
- **Seal icon variants**: `monogram` (flat initials ring), `wax-monogram` (embossed parametric wax
  SVG), plus glyph seals (`boot`, `heart`, `flower`, `special-edition`). Raster
  `sealVariant: premium-rose` + `sealImage` remains available for art-directed fixed seals.
- **Rendering & Omission**: If `enabled: false` or omitted, invitation opens directly on Hero fold
  without envelope animation.

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
- **Rendering & Omission**: Optional section.

---

## 9. RSVP (`rsvp`)

- **Purpose**: Guest attendance confirmation form, attendee count selector, dietary notes, and
  WhatsApp/API submission.
- **Required Inputs**: `confirmationMode` (`api` | `whatsapp`), `deadlineIso`, `guestCap`.
- **Optional Inputs**: `title`, `subtitle`, `whatsappConfig`, `personalizedAccess`.
- **Rendering & Omission**: Mandatory for invitations requiring RSVP confirmation.

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
