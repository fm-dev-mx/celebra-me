---
description: Governance and consistency workflow for theme abstraction and documentation.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-02-14
---

# 🏛️ Workflow: Theme Architecture Governance

This workflow ensures that every invitation, demo, and landing page adheres to the 3-Layer Color
Architecture and strict section-based abstraction.

## 📌 Architectural Standards

1. **Strict Preset Isolation**: Presets (`presets/`) MUST only contain variable definitions. No CSS
   rules or section-specific nesting allowed.
2. **Section Abstraction**: Every UI section MUST have a corresponding theme file in `sections/`.
3. **Variant Independence**: Modifying one `[data-variant]` must never affect global components
   outside that variant.
4. **Source of Truth**: The `THEME_SYSTEM.md` must be updated whenever a new section or variant is
   added.

---

## 🏗️ Step 1: Staged Analysis (Scope Audit)

Analyze current staged changes for:

- [ ] Nested section styles in preset files.
- [ ] Global style leaks (modifying `.card`, `.btn` outside of a preset class).
- [ ] Inconsistencies between CSS variables and Design Tokens.

## 🏗️ Step 2: Section Abstraction

For every modified section:

- [ ] Verify existence of `src/styles/themes/sections/_<section>-theme.scss`.
- [ ] Ensure variant-specific styles are contained within `.section[data-variant='...']`.
- [ ] Use semantic tokens (e.g., `--color-surface-primary`) instead of hardcoded hex values.

## 🏗️ Step 3: Documentation & Sync

- [ ] Audit `docs/THEME_SYSTEM.md` for drift.
- [ ] Ensure all `sectionStyles` variants are documented.
- [ ] Sync Zod schemas in `src/content/config.ts` with new variants.

## 🏗️ Step 4: Remediation & Alignment

If violations are found during Step 1 or 2:

- [ ] Move nested styles from `presets/` to their respective `sections/` files.
- [ ] Replace hardcoded values with semantic tokens.
- [ ] Ensure all variants follow the `[data-variant]` pattern.

## 🏗️ Step 5: Final Validation & Commit

After alignment:

- [ ] Run full build/test suite if necessary.
- [ ] Stage only the files for one coherent ADU (no mixed-intent commits).
- [ ] Execute `.agent/workflows/governance/evergreen/gatekeeper-commit.md` (`--strict` for code
      changes, `--minimal` for doc-only updates).

---

## ✅ Verification Protocol

1. **Visual Regression**: Test the affected section across at least two different presets.
2. **Isolation Check**: Toggle between presets in the browser to ensure zero style bleeding.
3. **Linting**: Ensure no `!important` flags are used unless absolutely necessary for component
   overrides.

// turbo
