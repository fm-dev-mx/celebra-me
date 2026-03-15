# 🔧 Error Remediation Evolution

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Transform the `error-remediation.md` workflow from a 31-line conceptual framework
into a high-efficiency diagnostic engine with script-first automation, cyclic-repair prevention, and
formal state-machine transitions.

**Estimated Duration:** 3 phases / ~2 days **Owner:** fm-dev-mx **Created:** 2026-03-15

---

## 🎯 Scope

### In Scope

- Two new diagnostic scripts (`error-classifier.mjs`, `context-extractor.mjs`) in `.agent/scripts/`
- Rewrite of `.agent/workflows/error-remediation.md` as a 7-state machine
- Loop prevention with 3-cycle hard cap and mandatory rollback on failure
- BFF/Hydration Guard detection rules for Astro/React boundary errors
- Validation rules for WCAG and 3-Layer Color during fix design
- Zero-loop testing with synthetic and real-world error scenarios

### Out of Scope

- Changes to application source code (`src/`)
- Modifications to the gatekeeper or auto-fix workflows
- New npm packages or dependencies
- Playwright E2E test creation (deferred to future plan)

---

## 🔴 Blockers & Risks

| Risk / Blocker                                                      | Severity | Mitigation                                                                                                                |
| ------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Script error patterns may not cover all Astro edge cases            | Medium   | Phase 03 validates against real project errors; iterate if gaps found                                                     |
| State machine adds cognitive overhead for simple single-error fixes | Low      | Workflow retains fast-path for trivial errors detected by classifier                                                      |
| Auto-rollback may conflict with uncommitted user changes            | Medium   | SNAPSHOT requires a clean working tree before creation. Unified `git stash push -u` methodology enforces this constraint. |
| Token savings estimates are approximate                             | Low      | Phase 03 measures actual token deltas on test scenarios                                                                   |

---

## 🗺️ Phase Index

| #   | Phase                                                         | Weight | Status      |
| --- | ------------------------------------------------------------- | ------ | ----------- |
| 01  | [Diagnostic Automation](./phases/01-diagnostic-automation.md) | 40%    | `COMPLETED` |
| 02  | [Workflow Hardening](./phases/02-workflow-hardening.md)       | 40%    | `COMPLETED` |
| 03  | [Zero-Loop Testing](./phases/03-zero-loop-testing.md)         | 20%    | `COMPLETED` |

---

> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../README.md). The plan is complete and remains top-level pending
> explicit archive approval.
