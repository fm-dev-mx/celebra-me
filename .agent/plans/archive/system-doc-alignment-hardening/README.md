# 🏛️ System Doc Alignment Governance Hardening

**Completion:** `100%` | **Status:** `ARCHIVED`

**Objective:** Audit the `/system-doc-alignment` workflow to ensure full structural and logical
compliance with the new Planning Governance Framework and project architecture, generating an
actionable update plan.

**Estimated Duration:** 2 phases / ~1 day **Owner:** system-agent **Created:** 2026-03-10

---

## 🎯 Scope

### In Scope

- Discovery and mapping of documentation-related workflows and skills.
- Structural audit of `.agent/workflows/system-doc-alignment.md` against `.agent/plans/README.md`.
- Drift analysis of architectural layers and specialized skills.
- Creation of a Governance Drift Report and an updated workflow template.

### Out of Scope

- Execution of the actual file modifications in `.agent/workflows/system-doc-alignment.md` (pending
  user approval).

---

## 🔴 Blockers & Risks

| Risk / Blocker    | Severity | Mitigation                                                                                 |
| ----------------- | -------- | ------------------------------------------------------------------------------------------ |
| Template Approval | Medium   | Provide the updated template in Phase 1 for explicit User review before executing Phase 2. |

---

## 🗺️ Phase Index

| #   | Phase                                                                              | Weight | Status      |
| --- | ---------------------------------------------------------------------------------- | ------ | ----------- |
| 01  | [Governance Drift Analysis & Templating](./phases/01-governance-drift-analysis.md) | 50%    | `COMPLETED` |
| 02  | [Workflow Modernization Execution](./phases/02-workflow-modernization.md)          | 50%    | `COMPLETED` |

---

> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../../README.md). No phase may be committed without owner
> approval.

> **Archive Note:** Archived on 2026-03-10 after its workflow changes were absorbed into the active
> governance baseline.
