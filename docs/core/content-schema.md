# Content Schema

## Overview

Event content schemas are assembled in `src/content/config.ts` from modular Zod definitions under
`src/lib/schemas/content`.

## Module Boundaries

- `base-event.schema.ts`: top-level event assembly
- `hero.schema.ts`: hero and celebrant metadata
- `location.schema.ts`: venue, ceremony, reception, and indication schemas
- `family.schema.ts`: family and relationship groups
- `rsvp.schema.ts`: RSVP payload plus deprecated RSVP style labels
- `gifts.schema.ts`: gift option variants
- `section-styles.schema.ts`: semantic section-style configuration
- `shared.schema.ts`: asset, theme, and shared section primitives

## Deprecation Policy

Legacy RSVP style labels now live under `sectionStyles.rsvp.legacy`.

- `legacy.nameLabel`: use `labels.name`
- `legacy.guestCountLabel`: use `labels.guestCount`
- `legacy.buttonLabel`: use `labels.confirmButton`

Adapters continue to read the legacy namespace as a fallback to preserve existing content behavior
during migration.
