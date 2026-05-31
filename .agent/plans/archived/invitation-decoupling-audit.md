---
title: Invitation and Demo Decoupling Audit
status: superseded
created: unknown
updated: 2026-05-31
superseded_by: sacred-keepsake-theme-decoupling
---

# Invitation and Demo Decoupling Audit

> Superseded for the Sacred Keepsake theme work by
> `.agent/plans/sacred-keepsake-theme-decoupling.md`. The older broad audit remains historical
> context only and should not be read as proof that every live event theme is already decoupled.

## 1. Summary

This document summarizes the findings from auditing the "Invitations" and "Demos" modules within
Celebra-me. The goal was to identify technical debt, verify the architectural standards (Jewelry Box
and 3-Layer Color Architecture), and plan a decoupling strategy.

## 2. Findings

Based on the architectural constraints set in `docs/core/architecture.md`, the audit reveals a
remarkably healthy and decoupled state:

- **Unified Routing over Duplication**: Both live events and demos share a single dynamic route:
  `src/pages/[eventType]/[slug].astro`.
- **Data Isolation**: Demos are strictly isolated in `src/content/event-demos/**/*.json` files,
  preventing hardcoded coupling in the Astro pages.
- **Component Reusability vs. Coupling**: The `src/components/invitation/` directory (e.g.
  `Hero.astro`, `EnvelopeReveal.astro`) is universally shared. The appearance logic is decoupled via
  the `variant` and `layoutVariant` props, correctly implementing the Jewelry Box theme contract.
- **No Orphaned Logic**: Scans for deprecated English `/invitation` routes in API and Pages yielded
  zero results, confirming the ecosystem has standardized on `/api/invitacion`.

## 3. Constraints & Technical Blockers

- **Strict Read-Only Directives**: The architecture manual explicitly discourages refactoring driven
  solely by aesthetics without reducing actual complexity.
- **Style Isolation Leakage Risk**: Modifying shared UI layout blocks directly impacts all
  invitations. New theme structures must be driven exclusively via `src/lib/theme/theme-contract.ts`
  rather than overriding CSS globally.

## 4. Step-by-Step Roadmap

Since the foundational architecture actively enforces decoupled logic, the roadmap focuses on
guaranteeing long-term isolation without rewriting the core runtime.

### Phase 1: CSS and Variant Audit

1. **Scope the `src/styles/events/*.scss` overrides**: Ensure there are no cross-contaminations
   where one demo's `.scss` bleeds globally instead of wrapping its logic in `.event--<slug>`
   selectors.
2. **Review Theme Variant Contracts**: Ensure that demos exclusively rely on registered
   `ThemePreset` variants.

### Phase 2: Component Hardening

1. **Audit Global Selectors in `src/components/invitation/`**: Move any highly specific, demo-only
   overrides from local `Hero.astro` components into the `theme-contract.ts` or slug-specific
   `src/styles/events/`.
2. **Remove Unused Overrides**: Check for `.scss` files that reference events or demos no longer
   present in the content collections.

## 5. Verification Plan

- **Isolation Check**: Render all JSON files in `src/content/event-demos/`. Modifying
  `demo-bodas.json` locally should have zero regression on live Boda invitations.
- **CSS Isolation Validation**: Run `pnpm run ci` and manually search `src/styles/events/*` to
  confirm that every file begins exclusively with matching slug scope selectors (e.g.
  `.event--demo-bodas`).
- **End-to-End Tests**: Run existing Playwright suites representing standard user flows for demos vs
  live invitations.
