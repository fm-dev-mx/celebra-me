# Phase 02: Critical Regressions Fix

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Fix hero card proportions/colors and thank-you image cropping.

**Weight:** 30% of total plan

---

## 🎯 Analysis / Findings

_Findings from testing hero card proportions and thank-you croppings._

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### 2A. Hero Section — Card Proportions & Premium Colors

- [ ] Inspect `.invitation-hero[data-variant='jewelry-box'] .invitation-hero__content` in
      `_hero-theme.scss` (lines 19–65)
- [ ] Verify `width`, `max-width`, `padding`, `border-radius`, and aspect ratio feel proportionally
      balanced on both **mobile (≤480px)** and **desktop** viewports
- [ ] Evaluate whether the mobile `max-width: 250px` regression should be fixed
- [ ] Validate that the glassmorphism background and border produce a jewelry-box-quality appearance
- [ ] Evaluate the gold-foil title gradient for visual richness and contrast
- [ ] Cross-check that hero tokens in `_jewelry-box.scss` are coherent

### 2B. Thank You Section — Cropped/Incomplete Image

- [ ] Analyze `signature.webp` rendering via `ThankYou.astro`
- [ ] Analyze the `.photo-frame` in `_thank-you.scss` and `_thank-you-theme.scss`
- [ ] Evaluate if `object-position` or frame dimensions need adjustment to prevent clipping

---

## ✅ Acceptance Criteria

- [ ] Hero card proportions are visually balanced at all breakpoints
- [ ] Hero card colors match premium jewelry-box aesthetic
- [ ] Thank-you photo displays fully without clipping
- [ ] No other demos or invitations are visually affected
- [ ] Phase status updated to `COMPLETED` in `manifest.json` and `CHANGELOG.md`

---

## 📎 References

- [Plan README](../README.md)
