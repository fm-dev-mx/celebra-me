**Completion:** `67%` | **Status:** `BLOCKED`

# Plan: Pre-Phase Technical Audit (2026)

> Phases 01-04 are complete. Phase 05 is blocked pending a scope correction.

## Executive Summary

This plan covers a deep technical audit of the **Celebra-me** codebase. The goal is to identify the
top 5 most critical technical debt items or anti-patterns that hinder scalability, maintainability,
or adherence to the project's core architectural pillars ('Jewelry Box' aesthetic, 3-Layer Color
Architecture, BFF Decoupling).

> **Note**: Phase 01 (Technical Audit) has been completed. The findings have been decomposed into
> remediation Phases 02-06.

## ✅ Current State [STATUS: BLOCKED]

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
>
> **Phase 04 Outcome:** Invitation page derivation now flows through
> [`src/lib/presenters/invitation-presenter.ts`](../../src/lib/presenters/invitation-presenter.ts)
> and [`src/components/invitation/InvitationSections.astro`](../../src/components/invitation/InvitationSections.astro),
> reducing [`src/pages/[eventType]/[slug].astro`](../../src/pages/[eventType]/[slug].astro) from
> 316 LOC to 129 LOC. Verification passed with `pnpm exec astro check`, `npx astro build`, and
> `npx jest tests/unit/invitation.presenter.test.ts --runInBand` on 2026-03-16.
> Presenter usage is now documented in
> [`docs/core/project-conventions.md`](../../docs/core/project-conventions.md) and
> [`docs/core/architecture.md`](../../docs/core/architecture.md).
>
> **Phase 05 Blocker:** The current asset system already uses dynamic discovery in
> [`src/lib/assets/asset-registry.ts`](../../src/lib/assets/asset-registry.ts) and
> [`src/lib/assets/discovery.ts`](../../src/lib/assets/discovery.ts), while content schemas still
> accept legacy string asset references in
> [`src/lib/schemas/content/shared.schema.ts`](../../src/lib/schemas/content/shared.schema.ts).
> The original Phase 05 plan assumes manual asset registration and object-based discriminated union
> content references, so it must be amended before implementation can begin.

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
