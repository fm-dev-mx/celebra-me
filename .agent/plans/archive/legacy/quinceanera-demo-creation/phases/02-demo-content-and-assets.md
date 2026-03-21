# Phase 02: Demo Content and Assets

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Create the new public XV demo entry and duplicate asset module under the isolated
`noir-premiere-xv` slug with anonymized, premium editorial placeholder content.

**Weight:** 40% of total plan

---

## 🎯 Analysis / Findings

The new demo will live in `src/content/event-demos/xv/` to align with public showcase governance.
Asset discovery is automatic as long as the new folder contains a valid `index.ts` asset module with
the same symbolic keys expected by the adapter.

The safest approach is to preserve the structural shape of the Ximena invitation while replacing
every personal detail, brand reference, and share/RSVP string with demo-safe content.

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

### Content Cloning

- [x] Create `src/content/event-demos/xv/noir-premiere-xv.json` from the Ximena structure (25% of
      Phase) (Completed: 2026-03-16 00:11)
- [x] Replace all real-world personal data with demo-safe editorial copy (25% of Phase) (Completed:
      2026-03-16 00:11)

### Asset Duplication

- [x] Duplicate the Ximena asset folder into `src/assets/images/events/noir-premiere-xv/` (25% of
      Phase) (Completed: 2026-03-16 00:11)
- [x] Adapt `index.ts` comments and aliases to be demo-specific and slug-isolated (25% of Phase)
      (Completed: 2026-03-16 00:11)

---

## ✅ Acceptance Criteria

- [x] The new demo content file lives under `src/content/event-demos/xv/`. (Completed: 2026-03-16
      00:11)
- [x] The content entry uses `isDemo: true` and the slug `noir-premiere-xv`. (Completed: 2026-03-16
      00:11)
- [x] The asset folder satisfies all symbolic keys referenced by the demo JSON. (Completed:
      2026-03-16 00:11)
- [x] No Ximena-specific names remain in the new JSON or asset module. (Completed: 2026-03-16 00:12)

---

## 📎 References

- [Ximena Source Content](/c:/Code/celebra-me/src/content/events/ximena-meza-trasvina.json)
- [Demo XV Reference](/c:/Code/celebra-me/src/content/event-demos/xv/demo-xv.json)
- [Ximena Asset Module](/c:/Code/celebra-me/src/assets/images/events/ximena-meza-trasvina/index.ts)
