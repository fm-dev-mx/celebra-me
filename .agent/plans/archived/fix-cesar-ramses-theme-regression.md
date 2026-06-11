---
title: Fix César Ramses Theme Regression (sacred-keepsake → jewelry-box)
status: implemented
created: 2026-06-11
updated: 2026-06-11
---

# Fix César Ramses Theme Regression (sacred-keepsake → jewelry-box)

## Status

Implemented — All fixes applied and verified locally.

## Problem

`/bautizo/cesar-ramses` renders with `jewelry-box` theme instead of `sacred-keepsake`.

## Root Causes

### Cause 1: `adopt-legacy-events.mjs` hardcoded `themeId: 'jewelry-box'`

The script created projects in `invitations` for legacy events without `invitation_project_id`,
using `themeId: 'jewelry-box'` for ALL events regardless of actual theme.

**Data flow**: `adopt-legacy-events.mjs` → `invitations.snapshot.themeId = "jewelry-box"` →
(re-publish) → `mapDraftToPublished()` → `theme.preset = snapshot.themeId` →
`hero.variant = snapshot.themeId` → page renders wrong theme.

### Cause 2: `draft-to-published.mapper.ts` overwrites `theme.preset` without validation

`theme.preset` always used `snapshot.themeId`, even when the existing published content had a
correct preset.

### Cause 3: `buildHeroFromDraft` propagated `themeId` to `hero.variant`

`hero.variant` was set to `themeId` unconditionally, duplicating the error into the CSS variant
system.

## Fixes Applied

### Fix 1: DB correction (local Supabase)

- Restored `content.theme.preset` and `content.hero.variant` to `"sacred-keepsake"`
- Corrected `snapshot.themeId` and `theme_id` in `invitations`

### Fix 2: `adopt-legacy-events.mjs` — `resolveActualTheme()`

- Reads `theme.preset` from the event's static JSON file if it exists
- Falls back to event-type default theme if file is missing
- Uses `'editorial'` as safe generic fallback (neutral layout, no glass card)

### Fix 3: `draft-to-published.mapper.ts`

- `hero.variant` only set when demo content explicitly defines it (removed fallback `|| themeId`)
- Removed `variant: themeId` from blank draft fallback in `mapHeroSection`
- Blank draft hero fallback omits variant — adaptation layer resolves from `theme.preset`

## Verification

- Type-check: 0 errors, 0 warnings
- Tests: 174 suites, 2079 tests passed
- Lint: 0 errors, 64 warnings (all pre-existing)
- Build: Completed successfully
- Curl: `/bautizo/cesar-ramses` → `layout--sacred-keepsake` ✅
- No-regression: demo pages maintain correct themes

## Post-audit: Legacy snapshot correction

3 additional events had `snapshot.themeId` contaminated (`jewelry-box` hardcoded):

- `ana-sofia-cota-guillen` → restored to `celestial-blue`
- `gerardo-sesenta` → restored to `luxury-hacienda`
- `ximena-meza-trasvina` → restored to `premiere-floral`

**Post-audit result**: 0 discrepancies across all 12 projects.
