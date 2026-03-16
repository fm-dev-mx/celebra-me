# Phase 02: Monolithic Service Decomposition

## 🎯 Objective

Splitting `src/lib/rsvp/service.ts` (>1200 lines) and `src/lib/rsvp/repository.ts` (>800 lines) into
domain-specific modules to reduce coupling and improve maintainability.

## 🛠️ Step-by-Step Implementation

1.  **Identify Domain Boundaries**:
    - **Guest Management**: CRUD and sharing logic for invitations.
    - **RSVP Logic**: Public-facing submission and validation.
    - **Audit & Log**: Telemetry and admin actions.
    - **Shared Context**: Common types and internal helpers.

2.  **Create Domain Modules**:
    - `src/lib/rsvp/services/guest-invitation.service.ts`
    - `src/lib/rsvp/services/rsvp-submission.service.ts`
    - `src/lib/rsvp/services/audit-logger.service.ts`

3.  **Refactor Repository**:
    - Split `repository.ts` into corresponding domain repositories under
      `src/lib/rsvp/repositories/`.

4.  **Preserve Public API**:
    - Refactor `src/lib/rsvp/service.ts` to act as a **Thin Aggregator** by re-exporting functions
      from the new modules.
    - Ensures no immediate breaking changes for existing consumers.

## ✅ Verification Criteria

- [ ] No regression in RSVP submission flow.
- [ ] Successful compilation (`pnpm exec astro check`).
- [ ] All unit tests pass (`npm test`).

## 🏆 Success Criteria

- **Technical Benchmarks**:
  - Each new service file contains <200 LOC.
  - Zero circular dependencies between service modules.
  - Thin Aggregator (`service.ts`) maintains 100% backward compatibility.
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

- Update API reference in `docs/core/` to reflect new service structure.
- Document new domain boundaries in architecture docs.
