---
description: Governance and consistency workflow for theme abstraction and documentation.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-02-15
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
4. **Source of Truth**: `docs/domains/theme/architecture.md` must be updated whenever a new section
   or variant is added.
5. **Data-Driven Text Isolation**: Theme-specific labels (RSVP inputs, Hero descriptors) MUST live
   in the event JSON, not hardcoded in Astro or React components.

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

- [ ] Audit `docs/domains/theme/architecture.md` for drift.
- [ ] Ensure all `sectionStyles` variants are documented.
- [ ] Sync Zod schemas in `src/content/config.ts` (include `labels` for RSVP and Tier 3 WhatsApp
      fields).

> **Source of Truth Path:** `docs/domains/theme/architecture.md` is the canonical theme-system
> document for the current repository layout.

## 🏗️ Step 4: Remediation & Alignment

If violations are found during Step 1 or 2:

- [ ] Move nested styles from `presets/` to their respective `sections/` files.
- [ ] Replace hardcoded values with semantic tokens.
- [ ] Migrate hardcoded text/labels to event JSON files via `sectionStyles`.
- [ ] Ensure all variants follow the `[data-variant]` pattern.

## 🏗️ Step 5: Final Validation & Commit

After alignment:

- [ ] Run full build/test suite if necessary.
- [ ] Stage only the files for one coherent ADU (no mixed-intent commits).
- [ ] Execute `.agent/workflows/gatekeeper-commit.md` (`--mode strict` for code changes,
      `--mode quick` for doc-only updates).
- [ ] Set governance phase explicitly when needed (`--enforce-phase 1|2|3`) to match rollout policy.

---

## ✅ Verification Protocol

1. **Visual Regression**: Test the affected section across at least two different presets.
2. **Isolation Check**: Toggle between presets in the browser to ensure zero style bleeding.
3. **Linting**: Ensure no `!important` flags are used unless absolutely necessary for component
   overrides.

// turbo
