---
description:
    Addresses technical debt items identified in the audit report (docs/audit/technical-debt-audit-2026-02-11.md).
    Includes: SCSS legacy import migration, AssetRegistry pattern documentation, and SCSS nesting depth refactoring.
    Designed as a multi-phase remediation workflow with verification at each stage.
---

# 🔧 Workflow: Technical Debt Remediation

**Source**: `docs/audit/technical-debt-audit-2026-02-11.md`  
**Scope**: Legacy SCSS migration, AssetRegistry documentation, SCSS nesting optimization  
**Type**: Evergreen (reusable for ongoing debt remediation)

## Phase 1: Pre-Remediation Analysis

### 1.1 Verify Current State

**Action**: Confirm technical debt items are still present before beginning remediation.

```bash
# Check for legacy SCSS imports
grep -r "@use.*variables" src/styles --include="*.scss" | head -20

# Check for legacy aliases
grep -r "as xv" src/styles --include="*.scss"

# Verify AssetRegistry structure
ls -la src/assets/images/events/
```

**Success Criteria**:

- [ ] Legacy imports confirmed in target files
- [ ] AssetRegistry structure verified
- [ ] No build errors in current state

### 1.2 Create Backup Branch

```bash
git checkout -b debt-remediation-$(date +%Y%m%d)
```

---

## Phase 2: SCSS Legacy Import Migration (HIGH PRIORITY)

**Goal**: Migrate all files from legacy variable imports (`birthday/variables`,
`invitation/variables`) to the token system.

### 2.1 Analyze Legacy Import Patterns

**Files to migrate** (36 identified instances):

| File                                                | Current Import                          | Migration Target                 |
| --------------------------------------------------- | --------------------------------------- | -------------------------------- |
| `src/styles/invitation/_gallery.scss:5`             | `@use 'variables' as xv;`               | `@use '../tokens' as tokens;`    |
| `src/styles/invitation/_hero.scss:3`                | `@use '../birthday/variables' as *;`    | `@use '../tokens' as tokens;`    |
| `src/styles/themes/presets/_luxury-hacienda.scss:2` | `@use '../../birthday/variables' as *;` | `@use '../../tokens' as tokens;` |
| `src/styles/invitation/_quote.scss:6`               | `@use 'variables' as vars;`             | `@use '../tokens' as tokens;`    |
| `src/styles/invitation/_countdown.scss:6`           | `@use 'variables' as vars;`             | `@use '../tokens' as tokens;`    |
| `src/styles/invitation/_family.scss:1`              | `@use 'variables' as vars;`             | `@use '../tokens' as tokens;`    |

**Variable Mapping** (Legacy → Tokens):

```scss
// Legacy (birthday/variables or invitation/variables)
$font-heading-formal → tokens.$font-display-elegant
$font-decorative-cursive → tokens.$font-handwriting
$font-body → tokens.$font-body
$color-gold → tokens.$color-action-accent
$color-white → tokens.$base-neutral-0
```

### 2.2 Migration Steps

**Step 1**: Read target file

```typescript
const filePath = 'src/styles/invitation/_gallery.scss';
const content = await read(filePath);
```

**Step 2**: Replace imports and variable references

**Before**:

```scss
@use '../global/variables' as g;
@use '../global/mixins' as m;
@use 'variables' as xv;
@use '../tokens' as tokens;

.gallery-section__title {
	font-family: xv.$font-heading-formal;
	color: $color-gold;
}
```

**After**:

```scss
@use '../global/mixins' as m;
@use '../tokens' as tokens;

.gallery-section__title {
	font-family: tokens.$font-display-elegant;
	color: tokens.$color-action-accent;
}
```

**Step 3**: Remove unused imports

- Remove `@use 'variables' as xv;`
- Remove `@use '../birthday/variables' as *;`
- Keep `@use '../global/mixins' as m;` (if mixins used)

**Step 4**: Update all variable references

