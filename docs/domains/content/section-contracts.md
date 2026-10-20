# Canonical Section Contracts — Celebra-me

This document specifies the purpose, inputs, rendering behavior, and validation rules for every
section of a Celebra-me digital invitation.

The Zod schemas under `src/lib/schemas/content/` are the source of truth; when this document and a
schema disagree, the schema wins. Section variants, their prerequisites and their CSS owners come
from one registry, `src/lib/invitation/section-variants.ts`;
[`variant-system.md`](../theme/variant-system.md) lists them. This document does not repeat variant
lists.

Input terms used below:

- **Required**: the schema rejects the payload without it.
- **Defaulted**: optional on input; the schema fills the stated default.
- **Optional**: may be omitted; nothing is filled in.

Every section object is `.strict()` (unknown keys are rejected) except `envelope`, which is
`.loose()` (unknown keys are preserved). Except `hero`, every section key is optional at the root;
`sectionOrder` decides which sections render (see [Content Schema](../../core/content-schema.md)).

Structural renderer selections are section-owned and bounded via each section's `variant` field
(`rsvp.personalizedAccess.variant` for the access pass). These fields select markup and layout only;
the theme preset remains the visual skin. Legacy aliases are rejected by the canonical schema.
Footer remains a visual theme surface and has no independent section variant.

---

## 1. Hero (`hero`)

- **Purpose**: Primary entrance fold with celebrant name, event date, venue summary, and full-bleed
  portrait or background image.
- **Required Inputs**: `name`, `date` (ISO 8601 datetime), `backgroundImage` (asset), `variant`.
- **Optional Inputs**: `secondaryName`, `label`, `nickname`, `scrollLabel` (≤80), `tagline` (≤160),
  `photoCredit` (≤80), `backgroundImageDesktop`, `backgroundImageMobile`, `portrait`, `ornament`,
  `accentOrnament`, `ambience`, `focalPoint`, `focalPointMobile`, `focalPointTablet`,
  `focalPointDesktop`, `presentation` (`portraitEnabled`, `venueIndex`, `nameLeadWords` 1–4,
  `coverMark`, `coverPage`, `designCredit`).
- **Rendering & Omission**: Mandatory first fold; the only required section. The portrait renders
  only when the theme supports it and `presentation.portraitEnabled` allows it.

---

## 2. Envelope (`envelope`)

- **Purpose**: Interactive wax-sealed envelope (or editorial cover) opening experience for guests.
- **Required Inputs**: none.
- **Defaulted Inputs**: `disabled` (`false`), `sealStyle` (`wax` | `ribbon` | `flower` | `monogram`,
  default `wax`), `microcopy` (`Toca para abrir mi invitación`).
- **Optional Inputs**: `variant` (a theme preset name), `revealVariant`, `sealIcon`, `sealInitials`
  (≤4), `sealColor`, `sealVariant` (`wax-organic` | `wax-medallion` | `premium-rose`), `sealImage`,
  `backdropImage`, `closedPalette` (`primary` / `accent` / `background` color tokens), card and
  guest copy (`cardLabel`, `envelopeName`, `cardName`, `cardSecondaryName`, `cardTagline`,
  `guestLabel`, `guestNameFallback`, `guestPlacement`), `documentLabel`, `stampText`, `stampYear`,
  `tooltipText`, `teaserDetails`, and editorial-cover fields (`coverEdition`, `coverEditionLabel`,
  `coverVolume`, `coverIssue`, `coverLines` 1–2, `coverExperience` `standard` | `collector`,
  `coverOrnament`, `spreadOrnaments` 1–2).
