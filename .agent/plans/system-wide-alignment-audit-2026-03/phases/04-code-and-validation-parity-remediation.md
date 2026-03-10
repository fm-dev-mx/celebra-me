# Phase 04: Code and Validation Parity Remediation

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Remove false-positive drift by making validation logic match the authoritative theme
contract and docs.

**Weight:** 20% of total plan

---

## Analysis / Findings

- `SHARED_SECTION_VARIANTS` includes `standard`.
- The theme docs state that shared-section base styles live in component-level section styles.
- The schema validator incorrectly treated `standard` as requiring dedicated selectors in
  `src/styles/themes/sections/`.

---

## Execution Tasks [STATUS: COMPLETED]

### Validator Contract

- [x] Updated `scripts/validate-schema.mjs` to treat `standard` as implicit base-style support for
      `family`, `gifts`, `gallery`, and `thankYou`. (Completed: 2026-03-10 12:49)
- [x] Updated `docs/domains/theme/architecture.md` to document the same contract. (Completed:
      2026-03-10 12:49)

---

## Acceptance Criteria

- [x] Shared-section `standard` no longer reports as a schema warning. (Completed: 2026-03-10 12:49)
- [x] Theme architecture docs and validator behavior agree. (Completed: 2026-03-10 12:49)

---

## References

- [scripts/validate-schema.mjs](../../../../scripts/validate-schema.mjs)
- [docs/domains/theme/architecture.md](../../../../docs/domains/theme/architecture.md)
