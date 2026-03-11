# 💎 XV Años Demo — Premium Quality Audit & Remediation

**Completion:** `100%` | **Status:** `COMPLETED`

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

| #   | Phase                                                               | Weight | Status      |
| --- | ------------------------------------------------------------------- | ------ | ----------- |
| 01  | [Full Visual Audit](./phases/01-visual-audit.md)                    | 15%    | `COMPLETED` |
| 02  | [Critical Regressions Fix](./phases/02-critical-regressions.md)     | 30%    | `COMPLETED` |
| 03  | [Godparents Data Pipeline](./phases/03-godparents-pipeline.md)      | 25%    | `COMPLETED` |
| 04  | [Typography & Font Polish](./phases/04-typography-polish.md)        | 15%    | `COMPLETED` |
| 05  | [Extended Premium Refinements](./phases/05-extended-refinements.md) | 15%    | `COMPLETED` |

---

## ✅ Outcome Summary

- XV demo audited at `375px`, `414px`, `768px`, `1024px`, and `1440px` with Playwright evidence in
  `temp/xv-demo-premium-audit/post-remediation-final/`
- Hero mobile card proportions and premium glass treatment corrected for `jewelry-box`
- Thank-you section now renders as `jewelry-box` and displays the full portrait without clipping
- Godparents now flow from content → adapter → page → `Family.astro` and render as a dedicated block
- Family and gallery typography refined without leaking to non-`jewelry-box` variants
- Smoke regression verified on `demo-xv` and `demo-gerardo-sesenta`

---

> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../README.md). No phase may be committed without owner approval.
