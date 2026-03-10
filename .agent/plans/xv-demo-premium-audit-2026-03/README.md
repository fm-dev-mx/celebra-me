# 💎 XV Años Demo — Premium Quality Audit & Remediation

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Remediate all visual regressions in the XV Años demo invitation and elevate overall
quality to premium standards. Includes hero card proportions, thank-you image fix, godparents data
pipeline, typography refinement, and a full section-by-section audit.

**Estimated Duration:** 5 phases / ~2 days **Owner:** fm-dev-mx **Created:** 2026-03-10

---

## 🎯 Scope

### In Scope

- Full visual audit of the demo across 5 breakpoints
- Fix hero card proportions and jewelry-box styling
- Fix thank-you image cropping
- Wire godparents data through the adapter pipeline
- Refine typography in family and gallery sections
- Resolve extended UI/UX issues found during audit

### Out of Scope

- Changes affecting other demos (e.g., `demo-gerardo-sesenta`)
- Changes affecting real invitations
- Modifying core component markup unless necessary for scoped styling

---

## 🔴 Blockers & Risks

| Risk / Blocker                  | Severity | Mitigation                                                                            |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| Regression leak to other events | High     | Strict adherence to `demo-xv.scss` scoped overrides and `jewelry-box` specific rules. |

---

## 🗺️ Phase Index

| #   | Phase                                                               | Weight | Status    |
| --- | ------------------------------------------------------------------- | ------ | --------- |
| 01  | [Full Visual Audit](./phases/01-visual-audit.md)                    | 15%    | `PENDING` |
| 02  | [Critical Regressions Fix](./phases/02-critical-regressions.md)     | 30%    | `PENDING` |
| 03  | [Godparents Data Pipeline](./phases/03-godparents-pipeline.md)      | 25%    | `PENDING` |
| 04  | [Typography & Font Polish](./phases/04-typography-polish.md)        | 15%    | `PENDING` |
| 05  | [Extended Premium Refinements](./phases/05-extended-refinements.md) | 15%    | `PENDING` |

---

> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../README.md). No phase may be committed without owner approval.
