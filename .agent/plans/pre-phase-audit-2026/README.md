**Completion:** `83%` | **Status:** `IN-PROGRESS`

# Plan: Pre-Phase Technical Audit (2026)

> Phases 01-05 are complete. Phase 06 is currently blocked pending an approved plan amendment.

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
>
> **Phase 05 Outcome:** Asset references now normalize into a strict internal/external contract in
> [`src/lib/schemas/content/shared.schema.ts`](../../src/lib/schemas/content/shared.schema.ts),
> adapter resolution fails fast on missing internal assets in
> [`src/lib/adapters/event-helpers.ts`](../../src/lib/adapters/event-helpers.ts), and dynamic
> discovery is audited by
> [`scripts/check-event-assets.cjs`](../../scripts/check-event-assets.cjs). Verification passed with
> `pnpm exec astro check`, `npx astro build`, `npx jest tests/content/schema.test.ts tests/unit/event.adapter.test.ts tests/unit/event-assets-audit.test.ts --runInBand`, and
> `npm run assets:check-registry` on 2026-03-16.
>
> **Phase 06 Blocker:** Execution review found that the original design-system-sync phase depends on
> undefined staging or screenshot-baseline validation and points documentation to
> `docs/core/color-architecture.md`, which does not exist in the repository. The live theme
> architecture docs currently reside in
> [`docs/domains/theme/architecture.md`](../../docs/domains/theme/architecture.md). Phase 06 remains
> blocked until those acceptance criteria are amended.

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
    styles with semantic tokens. Current status: `BLOCKED` pending verification and documentation
    alignment.

## Governance Alignment

This plan adheres to the global project rules defined in `.agent/README.md` and
`docs/core/project-conventions.md`.

---

_Created by Antigravity — Senior Software Architect & Technical Auditor_
