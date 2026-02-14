---
description:
    Comprehensive technical audit for the "Gerardo" (Luxury Hacienda) invitation. Evaluates
    implementation quality, architectural alignment, and system consistency.
lifecycle: task-open
domain: audits
owner: ux-audit
last_reviewed: 2026-02-14
---

# 🔍 Workflow: Technical Audit - Gerardo 60th Anniversary

## Objective

Execute a deep technical audit of the `cumple-60-gerardo` invitation to assess implementation
quality, architectural integrity, and adherence to system-wide conventions. This is a
**discovery-only** workflow; no changes should be applied.

## Mandatory Constraints

- **Read-Only**: Do not modify code or execute refactors.
- **Evidence-Based**: Every finding must be backed by file paths and line numbers.
- **No Assumptions**: If visibility is limited, mark as "unverified" rather than "likely."
- **Focus**: Maintainability, build stability, and Vercel compatibility.
- **Language**: English for logic and reporting; Spanish for UI/Copy findings.

## Sources of Truth

1. **Source Code**: Direct analysis of the repository (Primary).
2. `docs/ARCHITECTURE.md`: Core structural rules.
3. `docs/THEME_SYSTEM.md`: Theme abstraction standards.
4. `src/content/config.ts`: Schema definition.
5. `src/content/events/cumple-60-gerardo.json`: Event data.
6. `src/styles/themes/luxury-hacienda/`: Theme-specific styles.

---

## Phase 0: Scope Lock & Baseline

**Goal**: Define the technical surface area for the audit.

**Steps**:

1. Identify all files specific to the Gerardo invitation:
    - Content: `src/content/events/cumple-60-gerardo.json`
    - Assets: `public/assets/images/gerardo/` (or equivalent)
    - Specialized components: `src/components/invitation/gerardo/`
2. Map shared dependencies:
    - Shared invitation components (`src/components/invitation/common/`).
    - Theme presets and variables.
3. Confirm rendering strategy (e.g., `prerender: true`).

**Expected Output**: An "Inventory List" of files and components to be audited.

---

## Phase 1: Architecture & Boundaries

**Goal**: Verify alignment with the decoupled architecture.

**Steps**:

1. **Server/Client Separation**: Check if logic that should be server-side is leaking into client
   islands.
2. **Island Optimization**: Audit `client:*` directives. Are they necessary for the specific
   component?
3. **Data Mapping**: Validate how JSON data is passed to Astro components vs. React islands.
4. **Vercel Compatibility**: Check for runtime dependencies that might fail during build-time SSR.

**Verification Commands**:

```bash
# Check for client islands
rg "client:" src/pages/invitation/[slug].astro
# Identify inline scripts
rg "<script>" src/components/invitation/gerardo
```

---

## Phase 2: Conventions & Design Tokens

**Goal**: Check adherence to the 3-Layer Color Architecture and Naming Standards.

**Steps**:

1. **Styling**: Detect hardcoded hex/HSL values. Verify usage of `var(--token-name)`.
2. **Asset Management**: Check if assets are referenced via the `AssetRegistry` or hardcoded paths.
3. **Naming**: Validate BEM conventions in SCSS and PascalCase for components.
4. **TypeScript**: Search for `any` types, missing interfaces, or type debt.

**Verification Commands**:

```bash
# Find hardcoded colors
rg "#[0-9a-fA-F]{3,6}|rgba?\(|hsla?\(" src/styles/themes/luxury-hacienda/
# Find 'any' types
rg ": any" src/**/*.ts*
```

---

## Phase 3: Code Quality & Technical Debt

**Goal**: Identify code smells and maintenance risks.

**Steps**:

1. **Duplication**: Identify logic or styles copied from other invitations that should be
   abstracted.
2. **Dead Code**: Find unused props, commented-out sections, or obsolete functions.
3. **Complexity**: Spot components with too many responsibilities (mixed UI and logic).
4. **Consistency**: Compare implementation against `ARCHITECTURE.md` patterns.

---

## Phase 4: Performance & UX Polish

**Goal**: Assess the "Luxury Hacienda" aesthetic and load performance.

**Steps**:

1. **Asset Weight**: Check image sizes. Are they optimized via `astro:assets`?
2. **Hydration Cost**: Measure the impact of React islands on PageSpeed/TBT.
3. **Accessibility**: Verify `aria-label` on interactive elements and `alt` text on images.
4. **Motion**: Ensure animations follow the "premium" easing patterns (no jarring transitions).

---

## Phase 5: Consolidation & Remediation Plan

**Goal**: Generate a prioritized report.

**Required Report Format**:

1. **Executive Summary**:
    - Quality Level: `High | Medium | Low`
    - Critical Risks.
    - Urgency Level.
2. **Detailed Findings** (Categorized by Phase):
    - `[ID]` | `[File:Line]` | `[Severity]` | `[Description]`
3. **Prioritized Remediation Plan (DO NOT EXECUTE)**:
    - **Phase 1 (Critical)**: Build-breaking issues or architectural violations.
    - **Phase 2 (Standardization)**: Naming, tokens, and CSS cleanup.
    - **Phase 3 (Optimization)**: Performance and UX polish.
4. **Proposed Workflow**: A custom workflow for the cleanup execution.

---

## Critical Reflection

- **Granularity**: Is the audit deep enough to catch subtle hydration mismatches?
- **Shared Code**: Ensure that identifying a "fix" in a shared component doesn't break other
  invitations.
- **Aesthetic Alignment**: Does the implementation actually fulfill the "Luxury Hacienda" vision or
  is it a generic template?

---

## Deployment

1. Save this workflow as `.agent/workflows/audits/task-open/gerardo-technical-audit.md`.
2. (Optional) Remove the old `auditoria-tecnica-gerardo.md` and update `docs/implementation-log.md`.

// turbo
