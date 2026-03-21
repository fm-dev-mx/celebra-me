# Phase 02: Content and Variant Restoration

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Restore Noir’s content contract so runtime variant selection matches commit
`ac797e8c2a4d3b25e74ce668c171aa7b9960212f` while remaining compatible with the current 3-Layer
composition model.

**Weight:** 30%

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

- [x] Restored `src/content/event-demos/xv/noir-premiere-xv.json` to the authored Noir
      composition in commit `ac797e8c2a4d3b25e74ce668c171aa7b9960212f`.
- [x] Restored explicit theme color ownership in Noir content:
      noir-safe `primaryColor`, `accentColor`, and `fontFamily` are explicit again.
- [x] Restored explicit section variant ownership:
      `hero.variant`, `countdown`, `location`, `family`, `gallery`, `gifts`, `itinerary`,
      `rsvp`, and `thankYou` are authored as `editorial`.
- [x] Made envelope behavior explicit again using the baseline-supported variant and closed-palette
      mapping.
- [x] Added `sectionStyles.footer.variant = "editorial"` as the single intentional compatibility
      delta from the historical JSON so the footer can follow the same variant contract as the rest
      of the page.

---

## 🧠 Implementation Notes

- The goal is to recreate the target commit’s JSON behavior as faithfully as possible inside the
  current simplified presenter:
  - page preset owns the palette,
  - section variants own the editorial layouts,
  - event-local SCSS owns the demo-specific noir refinement.
- The footer delta is architectural, not cosmetic:
  the current runtime now carries footer styling through `sectionStyles.footer.variant` instead of
  a slug exception inside the footer component.

---

## ✅ Acceptance Criteria

- Noir no longer relies on `theme.preset = editorial`.
- Every visually editorial section has explicit variant ownership in content.
- The final Noir content contract is semantically equivalent to the one in
  `ac797e8c2a4d3b25e74ce668c171aa7b9960212f`, with the footer now declared explicitly as an
  editorial section variant.
