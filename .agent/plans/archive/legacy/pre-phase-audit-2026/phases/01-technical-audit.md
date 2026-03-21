# Phase 01: Technical Audit & MVI Proposals

## 🎯 Audit Overview

This audit evaluates the codebase against the project's core architectural pillars:

- **Astro Patterns**: Content collections & BFF decoupling.
- **Frontend Design**: 'Jewelry Box' aesthetic & 3-Layer Color Architecture.
- **Backend Engineering**: API modularity & validation.

---

## 1. Monolithic & High-Coupling Service Logic

- **Findings**: `src/lib/rsvp/service.ts` (>1200 lines) and `src/lib/rsvp/repository.ts` (>800
  lines).
- **Root Cause**: Business logic for multiple domains (RSVP, Guest Management, Audit, Link
  Generation) is consolidated into single "God Files".
- **Impact**: High maintenance risk; side effects in RSVP logic can break Audit or Auth flows; slow
  developer onboarding due to file complexity.
- **Minimalist Solution (MVI)**:
  - **Functional Decomposition**: Split `service.ts` into domain-specific modules:
    `src/lib/rsvp/services/guest-invitation.service.ts`,
    `src/lib/rsvp/services/rsvp-submission.service.ts`, and
    `src/lib/rsvp/services/audit-logger.service.ts`.
  - **Thin Aggregator**: Maintain the original `service.ts` as a set of re-exports to avoid breaking
    changes in the short term.

## 2. Content Schema Bloat & Residual Technical Debt

- **Findings**: `src/content/config.ts` contains massive unions and explicitly marked "Legacy
  support" fields for RSVP labels.
- **Root Cause**: Rapid iteration without a formal deprecation/cleanup phase; centralized schema
  becoming a bottleneck.
- **Impact**: Increased build times for schema validation; cognitive overhead when adding new event
  features; risk of using deprecated fields.
- **Minimalist Solution (MVI)**:
  - **Schema Modularization**: Move Zod sub-schemas (Hero, Location, RSVP) into separate files under
    `src/lib/schemas/content/`.
  - **Governance Tags**: Mark legacy fields with `@deprecated` JSDoc tags and move them to a nested
    `legacy` object in the schema to make their status explicit.

## 3. BFF Pattern Erosion (Page Logic Coupling)

- **Findings**: `src/pages/[eventType]/[slug].astro` performs complex view-model derivation (e.g.,
  manual CSS variable binding, render plan construction).
- **Root Cause**: Lack of a dedicated "Presenter" layer between the raw content data and the Astro
  components.
- **Impact**: Logic duplication across [slug] and [shortId] pages; difficulty in testing
  presentation logic without full page rendering.
- **Minimalist Solution (MVI)**:
  - **Presenter Layer**: Move all presentation-specific logic (CSS variable mapping, section
    visibility logic, guest context normalization) into a
    `src/lib/invitation/page-data.ts`.
  - **Dumb Pages**: Refactor `.astro` pages to simply call the presenter and pass the resulting
    "View Model" to components.

## 4. Permissive Asset Governance (Type-Safety Risk)

- **Findings**: `AssetSchema` allows any string starting with `/` or valid URLs, bypassing strict
  `AssetRegistry` validation.
- **Root Cause**: Need for flexibility (external images) conflicting with the rigid internal
  registry.
- **Impact**: Broken images in production if internal assets are mistyped; "Cheap" feel if
  unoptimized external images are used as hero assets.
- **Minimalist Solution (MVI)**:
  - **Strict Discriminators**: Refactor `AssetSchema` to use a discriminated union between
    `InternalAsset` (strict enum from registry) and `ExternalAsset` (URL via Zod).
  - **Automated Registry**: Implement a small script/hook that ensures any file added to
    `src/assets/images/events` is automatically suggested for the registry.

## 5. Design System Implementation Drift

- **Findings**: Use of `define:vars` and hardcoded hex values in complex components (e.g.,
  `EnvelopeReveal`) instead of purely relying on the 3-Layer Color Architecture tokens.
- **Root Cause**: Complexity of the 'Jewelry Box' aesthetic requiring micro-adjustments that haven't
  been tokenized yet.
- **Impact**: Difficult to globally update the "Gold" or "Premium" feel without touching dozens of
  files; visual inconsistencies between different event themes.
- **Minimalist Solution (MVI)**:
  - **Token Audit & Expansion**: Extend `_semantic.scss` to include specific "Jewelry" tokens (e.g.,
    `$color-premium-glow`, `$color-wax-seal-inner`).
  - **Variable Enforcement**: Replace component-level `define:vars` with classes that toggle
    state-specific semantic variables (e.g.,
    `.is-sealed { --surface: var(--color-surface-dark); }`).

---

## 📅 Strategic Remediation Roadmap

The findings from this audit have been decomposed into executable phases:

1.  **[Phase 02: Service Decomposition](./02-service-decomposition.md)** — Addresses Finding #1.
2.  **[Phase 03: Schema Modularization](./03-schema-modularization.md)** — Addresses Finding #2.
3.  **[Phase 04: Presenter Pattern](./04-presenter-implementation.md)** — Addresses Finding #3.
4.  **[Phase 05: Asset Hardening](./05-asset-hardening.md)** — Addresses Finding #4.
5.  **[Phase 06: Design System Sync](./06-design-system-sync.md)** — Addresses Finding #5.

---

_Audit Completed on 2026-03-16 — Ready for transition to Phase 02._

## 🏆 Success Criteria

- **Deliverables**: This phase delivers a complete audit report with 5 MVI proposals.
- **Validation**: All findings documented with root cause analysis and minimal viable solutions.