- `xv.$font-heading-formal` → `tokens.$font-display-elegant`
- `xv.$font-decorative-cursive` → `tokens.$font-handwriting`
- `xv.$font-body` → `tokens.$font-body`
- `vars.$variable` → `tokens.$variable`
- `$color-gold` → `tokens.$color-action-accent`

### 2.3 Batch Migration Order

Migrate in this order to minimize conflicts:

1. **Invitation components** (highest impact):
    - `_gallery.scss`
    - `_hero.scss`
    - `_quote.scss`
    - `_countdown.scss`
    - `_family.scss`

2. **Theme presets**:
    - `_luxury-hacienda.scss`
    - Check `_jewelry-box.scss`

3. **Home components**:
    - `_contact.scss`
    - `_home-header.scss`
    - `_faq.scss`
    - `_about-us.scss`

4. **Layout components**:
    - `_header.scss`
    - `_header-base.scss`

### 2.4 Verification

**After each file migration**:

```bash
# Check for any remaining legacy references in the file
grep -n "xv\.\|vars\.\|@use.*birthday.*variables\|@use.*invitation.*variables" src/styles/invitation/_gallery.scss

# Build check
npm run build

# Lint check
npm run lint
```

**Commit after each component group**:

```bash
git add src/styles/invitation/
git commit -m "refactor(scss): migrate invitation components to token system

- Replace legacy variable imports with tokens
- Update variable references
- Remove unused imports

Affected: gallery, hero, quote, countdown, family"
```

---

## Phase 3: AssetRegistry Pattern Documentation (HIGH PRIORITY)

**Goal**: Create comprehensive documentation for adding new events to the AssetRegistry.

### 3.1 Create Documentation File

**Create**: `docs/ASSET_REGISTRY_GUIDE.md`

**Required Sections**:

1. **Overview**
    - Purpose of AssetRegistry
    - Benefits (type safety, centralized management, consistency)

2. **Event Asset Structure**

    ```typescript
    interface EventAssets {
    	hero: ImageAsset;
    	portrait: ImageAsset;
    	jardin: ImageAsset;
    	signature: ImageAsset;
    	gallery: ImageAsset[]; // 11-12 images
    	family?: ImageAsset; // Optional
    }
    ```

3. **Adding a New Event - Step by Step**

    **Step 1**: Create event directory

    ```bash
    mkdir -p src/assets/images/events/{event-slug}
    ```

    **Step 2**: Add images
    - hero.{webp,png,jpg}
    - portrait.{webp,png,jpg}
    - jardin.{webp,png,jpg}
    - signature.{webp,png,jpg}
    - gallery-01 through gallery-11.{webp,png,jpg}

    **Step 3**: Create barrel file (`src/assets/images/events/{event-slug}/index.ts`)

    ```typescript
    import hero from './hero.webp';
    import portrait from './portrait.webp';
    // ... other imports

    export const assets = {
    	hero,
    	portrait,
    	jardin,
    	signature,
    	gallery: [
    		gallery01,
    		gallery02, // ... gallery11
    	],
    };
    ```

    **Step 4**: Register in AssetRegistry

    ```typescript
    // src/lib/assets/AssetRegistry.ts
    import { assets as NewEventAssets } from '../../assets/images/events/{event-slug}';

    export const ImageRegistry: Registry = {
    	events: {
    		// ... existing events
    		'{event-slug}': mapEventAssets(NewEventAssets, 'Event Display Name'),
    	},
    };
    ```

4. **Validation Checklist**
    - [ ] All required images present
    - [ ] Barrel file exports correctly
    - [ ] Event registered in ImageRegistry
    - [ ] TypeScript compilation passes
    - [ ] Event renders correctly in invitation page

5. **Common Patterns**
    - Using `getEventAsset()` helper
    - Resolving assets in Astro pages
    - Handling optional family image

### 3.2 Update Existing Documentation

**Update**: `docs/ARCHITECTURE.md`

