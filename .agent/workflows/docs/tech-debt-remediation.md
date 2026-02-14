---
description:
    Comprehensive technical debt remediation workflow for SCSS, TypeScript, and documentation.
lifecycle: evergreen
domain: docs
owner: docs-governance
last_reviewed: 2026-02-14
---

# 🔧 Workflow: Technical Debt Remediation

Execute phased technical debt cleanup based on audit findings.

**Prerequisites:**

- [x] Audit report reviewed (`docs/audit/technical-debt-audit-2026-02-11.md`)
- [x] `pnpm type-check` passes before starting
- [x] `pnpm lint` passes before starting
- [ ] Branch created: `git checkout -b tech-debt/remediation-YYYY-MM-DD`

---

## Phase 0: Pre-Remediation Setup

### 0.1 Baseline Verification

```bash
# Verify starting state
pnpm type-check
pnpm lint
pnpm test

# Document baseline
echo "Baseline: $(date)" > logs/tech-debt-baseline.txt
pnpm type-check >> logs/tech-debt-baseline.txt 2>&1
```

### 0.2 Scope Definition

**Target Files by Priority:**

**Phase 1 (High):** ✅ COMPLETED

- `src/styles/global/_functions.scss` - Legacy variables
- `src/styles/global/_mixins.scss` - Legacy variables
- `src/styles/global/_typography.scss` - Already using tokens (no changes needed)

**Phase 2 (Medium):** ✅ COMPLETED

- `src/styles/invitation/_hero.scss` - Nesting verification (already compliant)
- `src/styles/invitation/_gallery.scss` - Nesting verification (already compliant)

**Phase 3 (Medium):** ✅ COMPLETED

