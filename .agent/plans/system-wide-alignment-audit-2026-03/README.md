# System-Wide Alignment Audit and Cleanup

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Execute a repo-wide documentation and governance alignment pass across `docs/`,
`.agent/`, and validation tooling, while recording deferred follow-up items that are explicitly out
of scope for this run.

**Estimated Duration:** 5 phases / ~1 day **Owner:** system-agent **Created:** 2026-03-10

---

## Scope

### In Scope

- Governance docs in `.agent/`
- Documentation dashboard and taxonomy in `docs/`
- Root-level docs reclassification
- Theme schema validation alignment
- Creation of a durable audit report and machine-readable plan state

### Out of Scope

- Archiving `system-doc-alignment-hardening` during this run
- Product refactors unrelated to governance drift
- Non-governance code cleanup driven only by deprecation hints

---

## Blockers & Risks

| Risk / Blocker                                | Severity | Mitigation                                                                                              |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| Historical logs retain legacy paths           | Low      | Mark moved reports as historical context so old references are not treated as live governance drift.    |
| Pre-existing completed plan remains top-level | Medium   | Record it as deferred remediation in the audit report and dashboard instead of mutating it in this run. |

---

## Phase Index

| #   | Phase                                                                                           | Weight | Status      |
| --- | ----------------------------------------------------------------------------------------------- | ------ | ----------- |
| 01  | [Baseline and Inventory](./phases/01-baseline-and-inventory.md)                                 | 20%    | `COMPLETED` |
| 02  | [Governance Contract Realignment](./phases/02-governance-contract-realignment.md)               | 20%    | `COMPLETED` |
| 03  | [Doc Taxonomy and Dashboard Cleanup](./phases/03-doc-taxonomy-and-dashboard-cleanup.md)         | 20%    | `COMPLETED` |
| 04  | [Code and Validation Parity Remediation](./phases/04-code-and-validation-parity-remediation.md) | 20%    | `COMPLETED` |
| 05  | [Verification and Closure](./phases/05-verification-and-closure.md)                             | 20%    | `COMPLETED` |

---

> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../README.md). The predecessor hardening effort remains active at
> the top level and is intentionally tracked as a deferred archive action rather than being mutated
> here.