- Add AssetRegistry section under "Universal Asset Registry"
- Reference new guide

**Update**: `docs/ASSET_MANAGEMENT.md`

- Link to new guide
- Ensure consistency

### 3.3 Create Quick Reference

**Add to**: `.agent/PROJECT_CONVENTIONS.md`

```markdown
## Adding New Events

When adding a new event, follow the AssetRegistry pattern:

1. See `docs/ASSET_REGISTRY_GUIDE.md` for complete instructions
2. Use barrel exports in `src/assets/images/events/{slug}/index.ts`
3. Register in `src/lib/assets/AssetRegistry.ts`
```

---

## Phase 4: SCSS Nesting Depth Optimization (LOW PRIORITY)

**Goal**: Refactor SCSS to comply with 3-level maximum nesting convention.

### 4.1 Identify Violations

**High-priority files**:

- `src/styles/invitation/_hero.scss` (4-level nesting in envelope-gated reveal)
- `src/styles/invitation/_gallery.scss` (3-level, at limit)

### 4.2 Refactoring Strategy

**Pattern**: Flatten nested selectors using BEM methodology

**Example - Hero Envelope-Gated Reveal (4 levels)**:

**Before** (lines 248-276):

```scss
.event-theme-wrapper--sealed {
	.invitation-hero__content {
		opacity: 0;
		transform: translateY(40px);
		animation: none;

		.invitation-hero__label,
		.invitation-hero__title,
		.invitation-hero__details {
			opacity: 0;
			transform: translateY(20px);
			animation: none;
		}
	}
}
```

**After** (3 levels max):

```scss
.event-theme-wrapper--sealed {
	.invitation-hero__content {
		opacity: 0;
		transform: translateY(40px);
		animation: none;
	}

	.invitation-hero__label,
	.invitation-hero__title,
	.invitation-hero__details {
		opacity: 0;
		transform: translateY(20px);
		animation: none;
	}
}
```

### 4.3 Refactoring Steps

**Step 1**: Identify nested selectors >3 levels

```bash
# Manual inspection of hero.scss
grep -n "  \.  \.  \.  \." src/styles/invitation/_hero.scss
```

**Step 2**: Flatten by extracting child selectors

**Step 3**: Verify no visual regressions

- Check envelope reveal animation
- Check hover states
- Check responsive behavior

### 4.4 Verification

```bash
# Build check
npm run build

# Manual visual verification
# - Open invitation page
# - Test envelope reveal
# - Verify all animations work
```

---

## Phase 5: Linting & Enforcement

**Goal**: Prevent future technical debt accumulation.

### 5.1 Add stylelint Rule

**Create/Update**: `.stylelintrc.json`

```json
{
	"rules": {
		"max-nesting-depth": [
			3,
			{
				"ignoreAtRules": ["each", "for", "if", "else", "media", "supports"]
			}
		],
		"scss/at-use-no-unnamespaced": true
	}
}
```

### 5.2 Add Deprecated Import Warning

**Update**: `src/styles/birthday/_variables.scss`

```scss
@warn "birthday/variables is deprecated. Use @use '../tokens' as tokens instead.";
```

**Update**: `src/styles/invitation/_variables.scss`

```scss
@warn "invitation/variables is deprecated. Use @use '../tokens' as tokens instead.";
```

### 5.3 Update CI/CD

**Add to**: `.github/workflows/ci.yml` (if exists)

```yaml
- name: SCSS Lint
  run: npm run lint:scss
```

---

## Phase 6: Final Verification & Documentation

### 6.1 Run Full Test Suite

```bash
# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint

# Tests
npm test
```

### 6.2 Update Technical Debt Tracker

**Update**: `docs/plan/technical-debt.md`

```markdown
## High Priority

- [x] **Image Optimization Drift**: AssetRegistry pattern documented in
      `docs/ASSET_REGISTRY_GUIDE.md`
- [x] **Legacy SCSS Removal**: Migrated to token system (PR #XXX)

## Low Priority

- [x] **SCSS Nesting**: Refactored hero and gallery to comply with 3-level rule
```

