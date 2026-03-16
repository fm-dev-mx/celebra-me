# Phase 01: Critical Remediation (Bugs)

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Address immediate visual and technical regressions in the Hero, Family, and Countdown
sections.

**Weight:** 25% of total plan

---

## 🎯 Analysis / Findings

Current implementation suffers from layout collisions in the Hero section due to overlapping
absolute elements. The Family section's grid doesn't properly handle varying content lengths for
godparents on large screens. The Countdown timer uses `clamp()` on font sizes that exceed parent
container height, causing clipping.

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

### Hero Section Fixes

- [x] Adjust `z-index` hierarchy for `.invitation-hero__details` vs `.invitation-hero__title` (10%
      of Phase) (Completed: 2026-03-13)
- [x] Recalculate `translate` values for the title to ensure safe zones (10% of Phase) (Completed:
      2026-03-13)
- [x] Optimize mobile layout to prevent title-portrait bleeding (10% of Phase) (Completed:
      2026-03-13)

### Family Section Alignment

- [x] Implement robust grid for `.family__content` using `auto-fit`/`auto-fill` (20% of Phase)
      (Completed: 2026-03-13)
- [x] Fix desktop overflow for "Padrinos" list (10% of Phase) (Completed: 2026-03-13)

### Countdown Timer Refinement

- [x] Increase `line-height` and adjust `padding` for `.countdown__value` to prevent clipping (20%
      of Phase) (Completed: 2026-03-13)
- [x] Verify container bounds for all digits on high-dpi screens (10% of Phase) (Completed:
      2026-03-13)

### Governance

- [x] Align plan with `.agent/plans/README.md` structure (10% of Phase) (Completed: 2026-03-13
      09:45)

---

## ✅ Acceptance Criteria

- [ ] Hero: Zero text/image collisions across all breakpoints (320px to 2560px).
- [ ] Family: "Padrinos" section is responsive and contained within the viewport.
- [ ] Countdown: Fully visible digits with zero clipping or layout shifts.
- [ ] SCSS is strictly scoped to `.event--ximena-meza-trasvina`.

---

## 📎 References

- [Event SCSS](file:///c:/Code/celebra-me/src/styles/events/ximena-meza-trasvina.scss)
- [Event JSON](file:///c:/Code/celebra-me/src/content/events/ximena-meza-trasvina.json)
