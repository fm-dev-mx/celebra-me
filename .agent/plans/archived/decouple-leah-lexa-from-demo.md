---
title: Decouple Leah Lexa from Demo Baby Shower
status: implemented
created: 2026-06-13
updated: 2026-06-13
related_docs:
  - .agent/plans/README.md
  - scripts/manual/production-patches/20260613_prepare_leah_lexa_baby_shower.sql
---

# Decouple Leah Lexa from Demo Baby Shower

## Root Cause of Coupling

The SQL patch (`20260613_prepare_leah_lexa_baby_shower.sql`) had three problems:

1. **`_assetSlug` mismatch** (most critical): Set to `v_slug` = `'leah-lexa'`, but the asset
   directory is `leah-lexa-baby-shower/`. The registry key derives from the directory name, so
   `isValidEvent('leah-lexa')` returns `false` and all internal asset key resolution (seal, hero,
   family, gallery) fails. The fallback then reaches `snapshot.previewSlug` =
   `'demo-baby-shower-celestial'`, directing asset lookups to the demo's directory.

2. **`snapshot.previewSlug` pointed to demo**: Used by the intake/publish asset resolution chain as
   a fallback `_assetSlug`. Pointed to the demo directory.

3. **`snapshot.id` and `snapshot.displayName` referenced demo**: Metadata inaccuracies.

## Changes Applied

**File**: `scripts/manual/production-patches/20260613_prepare_leah_lexa_baby_shower.sql`

| Line | Field                  | Before                                            | After                       | Rationale                                                      |
| ---- | ---------------------- | ------------------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| 78   | `snapshot.id`          | `v_base_demo_id` → `'demo-baby-shower-celestial'` | `v_slug` → `'leah-lexa'`    | Purely metadata; zero TS consumers                             |
| 80   | `snapshot.displayName` | `'Baby Shower - Celestial Demo'`                  | `'Baby Shower — Leah Lexa'` | Accurate label                                                 |
| 85   | `snapshot.previewSlug` | `'demo-baby-shower-celestial'`                    | `'leah-lexa-baby-shower'`   | Decouples intake/publish asset resolution                      |
| 159  | `_assetSlug`           | `v_slug` → `'leah-lexa'`                          | `'leah-lexa-baby-shower'`   | **Critical**: matches directory name, enables `isValidEvent()` |

**Intentionally unchanged**: `v_base_demo_id` / `base_demo_id` column — retained as
`'demo-baby-shower-celestial'` per analysis confirming it's a strict catalog FK in
`invitation.service.ts:141-143` (`findDemoPreset()` throws on miss). Exactly 1 reference remains in
the patched file (line 23: `v_base_demo_id constant text := 'demo-baby-shower-celestial';`).

## Asset-Resolution Contract

| Invitation | `_assetSlug`                 | Asset Directory                                        | Registry Key                 |
| ---------- | ---------------------------- | ------------------------------------------------------ | ---------------------------- |
| Leah Lexa  | `leah-lexa-baby-shower`      | `src/assets/images/events/leah-lexa-baby-shower/`      | `leah-lexa-baby-shower`      |
| Demo       | `demo-baby-shower-celestial` | `src/assets/images/events/demo-baby-shower-celestial/` | `demo-baby-shower-celestial` |

Resolution chain after fix:
`assetSlugOverride (none) ?? _assetSlug ('leah-lexa-baby-shower') ?? entrySlug ('leah-lexa')` →
`'leah-lexa-baby-shower'` → `isValidEvent() = true` → resolves from Leah's own directory ✓

## Validation Results

| Check                                              | Result                          |
| -------------------------------------------------- | ------------------------------- |
| `Select-String 'demo-baby-shower-celestial' <sql>` | 1 match — line 23 (intentional) |
| `Select-String 'leah-lexa' demo JSON`              | 0 matches                       |
| `pnpm test -- tests/content/schema.test.ts`        | 30/30 passed                    |
| `pnpm type-check`                                  | 0 errors, 0 warnings            |
| `pnpm validate:event-parity`                       | Passed                          |

## Production DB Migration

**None required.** The SQL patch (`20260613_prepare_leah_lexa_baby_shower.sql`) has never been run
in any environment. The changes are to the preparation script itself. Running it for the first time
(once `v_owner_user_id` is supplied) will produce correctly decoupled rows with:

- `base_demo_id = 'demo-baby-shower-celestial'` (catalog linkage)
- `_assetSlug = 'leah-lexa-baby-shower'` (correct asset directory)
- `snapshot.previewSlug = 'leah-lexa-baby-shower'` (no demo fallback)
- `snapshot.id = 'leah-lexa'` (self-identifying metadata)
