---
title: Landing Page Spacing Fix Plan
status: implemented
created: unknown
updated: 2026-05-31
---

# Landing Page Spacing Fix Plan

## Objective

Resolve overly tight spacing between landing page sections by applying consistent, semantic spacing
tokens aligned with the existing design system.

## Audit Findings

### 1. Existing Spacing System

- **System Tokens**: `$sys-spacing-*` (0.5rem increments, e.g., `sys-spacing-16 = 4rem`)
- **Semantic Tokens**:
  - `--spacing-section-gap`: Responsive `3rem` (mobile) → `4rem` (tablet) → `5rem` (desktop)
  - `--spacing-component-gap`: `1.5rem`
  - `--spacing-xl`: `2rem` (used for section padding in most sections)
- **Responsive Map**: Defined in `src/styles/tokens/_spacing.scss`

### 2. Root Causes of Tight Spacing

| Issue                                                                                                   | Impact                                    |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| No gap applied to `.landing-sections-wrapper` in `index.astro`                                          | Sections stack with 0 margin between them |
| Inconsistent section padding (e.g., `about-us` uses `clamp(3rem, 6vh, 6rem)` instead of `--spacing-xl`) | Uneven vertical rhythm                    |
| `min-height: 100vh` + scroll snap in `_landing-page.scss` compresses section content                    | Leaves no room for natural gaps           |
| Obsolete `.animate-icons` wrapper in `index.astro` (no corresponding styles)                            | Redundant DOM node with no effect         |

### 3. Obsolete/Redundant Code

- `.animate-icons` wrapper around Services/AboutUs in `src/pages/index.astro` (lines 20-21)
- Conflicting `min-height` optimization in `_about-us.scss` (line 522) that overrides standard
  section padding

## Recommended Spacing Values

| Section Transition                  | Token to Use                   | Mobile | Tablet | Desktop |
| ----------------------------------- | ------------------------------ | ------ | ------ | ------- |
| Between all sections                | `var(--spacing-section-gap)`   | 3rem   | 4rem   | 5rem    |
| Section internal top/bottom padding | `var(--spacing-xl)`            | 2rem   | 2rem   | 2rem    |
| Component gaps within sections      | `var(--spacing-component-gap)` | 1.5rem | 1.5rem | 1.5rem  |

## Implementation Completed

### 1. Added section gap to wrapper

- Updated `.landing-sections-wrapper` in `src/styles/home/_landing-page.scss` to use
  `display: flex; flex-direction: column; gap: var(--spacing-section-gap);`

### 2. Standardized section padding

- Updated `about-us` section to use `padding: clamp(var(--spacing-12), 6vh, var(--spacing-24)) 0`
  for responsive spacing
- Added `padding: var(--spacing-xl) 0` to `.testimonials` root in `_testimonials.scss`

### 3. Removed redundant code

- Removed `.animate-icons` wrapper from `src/pages/index.astro`
- Removed conflicting `min-height` optimization in `_about-us.scss`

### 4. Adjusted scroll snap behavior

- Updated `_landing-page.scss` to set `min-height: auto` for sections and added
  `padding: var(--spacing-xl) 0`

### 5. Mobile spacing fixes for about-us section

- Restored responsive padding with `clamp(var(--spacing-12), 6vh, var(--spacing-24))` (mobile: 3rem
  min)
- Added responsive gap in `&__grid` with `clamp(var(--spacing-8), 5vh, var(--spacing-16))` for
  better mobile separation
- Improved values grid spacing on mobile: `gap: var(--spacing-6)` (1.5rem) for single column
- Added `margin-top: var(--spacing-md)` to CTA button for better separation from description

## Verification Results

- ✅ All 4 e2e landing page tests passed
- ✅ Linting passed (only pre-existing warnings unrelated to changes)
- ✅ TypeScript type-check passed
- ⚠️ Build failed with EPERM symlink error (Windows permission issue with Vercel adapter, unrelated
  to spacing changes)

## Files Modified

1. `src/styles/home/_landing-page.scss`
2. `src/pages/index.astro`
3. `src/styles/home/_about-us.scss`
4. `src/styles/home/_testimonials.scss`
