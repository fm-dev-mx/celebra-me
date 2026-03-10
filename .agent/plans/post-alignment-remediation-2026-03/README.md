# Post-Alignment Remediation

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Close the remaining follow-up work after the March 10, 2026 system-wide alignment
audit: archive completed top-level plans, resolve the current ESLint warning backlog, and remediate
the non-blocking Astro/Zod hint set.

**Estimated Duration:** 4 phases / ~1-2 days **Owner:** system-agent **Created:** 2026-03-10

---

## Scope

### In Scope

- Archive completed top-level plans that should no longer remain active under `.agent/plans/`
- Resolve the current `pnpm lint` warning backlog
- Resolve the current `pnpm astro check` hint set related to deprecated Zod string helpers
- Re-run verification and update the dashboard after remediation

### Out of Scope

- New documentation taxonomy changes unrelated to the current warning backlog
- Product feature work
- Broad refactors not required to remove the current lint and Astro diagnostics

---

## Blockers & Risks

| Risk / Blocker                                        | Severity | Mitigation                                                                                            |
| ----------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| Warning cleanup may uncover larger architectural debt | Medium   | Fix warnings in narrow batches and stop to document scope expansion if a change stops being low-risk. |
| Archiving completed plans changes dashboard state     | Low      | Update `docs/DOC_STATUS.md` in the same phase as the archive move.                                    |

---

## Phase Index

| #   | Phase                                                                             | Weight | Status      |
| --- | --------------------------------------------------------------------------------- | ------ | ----------- |
| 01  | [Archive Completed Plan Records](./phases/01-archive-completed-plan-records.md)   | 25%    | `COMPLETED` |
| 02  | [Lint Warning Remediation](./phases/02-lint-warning-remediation.md)               | 25%    | `COMPLETED` |
| 03  | [Astro Hint Remediation](./phases/03-astro-hint-remediation.md)                   | 25%    | `COMPLETED` |
| 04  | [Verification and Dashboard Sync](./phases/04-verification-and-dashboard-sync.md) | 25%    | `COMPLETED` |

---

> **Predecessor:**
> [System-Wide Alignment Audit](../archive/system-wide-alignment-audit-2026-03/README.md)
>
> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../README.md). The plan is complete and remains top-level pending
> explicit archive approval.
