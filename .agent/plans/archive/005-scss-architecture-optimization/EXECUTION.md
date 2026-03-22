# Execution Prompt: Plan 005 - SCSS Architectural Optimization

## Context

Execute Plan 005 to optimize Celebra-me's SCSS architecture. This plan addresses redundancies, token
inconsistencies, and hardcoded values identified during the comprehensive audit.

**Plan Location:** `.agent/plans/005-scss-architecture-optimization/`

**Reference Files:**

- `README.md` - Plan overview and objectives
- `manifest.json` - Phase tracking
- `commit-map.json` - Commit units (4 units defined)
- `phases/01-redundancy-elimination.md`
- `phases/02-token-unification.md`
- `phases/03-hardcoded-value-elimination.md`
- `phases/04-pattern-standardization.md`

## Execution Order

Execute phases sequentially. Each phase must pass verification before proceeding.

---

## Phase 01: Redundancy Elimination

**Objective:** Remove duplicate variable definitions across `_mixins.scss`, `_variables.scss`, and
`_functions.scss`.

### Duplicate Variables to Consolidate

| Variable                    | Currently In                                                             | Consolidate To    |
| --------------------------- | ------------------------------------------------------------------------ | ----------------- |
| `$transitions-by-component` | `_mixins.scss:8-45`, `_variables.scss:85-122`                            | `_variables.scss` |
| `$breakpoints`              | `_mixins.scss:46-53`, `_variables.scss:127-134`, `_functions.scss:14-21` | `_variables.scss` |
| `$border-radius`            | `_variables.scss:137-145`, `_functions.scss:32-40`                       | `_variables.scss` |
| `$z-index`                  | `_variables.scss:147-157`, `_functions.scss:22-31`                       | `_variables.scss` |
| `$backdrop-blurs`           | `_variables.scss:44-50`, `_functions.scss:7-13`                          | `_variables.scss` |

### Implementation Steps

1. **Update `_variables.scss`:**
   - Verify it contains ALL canonical definitions
   - Ensure `$transitions-by-component`, `$breakpoints`, `$border-radius`, `$z-index`,
     `$backdrop-blurs` are present

2. **Update `_mixins.scss`:**
   - Remove local copies of `$transitions-by-component` and `$breakpoints`
   - Add `@use 'variables' as vars;`
   - Replace all local references with `vars.$variable-name`

3. **Update `_functions.scss`:**
   - Remove local copies of `$breakpoints`, `$border-radius`, `$z-index`, `$backdrop-blurs`
   - Add `@use 'variables' as vars;`
   - Add `@use 'tokens' as tokens;` for color palette
   - Replace all local references with `vars.$variable-name` or `tokens.$variable-name`

### Files to Modify

```
src/styles/global/_variables.scss   - KEEP all canonical definitions
src/styles/global/_mixins.scss      - REMOVE duplicates, add @use
src/styles/global/_functions.scss   - REMOVE duplicates, add @use
```

### Verification

1. Run `npm run build` or `pnpm build`
2. Check for SCSS compilation errors
3. Verify all responsive breakpoints still work
4. Test invitation page renders correctly

### Commit Unit

**ID:** `redundancy-elimination`  
**Header:** `refactor(ui): eliminate duplicate Sass variable definitions`  
**Phase:** `03-redundancy-elimination`

---

## Phase 02: Token Unification

**Objective:** Consolidate section-specific CSS tokens into canonical contracts.

### Token Contract Structure

Create dedicated token files for each section:

```
src/styles/themes/sections/
├── _tokens.scss           # Base section tokens (EXISTING - enhance)
├── _family-tokens.scss    # NEW - Family section tokens
├── _gallery-tokens.scss   # NEW - Gallery section tokens
├── _rsvp-tokens.scss      # NEW - RSVP section tokens
└── _hero-tokens.scss      # NEW - Hero section tokens
```

### Implementation Steps

1. **Read existing files to understand current tokens:**
   - `themes/sections/_tokens.scss`
   - `themes/sections/_family-theme.scss`
   - `themes/sections/_gallery-theme.scss`
   - `invitation/_family.scss`
   - `invitation/_gallery.scss`

2. **Create `_family-tokens.scss`:**

   ```scss
   :root {
     --family-bg: var(--color-surface-primary);
     --family-panel-bg: rgb(var(--color-surface-primary-rgb), 0.7);
     --family-media-bg: rgb(17 12 9);
     --family-border: rgb(var(--color-text-primary-rgb), 0.16);
     --family-divider: rgb(var(--color-text-primary-rgb), 0.2);
     --family-name-font: var(--font-display);
     --family-name-size: clamp(1.3rem, 3vw, 1.9rem);
     --family-meta-size: 0.72rem;
     --family-meta-letter-spacing: 0.18em;
     --family-header-margin: clamp(2.5rem, 5vw, 4rem);
     --family-group-padding-block: clamp(1rem, 2.1vw, 1.4rem);
     --family-shadow: 0 18px 40px rgb(0 0 0 / 12%);
     --family-media-filter: none;
   }
   ```

