**Completion:** `50%` | **Status:** `IN-PROGRESS`

# Plan: Pre-Phase Technical Audit (2026)

> Phases 01-03 are complete. Phase 04 is the next pending execution target.

## Executive Summary

This plan covers a deep technical audit of the **Celebra-me** codebase. The goal is to identify the
top 5 most critical technical debt items or anti-patterns that hinder scalability, maintainability,
or adherence to the project's core architectural pillars ('Jewelry Box' aesthetic, 3-Layer Color
Architecture, BFF Decoupling).

> **Note**: Phase 01 (Technical Audit) has been completed. The findings have been decomposed into
> remediation Phases 02-06.

## ✅ Current State [STATUS: IN-PROGRESS]

> **Phase 02 Outcome:** RSVP service and repository logic were decomposed into domain modules with
> compatibility aggregators preserved at [`src/lib/rsvp/service.ts`](../../src/lib/rsvp/service.ts)
> and [`src/lib/rsvp/repository.ts`](../../src/lib/rsvp/repository.ts). Verification passed with
> `pnpm exec astro check` and `npm run test:rsvp` on 2026-03-16.
>
> **Phase 03 Outcome:** Content schemas were modularized under
> [`src/lib/schemas/content`](../../src/lib/schemas/content), `src/content/config.ts` now assembles
> the schema graph from modular definitions, and legacy RSVP style labels moved to
> `sectionStyles.rsvp.legacy`. CLI verification passed with `pnpm exec astro check` and
> `npx astro build` on 2026-03-16. Repository documentation now records the deprecated RSVP field
> migration path in [`docs/core/content-schema.md`](../../docs/core/content-schema.md).

## Phase Index

1.  **[Phase 01: Audit Report](./phases/01-technical-audit.md)**: Identification of top 5 issues and
    strategic MVIs.
2.  **[Phase 02: Service Decomposition](./phases/02-service-decomposition.md)**: Splitting
    monolithic services into domain-specific modules.
3.  **[Phase 03: Schema Modularization](./phases/03-schema-modularization.md)**: Decoupling Zod
    schemas from the central config.
4.  **[Phase 04: Presenter Pattern](./phases/04-presenter-implementation.md)**: Implementation of a
    view-model presenter layer.
5.  **[Phase 05: Asset Hardening](./phases/05-asset-hardening.md)**: Enforcing strict type-safety
    for internal/external assets.
6.  **[Phase 06: Design System Sync](./phases/06-design-system-sync.md)**: Synchronizing component
    styles with semantic tokens.

## Governance Alignment

This plan adheres to the global project rules defined in `.agent/README.md` and
`docs/core/project-conventions.md`.

---

_Created by Antigravity — Senior Software Architect & Technical Auditor_