- Hardcoded colors in theme files (#667eea, #814f96, #8b0000)

**Phase 3.1 (NEW):** ⚠️ PENDING - EventLocation Theme Separation

**Phase 4 (Medium):** ⏳ PENDING

- Inline style cleanup

**Phase 5 (Low):** ⏳ PENDING

- Documentation updates
- Cross-references

---

## Phase 1: SCSS Legacy Migration ✅ COMPLETED

### 1.1 Summary of Changes

**Files Modified:**

1. `src/styles/global/_functions.scss`
    - Removed `@use 'variables' as vars` import
    - Inlined local variables ($backdrop-blurs, $breakpoints, $z-index, $border-radius)
    - Updated `color()` function to use tokens directly

2. `src/styles/global/_mixins.scss`
    - Removed `@use 'variables' as vars` import
    - Inlined `$transitions-by-component` and `$breakpoints`
    - Updated `@mixin transition()` and `@mixin respond-to()` to use local variables

3. `src/pages/[eventType]/[slug].astro`
    - Fixed pre-existing type errors (added Props type for Astro.props)
    - Added explicit type annotation for gallery items map callback

### 1.2 Verification Commands

```bash
# Verify no legacy imports remain
grep -r "@use 'variables'" src/styles --include="*.scss"

# Should return no matches (except global.scss which bridges tokens)
```

### 1.3 Build Verification

```bash
pnpm type-check  # ✓ 0 errors
pnpm lint        # ✓ 1 warning (pre-existing)
pnpm build       # ✓ Success
```

---

## Phase 2: Nesting Reduction ✅ COMPLETED

### 2.1 Analysis Results

**Files Analyzed:**

- `src/styles/invitation/_hero.scss` - Already compliant (max 2 levels)
- `src/styles/invitation/_gallery.scss` - Already compliant (max 2 levels)

### 2.2 Conclusion

No refactoring needed. Both files already follow BEM naming convention and do not exceed 3 levels of
nesting.

---

## Phase 3: Hardcoded Values Cleanup ✅ COMPLETED

### 3.1 Summary of Changes

**Files Modified:**

1. `src/styles/themes/sections/_countdown-theme.scss`
    - Replaced `#667eea` gradient with `primitives.$base-gold-500`
    - Added `@use 'sass:color'` import

2. `src/styles/invitation/_event-location.scss`
    - Replaced `#814f96` with `tokens.$base-purple-reserved`

3. `src/styles/themes/sections/_reveal-theme.scss`
    - Replaced 6 instances of `#8b0000` with `tokens.$color-wax-seal`

### 3.2 Verification Commands

```bash
# Verify target colors replaced
grep -rn "#667eea|#814f96|#8b0000" src/styles/themes/sections/
# Should only find in _primitives.scss (token definitions)
```

### 3.3 Remaining Hardcoded Colors

There are still ~150 hardcoded hex colors in theme files (primarily white/black values and gradient
endpoints). These were not targeted in this phase as they require more extensive refactoring.

---

## Phase 3.1: EventLocation Theme Separation ⚠️ PENDING

### 3.1.1 Problem Identified

**Architecture Issue:**

- `src/styles/invitation/_event-location.scss` contains both base styles AND theme-specific styles
- Should follow pattern: base styles + theme file (like `_countdown.scss` + `_countdown-theme.scss`)

**Current State:**

- ✅ `src/styles/themes/sections/_location-theme.scss` exists with 6 variants
- ❌ `_event-location.scss` has coupled theme styles (lines 466-477, 482)

### 3.1.2 Files Involved

**Base Styles (should only have structure/layout):**

- `src/styles/invitation/_event-location.scss` - ~500 lines (target: ~300)

**Theme Styles:**

- `src/styles/themes/sections/_location-theme.scss` - 1194 lines (expand to cover all variants)

### 3.1.3 Refactoring Steps

**Step 1: Clean `_event-location.scss`**

1. Move `--reserved` indicator styles (lines 466-477) to `_location-theme.scss`
2. Replace `#d4af37` with `tokens.$color-action-accent` (line 482)
3. Remove theme-specific background/border styles from base file
4. Keep only: structure, layout, typography, spacing

**Step 2: Expand `_location-theme.scss`**

Add/verify for each variant:

- `jewelry-box`
- `structured` (mostly complete)
- `organic` (mostly complete)
- `minimal`
- `luxury`
- `luxury-hacienda`

Each variant should include:

- Background colors/images
- Card styling
- Indicator icon colors
- `--reserved` container styles

**Step 3: Component Verification**

```bash
# Verify EventLocation.astro imports both files
grep -n "_event-location.scss" src/components/invitation/EventLocation.astro
# Should show both base and theme imports
```

### 3.1.4 Pattern to Follow

**Before (coupled):**

```scss
// _event-location.scss
.event-location__indication-item--reserved {
	background: rgba(129, 79, 150, 0.08);
	border: 1px solid rgba(129, 79, 150, 0.2);
}
```

**After (separated):**

```scss
// _event-location.scss (base - neutral)
.event-location__indication-item {
	background: rgba(255, 252, 240, 0.5);
	border: 1px solid rgba(var(--color-action-accent-rgb), 0.2);
}

// _location-theme.scss (variant-specific)
.event-location[data-variant='structured'] {
	.event-location__indication-item--reserved {
		background: rgba(129, 79, 150, 0.08);
		border: 1px solid rgba(129, 79, 150, 0.2);
	}
}
```

### 3.1.5 Other Components to Check

After EventLocation, verify these components follow the same pattern:

- [ ] `src/styles/invitation/_family.scss` vs `src/styles/themes/sections/_family-theme.scss`
- [ ] `src/styles/invitation/_gifts.scss` vs `src/styles/themes/sections/_gifts-theme.scss`
- [ ] `src/styles/invitation/_gallery.scss` vs `src/styles/themes/sections/_gallery-theme.scss`

---

## Phase 4: Inline Styles Cleanup ⏳ PENDING

### 4.1 Review Inline Style Usage

**Current usages (7 files):**

1. `Pricing.astro:37` - `--delay` animation
2. `OptimizedImage.astro:53` - dimensions
3. `Icon.astro:145` - size
4. `EventHeader.astro:44,50` - theme styles
5. `Section.astro:41` - background
6. `EventLocation.astro:70` - data attributes (not style)

### 4.2 Refactoring Strategy

**Pattern 1: CSS Custom Properties (for animations)**

**Before:**

```astro
<!-- Pricing.astro -->
<div style={`--delay: ${index * 0.2}s`}></div>
```

**After:**

```astro
<!-- Pricing.astro -->
<div class="pricing-card" data-delay={index}></div>
```

```scss
// _pricing.scss
.pricing-card {
	&[data-delay='0'] {
		--delay: 0s;
	}
	&[data-delay='1'] {
		--delay: 0.2s;
	}
	&[data-delay='2'] {
		--delay: 0.4s;
	}
}
```

**Pattern 2: Scoped Classes (for dimensions)**

**Before:**

```astro
<!-- OptimizedImage.astro -->
<img style={`width: ${width}px; height: ${height}px;`} />
```

**After:**

```astro
<img class="optimized-image" data-width={width} data-height={height} />
```

```scss
.optimized-image {
	width: attr(data-width px);
	height: attr(data-height px);
}
```

### 4.3 Phase 4 Verification

```bash
# Count remaining inline styles
grep -r "style=" src/components --include="*.astro" | grep -v "data-" | wc -l
```

---

## Phase 5: Documentation Updates ⏳ PENDING

### 5.1 Create AssetRegistry Guide

**File:** `docs/ASSET_REGISTRY_GUIDE.md`

### 5.2 Update Implementation Log

**File:** `docs/implementation-log.md`

Add section documenting completed work:

```markdown
## 2026-02-12: Technical Debt Remediation

### Phase 1: SCSS Migration

- Migrated \_functions.scss to token system
- Migrated \_mixins.scss to token system
- Fixed type errors in [slug].astro

### Phase 2: Nesting Reduction

- Verified \_hero.scss compliance (already clean)
- Verified \_gallery.scss compliance (already clean)

### Phase 3: Hardcoded Values

- Replaced #667eea in \_countdown-theme.scss
- Replaced #814f96 in \_event-location.scss
- Replaced #8b0000 in \_reveal-theme.scss (6 instances)

### Phase 3.1: EventLocation Theme Separation

- [PENDING] Separate base styles from theme styles

### Verification

- pnpm type-check: PASS (0 errors)
- pnpm lint: PASS (1 warning - pre-existing)
- pnpm build: PASS
```

### 5.3 Add Cross-References

Update key documents with "See Also" sections:

- [ ] `docs/ARCHITECTURE.md` → Link to THEME_SYSTEM.md
- [ ] `docs/THEME_SYSTEM.md` → Link to ASSET_REGISTRY_GUIDE.md
- [ ] `docs/STABILITY.md` → Link to implementation-log.md

---

## Phase 6: Final Verification

### 6.1 Comprehensive Check

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

### 6.2 Regression Testing

**Visual Regression Checklist:**

- [ ] Landing page renders correctly
- [ ] Invitation pages (xv, boda, bautizo, cumple) work
- [ ] All themes display properly
- [ ] Animations work (hero reveal, countdown)
- [ ] Mobile responsive
- [ ] Desktop responsive

### 6.3 Metrics Comparison

| Metric             | Before  | After | Change |
| ------------------ | ------- | ----- | ------ |
| Legacy imports     | 2       | 0     | -2     |
| Nesting violations | 0       | 0     | 0      |
| Hardcoded colors   | 3       | 0     | -3     |
| Theme separation   | Partial | TBD   | TBD    |
| Inline styles      | 7       | TBD   | TBD    |
| Type errors        | 96      | 0     | -96    |

---

## Decision Matrix

| Situation         | Action                                          |
| ----------------- | ----------------------------------------------- |
| Build fails       | Stop, revert last change, fix issue             |
| Type error        | Fix immediately before continuing               |
| Lint error        | Auto-fix with `pnpm lint --fix` or fix manually |
| Test fails        | Investigate before committing                   |
| Visual regression | Stop and revert related changes                 |
| Uncertainty       | Document in commit message, proceed cautiously  |

---

## Rollback Strategy

**If critical issues found:**

1. **Stop immediately**
2. **Document issue** in `logs/tech-debt-rollback-YYYY-MM-DD.md`
3. **Revert to last known good state:**

    ```bash
    git log --oneline -5
    git reset --hard <last-good-commit>
    ```

4. **Report findings** in audit report
5. **Create tickets** for problematic files

---

## Quick Commands Reference

```bash
# Full verification
pnpm type-check && pnpm lint && pnpm test

# Find legacy imports
grep -r "@use 'variables'" src/styles --include="*.scss" -l

# Find hardcoded colors
grep -rn "#[0-9a-fA-F]{6}" src/styles/themes/ --include="*.scss"

# Find deep nesting
cat src/styles/invitation/_hero.scss | grep -E "^\s{12,}\S"

# Count inline styles
grep -r "style=" src/components --include="*.astro" | wc -l
```

---

## Appendix: File Inventory

### Completed Items

| File                    | Issue             | Status                    |
| ----------------------- | ----------------- | ------------------------- |
| `_functions.scss`       | Legacy vars       | ✅ Done                   |
| `_mixins.scss`          | Legacy vars       | ✅ Done                   |
| `_hero.scss`            | Nesting check     | ✅ Done (was clean)       |
| `_gallery.scss`         | Nesting check     | ✅ Done (was clean)       |
| `_countdown-theme.scss` | Hardcoded #667eea | ✅ Done                   |
| `_event-location.scss`  | Hardcoded #814f96 | ✅ Done                   |
| `_reveal-theme.scss`    | Hardcoded #8b0000 | ✅ Done (6 instances)     |
| `[slug].astro`          | Type errors       | ✅ Done (96 errors fixed) |

### Pending Items

| File/Task                | Issue                  | Priority |
| ------------------------ | ---------------------- | -------- |
| EventLocation separation | Theme coupling         | High     |
| `_family.scss`           | Check theme separation | Medium   |
| `_gifts.scss`            | Check theme separation | Medium   |
| `_gallery.scss`          | Check theme separation | Medium   |
| Inline styles (7 files)  | Refactor to CSS        | Medium   |
| Documentation updates    | Guides & logs          | Low      |

---

**Estimated Remaining Effort:** 8-12 hours

**Recommended Schedule:**

- Session 1: EventLocation theme separation
- Session 2: Verify other components (Family, Gifts, Gallery)
- Session 3: Inline styles cleanup
- Session 4: Documentation updates + Final verification

// turbo

> [!IMPORTANT] Execute phases sequentially. Do not skip verification steps. When in doubt, prefer
> smaller, verifiable commits over large changes.

> [!WARNING] Always verify `pnpm build` succeeds before marking phase complete. Visual regressions
> are the primary risk in this remediation.