3. **Create `_gallery-tokens.scss`:**

   ```scss
   :root {
     --gallery-section-padding-block: clamp(5rem, 9vw, 8rem);
     --gallery-section-bg: linear-gradient(
       to bottom,
       transparent,
       rgb(var(--color-surface-primary-rgb, 255, 255, 255), 0.3)
     );
     --gallery-container-max-width: 1200px;
     --gallery-title-font: var(--font-display);
     --gallery-title-size: clamp(2.2rem, 5vw, 3.5rem);
     --gallery-item-radius: 12px;
     --gallery-item-bg: rgb(var(--color-surface-primary-rgb, 255, 255, 255), 0.8);
     --gallery-item-shadow: 0 6px 18px rgb(0 0 0 / 7%);
   }
   ```

4. **Create `_rsvp-tokens.scss`:**

   ```scss
   :root {
     --rsvp-radius-card: 24px;
     --rsvp-radius-field: 12px;
     --rsvp-label-color: var(--color-text-secondary);
     --rsvp-field-bg: rgb(var(--color-surface-primary-rgb), 0.5);
     --rsvp-field-border: var(--color-glass-border);
     --rsvp-radio-bg: rgb(var(--color-surface-primary-rgb), 0.45);
     --rsvp-button-shadow-rest: 0 5px 16px rgb(var(--color-text-primary-rgb), 0.24);
   }
   ```

5. **Create `_hero-tokens.scss`:**

   ```scss
   :root {
     --hero-overlay: rgb(0 0 0 / 40%);
     --hero-scroll-indicator-color: rgb(255 255 255 / 70%);
     --hero-overlay-gradient: linear-gradient(
       to bottom,
       transparent 0%,
       rgb(0 0 0 / 20%) 50%,
       rgb(0 0 0 / 60%) 100%
     );
   }
   ```

6. **Update `_tokens.scss` index:**

   ```scss
   @forward 'family-tokens';
   @forward 'gallery-tokens';
   @forward 'rsvp-tokens';
   @forward 'hero-tokens';
   ```

7. **Update component files to use tokens:**
   - Replace inline token definitions with references to new token files
   - Ensure CSS variable fallbacks to semantic tokens

### Files to Create/Modify

```
src/styles/themes/sections/_family-tokens.scss    - CREATE
src/styles/themes/sections/_gallery-tokens.scss   - CREATE
src/styles/themes/sections/_rsvp-tokens.scss      - CREATE
src/styles/themes/sections/_hero-tokens.scss     - CREATE
src/styles/themes/sections/_tokens.scss          - UPDATE (add @forward)
src/styles/themes/sections/_index.scss          - UPDATE (export new tokens)
```

### Verification

1. All sections render with default tokens
2. Theme presets can override tokens correctly
3. No inline token definitions remain in component files

### Commit Units

**ID:** `token-contract-definition`  
**Header:** `refactor(ui): define canonical section token contract`  
**Phase:** `02-token-unification`

**ID:** `theme-standardization`  
**Header:** `refactor(ui): standardize section themes using canonical tokens`  
**Phase:** `02-token-unification`

---

## Phase 03: Hardcoded Value Elimination

**Objective:** Replace raw CSS values (hex, rgb, rgba) with semantic token references.

### Hardcoded Values to Fix

| File                             | Hardcoded Value                  | Replace With                                |
| -------------------------------- | -------------------------------- | ------------------------------------------- |
| `invitation/_hero.scss:38-44`    | `rgb(0 0 0 / 40%)`               | `--hero-overlay`                            |
| `invitation/_hero.scss:152`      | `rgb(255 255 255 / 70%)`         | `--hero-scroll-indicator-color`             |
| `invitation/_family.scss:108`    | `rgb(17 12 9)`                   | `--family-media-bg`                         |
| `invitation/_rsvp.scss:231-232`  | `rgb(255, 77, 77)`               | `--rsvp-error-bg`                           |
| `dashboard/_shell.scss:6-7`      | `rgb(212 175 55 / 8%)`           | `rgb(var(--color-action-accent-rgb), 0.08)` |
| `dashboard/_shell.scss:86,98-99` | `rgb(255 255 255 / 70%)`, `#fff` | `--color-white`                             |

### Implementation Steps