- **Variant precedence**: `envelope.variant` falls back to `theme.preset` when omitted
  (`buildEnvelope` in `src/lib/adapters/event.ts`). `envelope.revealVariant` then decides the
  experience: `editorial-cover` replaces the envelope with the editorial cover reveal;
  `satin-filigree`, `seaside-lineart`, and `storybook-lanterns` are standalone reveal skins that
  replace the preset-driven `data-variant` (`resolveEnvelopeDataVariant` in
  `src/lib/invitation/reveal-card.ts`); `celestial-blue` keeps the preset-driven `data-variant` and
  layers on top of it. See also
  [`invitation-creation-contract.md`](../../core/invitation-creation-contract.md).
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
  - The visible seal follows the envelope's inline size at `10cqi`, clamped between `34px` and
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
  - `showCardAction` is not part of the schema or DTO models.
- **Rendering & Omission**: If `disabled: true` or `envelope` is omitted, the invitation opens
  directly on the Hero fold without envelope animation.

---

## 3. Quote (`quote`)

- **Purpose**: Emotional, spiritual, or inspirational text quote from celebrant or family.
- **Required Inputs**: `text`.
- **Optional Inputs**: `author`.
- **Variant**: none; the schema rejects a `variant` key and the renderer emits the fixed `standard`
  marker.
- **Rendering & Omission**: Rendered when listed in `sectionOrder` and `quote` data exists.

---

## 4. Countdown (`countdown`)

- **Purpose**: Live countdown timer to event date/time.
- **Required Inputs**: `variant`. When `sectionOrder` lists `countdown`, the `countdown` object and
  its `variant` are required (root `superRefine`).
- **Defaulted Inputs**: `title` (`¡Falta muy poco!`), `footerText`
  (`Prepárate para una noche inolvidable`).
- **Optional Inputs**: `ornament`, `presentationOptions.visibleUnits` (1–4 units),
  `presentationOptions.dayUnit`.
- **Rendering & Omission**: Resolves the target from `eventTiming.startsAtUtc` or `hero.date`.

---

## 5. Location (`location`)

- **Purpose**: Ceremony and reception venue names, addresses, map links, and travel indications.
- **Required Inputs**: `variant`, `venues[]`. Each venue requires `type` (`ceremony` | `reception` |
  `custom`), `venueEvent`, `venueName`, `address`, `date`, `time`.
- **Venue Optional Inputs**: `label`, `id`, `eventType`, `city`, `mapUrl`, `googleMapsUrl`,
  `appleMapsUrl`, `wazeUrl` (URL or a `[[PENDIENTE:KEY]]` placeholder that fails closed at render),
  `image`, `focalPoint`, `coordinates` (`lat`, `lng`, `zoom`), `sortOrder`; `isVisible` defaults to
  `true`.
- **Defaulted Inputs**: `visibility` (`public` | `after-rsvp`, default `public`), `mapStyle`
  (default `dark`), `indicationsHeading` (default `''`), indication `styleVariant` (default
  `default`).
- **Optional Inputs**: `accessPolicy` (`visibility`, `revealPlacement`), `presentation` (`simple` |
  `with-map` | `with-photo`), `presentationOptions` (`showFlourishes`, `showNavigationButtons`,
  `revealSurface`, `indicationsLayout`, `indicationsStyle`, `showCalendarLinks`), `introEyebrow`,
  `introHeading`, `introLede`, `ornament`, `indications[]` (`iconName`, `text`, optional `title`).
- **Validation Rules**: `accessPolicy.revealPlacement` is required when `accessPolicy.visibility` is
  `after-rsvp` and forbidden when it is `public`. Legacy root `ceremony` / `reception` objects are
  rejected.
- **Rendering & Omission**: Optional section. If omitted, no empty location container is rendered.

---

## 6. Family (`family`)

