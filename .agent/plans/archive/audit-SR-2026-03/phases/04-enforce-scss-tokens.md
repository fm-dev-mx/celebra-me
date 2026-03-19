# Phase 04: Enforce SCSS Semantic Tokens in Source Logic

**Completion:** 100% | **Status:** COMPLETED

## 🎯 Objective

Replace hardcoded hex values in `.ts` and `.astro` files with standardized CSS variable consumption to enforce the 3-Layer Color Architecture.

## 🛠️ Actions

1. **Target: Dashboard MFA**:
    - File: `src/pages/dashboard/mfa-setup.astro` (lines 73, 79, 140, 141, 146).
    - Map: `#d4af37` -> `var(--color-accent)`, `#f8f6ef` -> `var(--color-bg)`.
2. **Target: Invitation Presenter**:
    - File: `src/lib/invitation/page-data.ts`.
    - Map: `#333`, `#090a0f`, `#d4af37` to their respective semantic tokens.
3. **Logic Update**: Ensure `buildWrapperStyle` uses tokens as fallbacks instead of hardcoded strings.

## ✅ Verification

- **Scan**: Grep for `#[0-9a-fA-F]` in `src/` (excluding `_primitives.scss`) should return zero results.
