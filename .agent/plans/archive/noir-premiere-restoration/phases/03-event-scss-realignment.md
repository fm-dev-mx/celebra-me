# Phase 03: Event SCSS Realignment

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Restore `src/styles/events/noir-premiere-xv.scss` to the visual behavior of commit
`ac797e8c2a4d3b25e74ce668c171aa7b9960212f` without altering shared section theme partials unless a
runtime incompatibility is proven.

**Weight:** 35%

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

- [x] Used the `ac797e8c2a4d3b25e74ce668c171aa7b9960212f` version of
      `src/styles/events/noir-premiere-xv.scss` as the primary restoration baseline.
- [x] Diffed the current file against that baseline and limited changes to the regressed noir
      colors, gradients, surfaces, and emphasis values.
- [x] Restored noir literals and section-specific values where token reinterpretation changed the
      result away from the approved look.
- [x] Kept all changes scoped to `.event--noir-premiere-xv`.
- [x] Avoided edits to shared section partials.

---

## 🎨 Styling Rules

- Prefer the target commit’s authored noir values when they are what produced the approved visual
  result.
- Event-scoped custom properties are acceptable only where they help preserve that result without
  changing shared theme files.
- Do not move layout architecture into preset files.
- Do not edit `src/styles/themes/sections/*` unless Phase 04 proves Noir cannot be isolated
  otherwise.
- The footer styling moved out of this phase and into a shared architectural cleanup because the
  issue was ownership, not Noir-local styling.

---

## ✅ Acceptance Criteria

- Hero, location, itinerary, countdown, gifts, RSVP, and thank-you all render on coherent noir
  surfaces again.
- Pearl text no longer flips to generic Jewelry Box gold where body copy or display copy should stay
  light.
- The rendered result is visually aligned with the `ac797e8` stylesheet outcome, not merely with a
  generic “dark Jewelry Box” interpretation.
- All changes remain scoped to `.event--noir-premiere-xv`.
