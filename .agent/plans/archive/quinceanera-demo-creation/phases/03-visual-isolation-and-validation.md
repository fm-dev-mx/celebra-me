# Phase 03: Visual Isolation and Validation

**Completion:** `75%` | **Status:** `IN-PROGRESS`

**Objective:** Move the cloned editorial styling into a demo-specific event namespace and validate
that the new route renders independently with no regressions to Ximena's invitation.

**Weight:** 40% of total plan

---

## 🎯 Analysis / Findings

The Ximena SCSS currently has four direct coupling points that must be removed for the catalog demo:
the root event namespace, a Ximena-named shadow token, a preset-specific interlude selector, and a
body-level background block tied to `layout--ximena-premium`.

The new demo should remain visually close to the source while relying only on the new slug-scoped
SCSS file plus existing shared invitation runtime behavior.

---

## 🛠️ Execution Tasks [STATUS: IN-PROGRESS]

### Style Isolation

- [x] Clone the Ximena event stylesheet into `src/styles/events/noir-premiere-xv.scss` (30% of
      Phase) (Completed: 2026-03-16 00:11)
- [x] Remove namespace and selector coupling to Ximena-specific slug, preset, and body class (30% of
      Phase) (Completed: 2026-03-16 00:11)

### Validation

- [ ] Verify the new route resolves and lazy-loads the new SCSS file in a browser session (20% of
      Phase)
- [x] Run non-mutating validation checks for type-safety and route integrity (20% of Phase)
      (Completed: 2026-03-16 00:13)

---

## ✅ Acceptance Criteria

- [x] The new SCSS references only `.event--noir-premiere-xv` for event-level isolation. (Completed:
      2026-03-16 00:11)
- [x] No Ximena slug, preset, or body-class strings remain in the new SCSS. (Completed: 2026-03-16
      00:12)
- [x] The new demo route renders with no broken media or schema errors at build time. (Completed:
      2026-03-16 00:13)
- [ ] `/xv/ximena-meza-trasvina` remains unaffected after browser-level visual comparison.

---

## 📎 References

- [Ximena Source Styles](/c:/Code/celebra-me/src/styles/events/ximena-meza-trasvina.scss)
- [Event Route](/c:/Code/celebra-me/src/pages/[eventType]/[slug].astro)
- [Theme Contract](/c:/Code/celebra-me/src/lib/theme/theme-contract.ts)