### 6.3 Create Implementation Log Entry

**Update**: `docs/implementation-log.md`

```markdown
## 2026-02-XX: Technical Debt Remediation

### Legacy SCSS Migration

- Migrated 36 SCSS files from legacy variable imports to token system
- Removed deprecated `birthday/variables` and `invitation/variables` dependencies
- Updated variable references to use `tokens.$` prefix

### AssetRegistry Documentation

- Created `docs/ASSET_REGISTRY_GUIDE.md` with complete event addition guide
- Updated ARCHITECTURE.md and PROJECT_CONVENTIONS.md with references

### SCSS Nesting Refactoring

- Refactored `_hero.scss` envelope-gated reveal (4→3 levels)
- Verified all animations and interactions still functional

### Linting Enforcement

- Added stylelint max-nesting-depth rule (limit: 3)
- Added deprecation warnings to legacy variable files
```

### 6.4 Commit & Merge

```bash
# Final commit
git add .
git commit -m "refactor(debt): complete technical debt remediation

- Migrate 36 SCSS files to token system
- Document AssetRegistry pattern
- Refactor SCSS nesting depth
- Add linting enforcement

Closes: technical-debt-audit-2026-02-11"

# Push and create PR
git push origin debt-remediation-$(date +%Y%m%d)
```

---

## Critical Reflection

### Friction Points

1. **SCSS Migration Scope**
    - **Risk**: 36 files is a large surface area; may introduce regressions
    - **Mitigation**: Migrate in small batches (5-6 files per commit), verify build each time
    - **Fallback**: Easy rollback via git revert if issues arise

2. **Visual Regression Risk**
    - **Risk**: Token variables may have slightly different values than legacy ones
    - **Mitigation**: Compare computed styles before/after; use visual diff tools
    - **Testing**: Manual QA on invitation pages (hero, gallery, quote sections)

3. **AssetRegistry Documentation**
    - **Risk**: Developers may still bypass the pattern
    - **Mitigation**: Add code review checklist; add validation script
    - **Long-term**: Consider automated generation of barrel files

4. **Nesting Refactoring**
    - **Risk**: Flattening selectors may affect specificity and cascade
    - **Mitigation**: Maintain BEM naming; test envelope reveal thoroughly
    - **Priority**: Lower than migration; can be done incrementally

### Success Metrics

- [ ] Zero remaining `@use.*variables` imports (except tokens)
- [ ] All builds passing (npm run build)
- [ ] All linting passing (npm run lint)
- [ ] No visual regressions in invitation pages
- [ ] AssetRegistry guide created and linked
- [ ] stylelint nesting rule enforced

### Rollback Plan

If critical issues arise:

```bash
# Revert specific commit
git revert <commit-hash>

# Or hard reset to pre-remediation state
git reset --hard origin/main
```

---

## Agent Instruction

**When executing this workflow**:

1. **Start with Phase 1** - Verify current state before making changes
2. **Focus on Phase 2 first** - Legacy SCSS migration is highest impact
3. **Work in small batches** - 5-6 files per commit maximum
4. **Verify after each batch** - Build, lint, and visual check
5. **Document as you go** - Update implementation log incrementally
6. **Phase 3 & 4 can be parallel** - Documentation and nesting refactoring independent
7. **Phase 5 last** - Only add enforcement after all remediation complete
8. **Final Phase 6** - Comprehensive verification and merge

**Do NOT**:

- Migrate all 36 files in a single commit
- Skip verification steps
- Delete legacy variable files until all migrations confirmed
- Add linting rules before fixing existing violations

**Emergency Stop**: If build fails or visual regressions detected:

1. Stop migration immediately
2. Revert last commit
3. Report issue to user with specific file/problem
4. Do not proceed until resolved

// turbo
