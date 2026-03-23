# Documentation Status Dashboard

This dashboard tracks the health, ownership, and maintenance state of the project's documentation.

## Core Architecture & Guidelines

| Feature             | Doc Path                             | Tier | Last Review | Next Review | Status      | Owner     |
| :------------------ | :----------------------------------- | :--- | :---------- | :---------- | :---------- | :-------- |
| Project Root        | `README.md`                          | 1    | 2026-03-22  | 2026-04-22  | 🟢 Current  | fm-dev-mx |
| Core Architecture   | `docs/core/architecture.md`          | 1    | 2026-03-22  | 2026-04-22  | 🟢 Current  | fm-dev-mx |
| Project Conventions | `docs/core/project-conventions.md`   | 1    | 2026-03-22  | 2026-04-22  | 🟢 Current  | fm-dev-mx |
| Theme System        | `docs/domains/theme/architecture.md` | 2    | 2026-03-22  | 2026-04-22  | 🟢 Current  | fm-dev-mx |
| RSVP System         | `docs/domains/rsvp/status.md`        | 2    | 2026-03-22  | 2026-04-22  | 🟡 Outdated | fm-dev-mx |
| Security Domain     | `docs/domains/security/status.md`    | 2    | 2026-03-23  | 2026-04-23  | 🟢 Initial  | fm-dev-mx |

## Historical & Archival Context

These documents are preserved for audit context and historical evolution only.

| Feature             | Doc Path                                                       | Tier | Archived   | Context                      |
| :------------------ | :------------------------------------------------------------- | :--- | :--------- | :--------------------------- |
| System Audit (Feb)  | `docs/archive/audit/full-system-audit-2026-02-15.md`           | 3    | 2026-03-23 | Initial alignment audit      |
| Operations Health   | `docs/archive/audit/ops-health-report.md`                      | 3    | 2026-03-23 | Script and env validation    |
| Stability Baseline  | `docs/archive/audit/stability.md`                              | 3    | 2026-03-23 | Remediation milestone        |
| Alignment Hardening | `docs/archive/audit/gatekeeper-commit-hardening.md`            | 3    | 2026-03-23 | Commit-fidelity improvements |
| Sync Audit (Mar)    | `docs/archive/audit/system-wide-alignment-audit-2026-03-10.md` | 3    | 2026-03-23 | Docs taxonomy alignment      |
| Refactor Proposal   | `docs/archive/architecture/refactor-proposal.md`               | 3    | 2026-03-23 | Legacy architecture notes    |

## Governance Artifacts

| Plan # | Plan Name                                       | Status       | Manifest                                                                          | Execution Progress                                                                                |
| :----- | :---------------------------------------------- | :----------- | :-------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| 011    | Project Audit and Pruning                       | 🟢 COMPLETED | [manifest.json](file:///.agent/plans/011-project-audit-and-pruning/manifest.json) | [phases/01...](file:///.agent/plans/011-project-audit-and-pruning/phases/01-pruning-execution.md) |
| ---    | [Archived Plans](file:///.agent/plans/archive/) | 📂 Archive   | [inventory](file:///.agent/plans/README.md)                                       | ---                                                                                               |

---

> [!NOTE] This dashboard is a living document. Updates are required whenever a new domain is
> introduced or a plan is archived.
