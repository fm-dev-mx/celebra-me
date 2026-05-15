# Content Schema

## Overview

Event content schemas are assembled in `src/content.config.ts` from modular Zod definitions under
`src/lib/schemas/content`.

## Module Boundaries

- `base-event.schema.ts`: top-level event assembly
- `hero.schema.ts`: hero and celebrant metadata
- `location.schema.ts`: venue, ceremony, reception, and indication schemas
- `family.schema.ts`: family and relationship groups
- `rsvp.schema.ts`: RSVP payload plus RSVP section label overrides
- `gifts.schema.ts`: gift option variants
- `section-styles.schema.ts`: semantic section-style configuration
- `shared.schema.ts`: asset, theme, and shared section primitives

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

### `height` (Interludes only)

Defines the minimum height of the interlude section.

- **Valid values**:
  - `"screen"`: 100svh (fills the viewport)
  - `"tall"`: 80svh
- **Default**: `"screen"`
