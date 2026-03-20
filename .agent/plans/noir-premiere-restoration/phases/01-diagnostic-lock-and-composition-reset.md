# Phase 01: Diagnostic Lock and Composition Reset

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Lock the regression diagnosis in implementation terms and prevent scope drift before
touching theme files.

**Weight:** 20%

---

## 🎯 Analysis / Findings [STATUS: COMPLETED]

- `noir-premiere-xv` is the only invitation demo currently using `theme.preset = "editorial"`.
- The invitation preset index does not load an `editorial` preset, so Noir currently renders with a
  broken Layer 1 foundation.
- The pre-simplification implementation used a safer composition:
  - `theme.preset = "jewelry-box"`
  - `hero`, `countdown`, `location`, `family`, `gallery`, `gifts`, `itinerary`, `rsvp`,
    `thankYou` set to `variant = "editorial"`
- The current Noir event stylesheet depends on semantic variables that no longer resolve to the
  intended pearl-on-noir values once the preset composition changes.
- Commit `ac797e8c2a4d3b25e74ce668c171aa7b9960212f` contains the approved visual baseline and must be
  treated as implementation truth, not only as historical reference.

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

- [x] Confirmed the final restoration strategy stays inside the supported preset/variant
      architecture.
- [x] Extracted the exact JSON and SCSS baseline from commit
      `ac797e8c2a4d3b25e74ce668c171aa7b9960212f`.
- [x] Recorded the exact JSON keys that had to be restored explicitly instead of relying on preset
      fallback.
- [x] Froze the initial file list and documented the only justified scope expansion.

---

## 📋 Locked Decisions

- Use the existing supported architecture instead of inventing a new shared invitation preset.
- Use `ac797e8c2a4d3b25e74ce668c171aa7b9960212f` as the visual source of truth.
- Keep the fix isolated to Noir content and Noir event-local SCSS.
- Treat the missing invitation-level `editorial` preset as a diagnostic finding, not as the
  implementation target for this repair.
- Treat the footer as a section-variant consumer instead of preserving slug-specific behavior.

---

## ✅ Acceptance Criteria

- The execution scope is limited to the files listed in the plan README.
- The implementer does not need to decide between “approximate restoration” and “baseline-faithful
  restoration”; the target commit is authoritative.
- Any runtime compatibility adjustment must improve architectural consistency rather than reintroduce
  demo-specific branching.
