---
description: ARCHIVED - Consolidated into landing-page-maintenance.md
archived: 2026-02-12
replacement: .agent/workflows/docs/landing-page-maintenance.md
---

# [ARCHIVED] Workflow: Landing Page Remediation

> **⚠️ THIS WORKFLOW HAS BEEN ARCHIVED**
>
> **Date**: 2026-02-12  
> **Reason**: Consolidated with `landing-page-regression-recovery.md` into unified
> `landing-page-maintenance.md`  
> **Replacement**: Use `.agent/workflows/docs/landing-page-maintenance.md` with `--remediation` mode

---

## Original Content (Preserved for Reference)

## 💎 Workflow: Landing Page Remediation

1. **Phase 0: Technical Debt Audit & Scope Lock**
    - [MODIFY] Scan `src/styles/home/` for `!important` usage.
    - Identify direct mappings to `tokens.$base-*` that should be Semantic `var(--landing-*)`.
    - [DELETE] Remove redundant `<style is:global>` blocks in `.astro` components (specifically
      `HomeHeader.astro`).
    - Validate contrast for Header desktop buttons and "brincos" (abrupt jumps) in scroll.

2. **Phase 1: Scroll Smoothing**
    - [MODIFY] `src/pages/index.astro`: Change `scroll-snap-type: y mandatory` to
      `scroll-snap-type: y proximity` or remove if sections are too varied in height.
    - Verify that sectional navigation still feels intentional but not forced.

3. **Phase 2: Header Premium Polish & Brand Identity**
    - [MODIFY] `src/styles/home/_home-header.scss`: Apply Jewelry Box aesthetics (subtle
      glassmorphism, metallic CTA accents, refined transitions).
    - [MODIFY] `src/components/home/HomeHeader.astro`: Consolidate logo rendering to use
      `Logo.astro` correctly, avoiding duplicated `<img>` tags.
    - [MODIFY] `src/components/ui/Logo.astro`: Improve variant strategy to avoid filter-based
      visibility hacks.

4. **Phase 3: Section Normalization (Contact, Pricing, FAQ)**
    - [MODIFY] `src/styles/home/_contact.scss`: Remove "hacky" overrides and synchronize with
      3-Layer Color Architecture.
    - [MODIFY] `src/styles/home/_pricing.scss` & `_faq.scss`: Audit and ensure they use
      `--landing-*` tokens.
    - Synchronize all with `docs/architecture/color-system.md`.

5. **Phase 4: Footer Identity Recovery**
    - [MODIFY] `src/components/home/Footer.astro`: Ensure the Logo is legible against the dark
      background without manual overrides.

6. **Verification & Delivery**
    - // turbo
    - Run `pnpm lint` and `pnpm check`.
    - Run `grep -r "!important" src/styles/home/` to ensure debt reduction.
    - Verify zero inline styles (`style="..."`) across landing components.
    - Perform a manual scroll test and accessibility contrast check (WCAG 2.1 AA).

// turbo

### Critical Reflection

> [!IMPORTANT] The reliance on `!important` in `HomeHeader.astro` and `_contact.scss` indicates a
> collision between global styles and local overrides. The remediation MUST move these to the theme
> layer (`presets/_elegant.scss`) to maintain a clean cascade.
