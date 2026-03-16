**Completion:** `100%` | **Status:** `COMPLETED`

# Phase 02: Monolithic Service Decomposition

## 🎯 Objective

Splitting `src/lib/rsvp/service.ts` (>1200 lines) and `src/lib/rsvp/repository.ts` (>800 lines) into
domain-specific modules to reduce coupling and improve maintainability.

## ✅ Execution Summary [STATUS: COMPLETED]

> **Resolved:** Owner approval was received for the expanded scope, and the RSVP layer now uses
> domain modules plus compatibility aggregators. `service.ts` and `repository.ts` are thin re-export
> shims; concrete logic was moved into `services/`, `services/shared/`, `repositories/`, and
> `repositories/shared/`. **Validated:** 2026-03-16 12:11 with `pnpm exec astro check` and
> `npm run test:rsvp`.

## 🛠️ Step-by-Step Implementation

1.  **Identify Domain Boundaries**:
    - **Guest Management**: CRUD and sharing logic for invitations.
    - **RSVP Logic**: Public-facing submission and validation.
    - **Audit & Log**: Telemetry and admin actions.
    - **Admin & Access**: Event admin, claim-code admin, user-role, and auth-session orchestration.
    - **Shared Context**: DTO mappers, invite URL generation, ownership validation, and internal
      helpers extracted into a dependency-light shared module.

2.  **Create Domain Modules**:
    - `src/lib/rsvp/services/guest-invitation.service.ts`
    - `src/lib/rsvp/services/rsvp-submission.service.ts`
    - `src/lib/rsvp/services/audit-logger.service.ts`
    - `src/lib/rsvp/services/admin-access.service.ts`
    - `src/lib/rsvp/services/shared/` for common service helpers that would otherwise create
      circular dependencies

3.  **Refactor Repository**:
    - Split `repository.ts` into corresponding domain repositories under
      `src/lib/rsvp/repositories/`.
    - Add a dedicated admin-access repository module for event, claim-code, membership, and role
      persistence.
    - Extract row mappers and query-shared types into repository-local shared modules.

4.  **Preserve Public API**:
    - Refactor `src/lib/rsvp/service.ts` to act as a **Thin Aggregator** by re-exporting functions
      from the new modules.
    - Ensures no immediate breaking changes for existing consumers.
    - Keep `src/lib/rsvp/repository.ts` as a compatibility aggregator for existing tests until all
      repository consumers are migrated.

## 📋 Required Tasks [STATUS: COMPLETED]

- [x] Audit current `service.ts` export surface and confirm non-RSVP domains (20% of Phase)
      (Completed: 2026-03-16 11:25)
- [x] Audit current `repository.ts` export surface and confirm non-RSVP persistence domains (20% of
      Phase) (Completed: 2026-03-16 11:25)
- [x] Approve expanded domain split covering admin-access and shared-core responsibilities (20% of
      Phase) (Completed: 2026-03-16 11:28)
- [x] Implement service decomposition with thin compatibility aggregators (20% of Phase) (Completed:
      2026-03-16 12:11)
- [x] Implement repository decomposition with compatibility aggregators and no circular imports (20%
      of Phase) (Completed: 2026-03-16 12:11)

## ✅ Verification Criteria

- [x] No regression in RSVP submission flow. (Completed: 2026-03-16 12:11)
- [x] Successful compilation (`pnpm exec astro check`). (Completed: 2026-03-16 12:11)
- [x] RSVP/unit/integration test sweep passed (`npm run test:rsvp`). (Completed: 2026-03-16 12:11)

## 🏆 Success Criteria

- **Technical Benchmarks**:
  - Each new service file contains <200 LOC.
  - Each new repository file contains <250 LOC.
  - Zero circular dependencies between service modules.
  - Thin Aggregators (`service.ts` and `repository.ts`) maintain 100% backward compatibility.
- **Validation Steps**:
  - Run `pnpm exec astro check` to verify type safety.
  - Execute `npm run test:unit` to validate service logic.
  - Manual smoke test: Submit RSVP via staging invitation.

## ⚠️ Risk & Mitigation

| Risk                                | Impact | Mitigation Strategy                                                                                  |
| ----------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Breaking existing API consumers     | High   | Retain Thin Aggregator pattern; implement re-exports before deletion.                                |
| Circular dependencies               | Medium | Enforce flat directory structure; use explicit relative imports.                                     |
| Data inconsistency during migration | High   | Run parallel verification against old repository; never delete old code until new code is validated. |

## 🧪 Regression Testing Note

- **Automated**: Add integration test for each new service module.
- **Manual**: Validate full RSVP lifecycle (invite → view → respond → admin audit).

## 📚 Documentation Sync Required

- [x] Update RSVP domain documentation to reflect the new service structure. (Completed: 2026-03-16
      12:11)
- [x] Document new domain boundaries in architecture docs. (Completed: 2026-03-16 12:11)
