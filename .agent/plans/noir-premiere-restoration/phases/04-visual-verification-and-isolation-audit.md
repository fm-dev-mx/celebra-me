# Phase 04: Visual Verification and Isolation Audit

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Verify the restoration and prove it does not create side effects in other invitation
routes.

**Weight:** 15%

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

- [x] Compared Noir content and event SCSS directly against commit
      `ac797e8c2a4d3b25e74ce668c171aa7b9960212f`.
- [x] Verified the footer gap and resolved it by replacing slug-specific behavior with an explicit
      footer section variant.
- [x] Ran the relevant validation commands already used by the theme system:
      `pnpm type-check` and `pnpm build`.
- [x] Recorded the remaining warnings as pre-existing Astro content warnings for `archive`.

---

## 🔍 Visual Checklist

- [x] Background layer stays dark and cinematic across the restored Noir sections.
- [x] Surface layer reads as glass, lacquer, or elevated noir panels instead of flat generic black.
- [x] Content layer preserves readable pearl text and controlled gold emphasis.
- [x] No section unexpectedly falls back to the light Jewelry Box palette.
- [x] Envelope and music controls remain coherent after the preset/variant reset.
- [x] The footer now behaves like the rest of the section system instead of relying on a demo
      exception.

---

## ✅ Acceptance Criteria

- Noir is visually restored without touching shared invitation section theme files.
- Noir is visually restored to the `ac797e8c2a4d3b25e74ce668c171aa7b9960212f` baseline, except for
  the explicitly documented footer-variant compatibility delta.
- Build or validation checks complete without new theme/content errors.
