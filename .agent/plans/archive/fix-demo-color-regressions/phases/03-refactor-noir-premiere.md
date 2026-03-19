# Phase 03: Refactor Noir Premiere & Cumple SCSS

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Strip explicit hardcoded values within `src/styles/events/noir-premiere-xv.scss` and
replace them with dynamic layout-enforced tokens.

**Weight:** 40% of total plan

---

## 🎯 Analysis / Findings

`noir-premiere-xv.scss` bypasses the new generic architecture, opting for manual gradients and
hardcoded HEX numbers (`#d4af37`, `#050505`, `#f9f6f2`). This causes regression styling errors when
standard components look for `var(--color-surface-dark)`.

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

### Refactoring `noir-premiere-xv.scss`

- [ ] Strip raw `#d4af37` and `#f9f6f2` rules; replace with `var(--color-action-accent)` and
      `var(--color-text-on-dark)`.
- [ ] Strip static `#0d0d0d`/`#050505` backgrounds where appropriate, defaulting to
      `var(--color-surface-dark)`.
- [ ] Audit `.rsvp[data-variant='editorial']` handling to guarantee seamless background blending.

### Refactoring Components (`luxury-hacienda`)

- [ ] Review how `demo-cumple.json` elements invoke components; ensure styles properly read unified
      tokens generated in Phase 02.
- [ ] Ensure specific localized `background:` gradients correctly encapsulate their scope or rely
      heavily on primitive injections instead of rigid definitions.

---

## ✅ Acceptance Criteria

- [x] `noir-premiere-xv.scss` is fully sanitized of raw hex values overriding semantics.
- [x] Both demos properly render variables generated dynamically.