- **Purpose**: Parents, godparents, honor court, and family members.
- **Required Inputs**: `variant`.
- **Optional Inputs**: `parents` (`father`, `mother`, `fatherDeceased`, `motherDeceased`),
  `parentsOrder` (`father-first` | `mother-first`), `spouse`, `children[]`, `godparents[]`,
  `godparentGroups[]` (`honoreeName`, `label`, `godparents[]`), `groups[]` (`title`, `items[]` with
  `name`, `role`, `deceased`), `labels` (`sectionTitle`, `sectionSubtitle`, `spouseTitle`,
  `spouseRole`, `childrenTitle`, `parentsTitle`, `fatherRole`, `motherRole`, `godparentsTitle`,
  `sectionMessage`), `featuredImage`, `featuredImageAlt`, `presentation` (`with-photo` |
  `text-only`), `focalPoint`, `visible`, `sectionMessage`.
- **Validation Rules**: `godparents` and `godparentGroups` are mutually exclusive. There is no
  `sponsors`, `title`, or `subtitle` key; headings live in `labels`.
- **Rendering & Omission**: Optional section.

---

## 7. Gallery (`gallery`)

- **Purpose**: Interactive photo gallery grid / carousel of celebrant photos.
- **Required Inputs**: `variant`, `items[]` (may be empty unless the variant requires items). Each
  item requires `image`.
- **Item Optional Inputs**: `alt`, `caption`, `key`, `layoutRole` (`feature` | `wide` | `standard`),
  `aspectRatio`, `focalPoint`, `focalPointMobile`, `focalPointTablet`, `focalPointDesktop`.
- **Defaulted Inputs**: `eyebrow` (`Galería`), `title` (`Galería`).
- **Optional Inputs**: `subtitle`, `presentation` (`standard` | `pet-keepsake`),
  `variantOptions.mobileBrowse` (`magazine-spread` only), `variantOptions.arrangement`
  (`paired-portraits` only).
- **Precedence**: `gallery.variant` is the sole layout authority. Legacy `sectionStyles` values,
  theme-named values, and `single` are rejected by the canonical schema.