1. **Read and identify all hardcoded values** in:
   - `src/styles/invitation/_hero.scss`
   - `src/styles/invitation/_family.scss`
   - `src/styles/invitation/_rsvp.scss`
   - `src/styles/dashboard/_shell.scss`

2. **Replace each hardcoded value** with token reference:

   **Before:**

   ```scss
   background: rgb(0 0 0 / 40%);
   ```

   **After:**

   ```scss
   background: var(--hero-overlay, rgb(0 0 0 / 40%));
   ```

3. **Add missing semantic tokens** to `tokens/_semantic.scss` if needed:
   ```scss
   $color-white: var(--color-white, 255 255 255);
   $rsvp-error-bg: var(--rsvp-error-bg, rgb(217 48 37 / 10%));
   ```

### Files to Modify

```
src/styles/tokens/_semantic.scss           - ADD missing tokens
src/styles/invitation/_hero.scss           - REPLACE overlay, scroll colors
src/styles/invitation/_family.scss        - REPLACE media background
src/styles/invitation/_rsvp.scss          - STANDARDIZE error colors
src/styles/dashboard/_shell.scss           - REPLACE gradient colors
```

### Verification

1. Visual inspection of all affected components
2. Verify error states display correctly
3. Test dashboard theming
4. Build completes without errors

### Commit Unit

**ID:** `hardcoded-value-elimination`  
**Header:** `fix(ui): eliminate hardcoded CSS values in components`  
**Phase:** `03-hardcoded-value-elimination`

---

## Phase 04: Pattern Standardization

**Objective:** Enforce consistent SCSS patterns and create documentation.

### Implementation Steps

1. **Standardize import patterns** across all component files:

   ```scss
   // CORRECT
   @use '../tokens' as tokens;
   @use '../global/mixins' as mixins;

   // WRONG (remove wildcards)
   @use '../tokens' as *;
   ```

2. **Enforce CSS variable usage** in components:

   ```scss
   // CORRECT
   background: var(--color-surface-primary);

   // WRONG
   background: tokens.$color-surface-primary;
   ```

3. **Create `docs/STYLEGUIDE.md`**:
   - Token usage rules
   - Naming conventions
   - File organization
   - Import patterns
   - Component templates
   - Anti-patterns

4. **Update or create `.stylelintrc.json`**:
   ```json
   {
     "extends": "stylelint-config-standard-scss",
     "rules": {
       "color-no-hex": true,
       "scss/dollar-variable-pattern": "^[a-z]+-[a-z]+(-[a-z]+)*$",
       "scss/at-rule-no-unknown": true
     }
   }
   ```

### Files to Create/Modify

```
docs/STYLEGUIDE.md                         - CREATE
.stylelintrc.json                          - CREATE or UPDATE
All affected SCSS files                    - REFACTOR to match patterns
```

### Verification

1. All SCSS files pass linting
2. Styleguide accurately reflects codebase
3. Consistent import patterns across all files

### Commit Unit

**ID:** `pattern-standardization`  
**Header:** `docs(ui): standardize SCSS patterns and create styleguide`  
**Phase:** `04-pattern-standardization`

---

## Governance Compliance

### Before Each Commit

1. Run validation: `pnpm gatekeeper:plans:validate -- --plan 005-scss-architecture-optimization`
2. Run inspect: `pnpm gatekeeper:workflow:inspect -- --plan 005-scss-architecture-optimization`
3. Verify unit alignment
4. Update CHANGELOG.md with completed items

### After Each Phase

1. Mark phase as `COMPLETED` in `manifest.json`
2. Update `phases/*/phases/*.md` with verification results
3. Add notes to CHANGELOG.md

### After All Phases

1. Update `manifest.json` status to `COMPLETED`
2. Create `post-mortem.md` if needed
3. Archive plan: move to `.agent/plans/archive/YYYY-MM/005-scss-architecture-optimization/`

---

## Success Criteria

| Metric                         | Before | After |
| ------------------------------ | ------ | ----- |
| Duplicate variable definitions | 6      | 0     |
| Hardcoded color values         | 15+    | 0     |
| Import pattern inconsistencies | 8+     | 0     |
| Token Architecture Score       | 7/10   | 9/10  |
| Naming Consistency Score       | 5/10   | 9/10  |

---

## Execution Command

```bash
# Validate plan readiness
pnpm gatekeeper:plans:validate -- --plan 005-scss-architecture-optimization

# Execute each unit sequentially
# Unit 1: redundancy-elimination
node .agent/governance/bin/gatekeeper-workflow.mjs stage --plan 005-scss-architecture-optimization --unit redundancy-elimination
# ... verify, commit ...

# Unit 2: token-contract-definition
# Unit 3: theme-standardization
# Unit 4: hardcoded-value-elimination
# Unit 5: pattern-standardization
```
