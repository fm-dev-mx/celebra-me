# Content Schema

## Overview

Event content schemas are assembled in `src/content.config.ts` (Astro 6 content collections entry
point) from modular Zod definitions under `src/lib/schemas/content`.

## Module Boundaries

- `base-event.schema.ts`: top-level event assembly
- `hero.schema.ts`: hero and celebrant metadata
- `location.schema.ts`: venue, ceremony, reception, and indication schemas
- `family.schema.ts`: family and relationship groups
- `rsvp.schema.ts`: RSVP payload plus RSVP section label overrides
- `gifts.schema.ts`: gift option variants
- `section-styles.schema.ts`: semantic section-style configuration
- `shared.schema.ts`: asset, theme, and shared section primitives
- `envelope.schema.ts`: envelope/reveal configuration
- `gallery.schema.ts`: gallery image items
- `interludes.schema.ts`: interlude section configuration
- `itinerary.schema.ts`: itinerary event schedule
- `content-block.schema.ts`: generic content block schema

## Deprecation Policy

RSVP copy overrides live under `sectionStyles.rsvp.labels`.

- `labels.name`
- `labels.guestCount`
- `labels.attendance`
- `labels.confirmButton`
- `labels.phone`
- `labels.notesLabel`
- `labels.notesPlaceholder`

Keep UI-facing values in Spanish when content overrides visible RSVP copy.

## Image Layout Fields

The following fields are used to control the presentation of images across various sections.

### `focalPoint`

Defines the `object-position` of the focal area of an image.

- **Supported in**: `hero`, `interludes`, `family`, `thankYou`, `location` (venue images), and
  `gallery` (per item).
- **Valid values**: CSS `object-position` compatible strings.
  - Percentages: `"50% 38%"`
  - Keywords: `"center top"`, `"left 20%"`
  - Single values: `"center"`, `"top"`
- **Default**: `"center"`

### `overlayAnchor` and `overlaySafeArea` (Thank You only)

Use these when a thank-you section places copy over a full-bleed photo and the subject must stay
clear.

- **`overlayAnchor` valid values**: `"left"`, `"right"`, `"top"`, `"bottom"`
- **`overlaySafeArea` valid values**: `{ "x": 0.38, "y": 0.24, "width": 0.34, "height": 0.34 }`
- Values are normalized image coordinates from `0` to `1`.
- `x + width` and `y + height` must stay within `1`.
- Mark the protected subject area, usually the face/head region. The overlay should anchor outside
  that area.
- For subject-aware full-bleed thank-you layouts, provide `overlayAnchor` and `overlaySafeArea`
  together so shared styles can position copy without covering the subject.

### `height` (Interludes only)

Defines the minimum height of the interlude section.

- **Valid values**:
  - `"screen"`: 100svh (fills the viewport)
  - `"tall"`: 80svh
- **Default**: `"screen"`

## Section Order

The optional `sectionOrder` field controls the render order of invitation sections. It is defined in
`shared.schema.ts` via `INVITATION_RENDER_SECTION_KEYS` (exported from `theme-contract.ts`).

```jsonc
// Example custom section order (all keys optional; `personalizedAccess` must be explicit)
"sectionOrder": ["quote", "location", "countdown", "family", "itinerary", "gallery", "gifts", "personalizedAccess", "rsvp", "thankYou"]
```

### Rules

- **Optional**. If omitted, `DEFAULT_SECTION_ORDER` (defined in `page-data.ts`) is used and
  `PersonalizedAccess` is placed automatically before `rsvp` (or after `quote` if no guest context
  exists).
- When present, the renderer follows the array verbatim — `personalizedAccess` must be explicitly
  listed to appear.
- Interludes are appended after their `afterSection` parent regardless of the section's position in
  the order.
- Only listed sections are rendered. Unlisted sections with data are silently skipped.

### When to use explicit ordering

- A demo needs a specific section progression (e.g., countdown → itinerary before gallery).
- The conversion path (Gifts → PersonalizedAccess → RSVP → ThankYou) must be contiguous without
  interludes.
- The default order does not match the event narrative.
