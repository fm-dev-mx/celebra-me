# 📝 Changelog: XV Años Demo — Premium Quality Audit & Remediation

Deterministic audit trail for `xv-demo-premium-audit-2026-03`.

---

## [Unreleased]

### Phase 01: Full Visual Audit

**Completed:** Playwright audit executed across 5 viewports with evidence stored under
`temp/xv-demo-premium-audit/post-remediation-final/` (Completed: 2026-03-10 16:49) **Findings:**
Logged initial issues: hero mobile width regression, thank-you crop/variant mismatch, missing
godparents render path, and audit noise from media requests (Completed: 2026-03-10 16:49)

### Phase 02: Critical Regressions Fix

**Remediation:** Rebalanced `jewelry-box` hero card proportions and premium glass/title treatment in
`_hero-theme.scss` (Completed: 2026-03-10 16:49) **Remediation:** Corrected thank-you frame/image
rendering via `jewelry-box` variant wiring and non-clipping portrait fit rules (Completed:
2026-03-10 16:49)

### Phase 03: Godparents Data Pipeline

**Implementation:** Forwarded `godparents` through adapter and page props into `Family.astro`
(Completed: 2026-03-10 16:49) **Validation:** Added adapter unit coverage for `family.godparents`
present/absent paths (Completed: 2026-03-10 16:49)

### Phase 04: Typography & Font Polish

**Polish:** Refined `jewelry-box` family typography tokens for names, metadata, spacing, and reveal
order including godparents (Completed: 2026-03-10 16:49) **Polish:** Refined `jewelry-box` gallery
title/subtitle/caption typography and enabled variant usage in `demo-xv.json` (Completed: 2026-03-10
16:49)

### Phase 05: Extended Premium Refinements

**Validation:** Added configurable Playwright `baseURL`, filtered non-actionable audio request
failures, and waited for family reveal before screenshots (Completed: 2026-03-10 16:49) **Smoke:**
Verified `demo-xv` and `demo-gerardo-sesenta` render without runtime errors after scoped changes
(Completed: 2026-03-10 16:49)

---

> Entries follow reverse-chronological order within each phase. Format:
> `**{Action}:** {Description} (Completed: YYYY-MM-DD HH:MM)`
