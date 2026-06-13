# Icon System Cleanup

## Summary

Removed all runtime support for legacy icon names. The icon system now enforces strict canonical
PascalCase naming at the data layer, with no runtime normalization fallbacks.

## Changes

- **Database migration** (`supabase/migrations/20260607000000_normalize_icon_names.sql`): Converts
  all legacy lowercase/hyphenated icon names to canonical PascalCase in both
  `published_invitation_content` and `invitation_content_drafts` tables (itinerary items + location
  indications).
- **Registry cleanup** (`src/components/common/icons/registry.ts`): Removed 11 aliases. Registry now
  contains only auto-generated entries from component exports.
- **Catalog updates** (`src/lib/icons/icon-catalog.ts`): Added `CheckSeal` and `Heartbreak`. Renamed
  `Envelope` → `Enveloped` to match component name.
- **Adapter simplification** (`src/lib/adapters/event.ts`): Removed `normalizeIconName()` (54 lines,
  30+ mappings). Indications now pass through directly.
- **Schema refactor** (`src/lib/intake/schemas/*.ts`): Replaced `dressCode`/`additionalIndications`
  string fields with structured `indications` array across draft, editor, and published schemas.
- **Mapper updates** (`draft-to-published.mapper.ts`, `draft-content-mapper.ts`): Updated to handle
  new `indications` array format; removed old string-to-indication derivation.
- **Editor updates** (`DraftEditor.tsx`, `DraftReview.tsx`, `LocationSectionEditor.tsx`): Replaced
  dress code / additional indications fields with dynamic indications list with icon picker.
- **ItineraryEditor.tsx**: Removed `ITINERARY_ALLOWED_ICONS` restriction — all 30 catalog icons now
  available.
- **VenueCard.astro**: Fixed `Icon name="Map"` → `name="MapLocation"`.
- **reveal-card.ts**: Updated `SEAL_ICON_MAP` values to canonical names, added `IconName` typing.
- **Demo data**: Fixed `Envelope` → `Enveloped` in `demo-xv-editorial.json`.

## Verification

- Type-check: 0 errors, 0 warnings
- Tests: 154 suites, 1728 tests passing
- Verification script: `scripts/verify-icon-migration.ts`

## Verification Script

```bash
pnpm tsx scripts/verify-icon-migration.ts
# Exit codes:
#   0 - All icon names are canonical (success)
#   1 - Legacy names found (migration incomplete)
#   2 - Database connection error
```

Uses `process.exitCode` (not `process.exit()`) for clean Windows/libuv shutdown.

## Migration Execution

1. Run migration through the current database workflow: `pnpm db:prod:migrate`
2. Verify: `pnpm tsx scripts/verify-icon-migration.ts`
3. Deploy runtime code

## Rollback

`git revert <commit>` and redeploy restores runtime normalization as temporary fix.
