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