- **Validation Rules**: `pet-keepsake` rejects per-item `layoutRole`. Variant item rules are listed
  in [Variant prerequisites](#variant-prerequisites).

---

## 8. Itinerary (`itinerary`)

- **Purpose**: Timeline of event activities (ceremony, reception, dinner, party, toast).
- **Required Inputs**: `variant`, `items[]`. Each item requires `iconName` (icon catalog name),
  `label`, `time`.
- **Item Optional Inputs**: `description`.
- **Defaulted Inputs**: `title` (`Itinerario`).
- **Optional Inputs**: `subtitle`, `closingNote`.
- **Variant Contract**: `timeline-paper` selects `ItineraryProgram`; every other `itinerary.variant`
  selects `TimelineList`.
- **Rendering & Omission**: Optional section.

---

## 9. RSVP (`rsvp`)

- **Purpose**: Guest attendance confirmation form, attendee count selector, dietary notes, and
  WhatsApp/API submission.
- **Required Inputs**: `variant`, `personalizedAccess.variant`.
- **Defaulted Inputs**: `title` (`¿Vienes a celebrar conmigo?`), `guestCap` (1), `accessMode`
  (`personalized-only` | `hybrid`, default `personalized-only`), `confirmationMode` (`api` |
  `whatsapp` | `both`, default `api`), `confirmationMessage`, `flow` (`form` | `steps`, default
  `form`; presentation only, the payload is the same).
- **Optional Inputs**: `subcopy`, `responseMessages` (`confirmed` / `declined`, each with `title`
  and `subtitle` ≤500), `whatsappConfig` (`phone` required; `confirmedTemplate`, `declinedTemplate`,
  `omitTitle`), `labels` (see [Content Schema](../../core/content-schema.md)), `calendar` (`title`,
  `description`, `startsAt`).
- **Personalized access** (`rsvp.personalizedAccess`): optional `ticket` (`signature`, `monogram`),
  `title`, `subtitle`, `footerText`, `noteText`, `presentationOptions.passStyle` (`classic` |
  `race-credential`; any non-`classic` style requires the `formal-pass` variant).
- **Variant Contract**: `formal-register` keeps the shared RSVP renderer and owns the underline
  confirmation-register presentation. Values for `rsvp.variant` and
  `rsvp.personalizedAccess.variant` are listed in the
  [variant system](../theme/variant-system.md#canonical-inventory).
- **Rendering & Omission**: Optional in the schema; required in practice for invitations that
  collect confirmations. A public `personalized-only` RSVP without guest context renders a static
  locked Astro state; demo and guest-backed states render the interactive React island. The access
  pass renders only where `sectionOrder` lists `personalizedAccess`, and only in a demo preview or
  with guest context.

---

## 10. Gifts (`gifts`)

- **Purpose**: Gift registry information, Mesa de Regalos links, or bank account / CLABE transfer
  details.
- **Required Inputs**: `variant`.
- **Optional Inputs**: `title`, `subtitle`, `folioMark` (≤12), `presentation` (`catalog` |
  `legend-only`; treated as `catalog` when omitted), `ornament`, `items[]`.
- **Item types** (discriminated by `type`):

| `type`   | Required                                    | Optional / defaulted                                      |
| -------- | ------------------------------------------- | --------------------------------------------------------- |
| `store`  | `title`, and `url` or a non-empty `links[]` | `logo`, `description`, `tableNumber`                      |
| `bank`   | `bankName`, `accountHolder`, `clabe`        | `title` (`Transferencia`), `accountNumber`, `accountKind` |
| `paypal` | `url`                                       | `title` (`PayPal`)                                        |
| `cash`   | none                                        | `title` (`Lluvia de Sobres`), `text`, `iconName`          |

- **Validation Rules**: Links must be `http` or `https`. `legend-only` must not include `items`.
- **Rendering & Omission**: Optional section. Bank account details must be handled securely without
  raw SQL or log exposure.

---

## 11. Thank You (`thankYou`)

- **Purpose**: Closing gratitude message to guests.
- **Required Inputs**: `variant`, `message`, `closingName`.
- **Optional Inputs**: `closingNameLeadWords` (1–4), `closingPhrase`, `date` (editorial closing-date
  display string; not derived from `eventTiming`), `image`, `ornament`, `focalPoint`,
  `overlayAnchor`, `overlaySafeArea`.
- **Validation Rules**: `full-bleed-photo`, `portrait-letter`, and `portrait-keepsake` require
  `image`.
- **Rendering & Omission**: Optional closing fold. `closingPhrase` is consumed by the invitation
  footer; `date` renders as the Thank You closing-date line when present.
- **Editing**: Managed invitations own `date` / `closingPhrase` / section variant via the provision
  package and `pnpm invitation:release`. The dashboard Agradecimiento card edits message, firma, and
  image only; preview and publish preserve the remaining prior-published fields.

---

## 12. Memories (`memories`)

- **Purpose**: Guest entry point to the event memory space. It shows one button to `/r/<publicSlug>`
  on the serving origin, a black-on-white QR code and a link to download that code as SVG. It needs
  no JavaScript.
- **Required Inputs**: `variant`, `publicSlug` (a lowercase memory space slug). The slug is the
  printed QR contract of an existing memory space (`event_memory_settings.public_slug`), never
  derived from the invitation route.
- **Optional Inputs**: `title`, `description`, `actionLabel`, `footerText`, `downloadLabel`, `qrAlt`
  (each trimmed, 1–240 characters). Defaults are neutral and speak of the hosts. The copy carries no
  dates.
- **Rendering & Omission**: `sectionOrder` decides visibility. If it lists `memories`, the
  `memories` data is required (root `superRefine`). Data that `sectionOrder` does not list is
  allowed, and it then renders nothing and loads no stylesheet. The QR always encodes the Production
  public origin, so a code scanned from Preview opens Production. The section is not part of the
  navigation.
- **Editing**: Managed-only. The dashboard never lists, toggles, or reorders it. Drafts drop the
  `memories` data, and publish and preview carry it from the prior published revision. If a draft
  order loses the key, it is put back at its prior position.
- **Publication gate**: Managed releases read the target memory space before any write. A missing
  space, a space owned by another event, or a target without an event blocks the release. A disabled
  space or an ended retention only warns. The event is created by the first publication, so a new
  invitation can add this section only in its second release.

---

## 13. Interludes (`interludes`)

- **Purpose**: Full-bleed background photo dividers between sections.
- **Shape**: An optional array; each entry is one interlude.
- **Required Inputs**: `image` (asset), `afterSection` (any `sectionOrder` key).
- **Defaulted Inputs**: `height` (`screen` | `tall` | `medium`, default `screen`).
- **Optional Inputs**: `alt`, `presentation` (`bleed` | `framed`), `focalPoint`,
  `focalPointDesktop`, `lightX`, `lightY`, `overlayOpacity` (string).
- Interludes do not own a variant vocabulary; the renderer emits the fixed `standard` DOM marker.

---

## 14. Music (`music`)

- **Purpose**: Background music player for invitation atmosphere.
- **Required Inputs**: `url`.
- **Defaulted Inputs**: `autoPlay` (`false`).
- **Optional Inputs**: `title`, `startAt` (seconds, ≥0; playback starts and loops back here),
  `fadeInSeconds` (0–10).

---

## 15. Sharing & Metadata (`sharing`)

- **Purpose**: OpenGraph preview metadata and guest share copy for WhatsApp and social networks.
- **Required Inputs**: none.
- **Optional Inputs**: `ogImage`, `ogDescription` (1–200), `whatsappTemplate`, `shareMessages`
  (`invitation` and `reminder`, both required inside, 1–500 each), `reminderSettings` (`enabled`,
  `showWhenDaysBeforeEvent` 0–365, `audience` `unconfirmed` | `all-shared`, all required inside).

---

## Variant prerequisites

The registry's `prerequisites` strings are documentation. Only the rules in the first table are
validated by the schemas; the second table is **authoring guidance, not validated by the schema**.

| Section.variant                 | Rule enforced by the schema                                         |
| ------------------------------- | ------------------------------------------------------------------- |
| `family.split-groups`           | `parents.father` or `parents.mother`, or at least two `groups`      |
| `family.asymmetric-groups`      | Same as `split-groups`; any `groups` array needs at least two items |
| `location.split-map`            | One visible venue with `coordinates` or `image`                     |
| `location.stacked-venue-plates` | At least two visible venues                                         |
| `location.night-route`          | At least two visible venues                                         |
| `location.program-sheet`        | At least one visible venue; `scene: 'lantern-route'` needs two      |
| `gallery.single-keepsake`       | Exactly one item                                                    |
| `gallery.paired-portraits`      | Exactly two items                                                   |
| `gallery.narrative-stack`       | At least one item; every item has a caption and no `aspectRatio`    |
| `gallery.mirrored-mosaic`       | At least three items                                                |
| `gallery.feature-stack`         | At least three items                                                |
| `gallery.paired-feature-band`   | At least three items and one item with `layoutRole: feature`        |
| `gallery.pinned-track`          | At least three items                                                |
| `thankYou.full-bleed-photo`     | `image`                                                             |
| `thankYou.portrait-letter`      | `image`                                                             |
| `thankYou.portrait-keepsake`    | `image`                                                             |
| `personalizedAccess` (any)      | `passStyle` other than `classic` requires `formal-pass`             |

| Section.variant               | Authoring guidance (not validated)                       |
| ----------------------------- | -------------------------------------------------------- |
| `hero.split-cover`            | Provide `hero.portrait`                                  |
| `gifts.editorial-catalog`     | Provide `items` or an explicit compatible `presentation` |
| `gallery` item-based variants | Provide items; an empty `items[]` passes the schema      |
| `itinerary` (all variants)    | Provide items; an empty `items[]` passes the schema      |
