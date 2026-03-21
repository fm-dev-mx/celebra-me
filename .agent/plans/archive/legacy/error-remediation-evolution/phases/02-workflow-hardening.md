# Phase 02: Workflow Hardening

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Rewrite the manual `.agent/workflows/error-remediation.md` framework into a strict
7-state machine with hard cycle limits, auto-rollback functionality, and domain-specific validation
checks.

**Weight:** 40% of total plan

---

## 🎯 Analysis / Findings

The current `error-remediation.md` workflow allows unchecked "fix-fail" loops where an agent applies
a fix, creates a new error, and blindly attempts another fix on top of the broken state.

This phase transforms the workflow document using the diagnostic tools created in Phase 01.

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

### Task 1: Rewrite `.agent/workflows/error-remediation.md`

- [x] Clear existing 31-line framework. (5% of Phase)
- [x] Define the 7 states explicitly with required input/outputs:
  - `1. CLASSIFY`: Execute `error-classifier.mjs`.
  - `2. EXTRACT_CONTEXT`: Execute `context-extractor.mjs`.
  - `3. ROOT_CAUSE`: Agent hypothesis and justification.
  - `4. DESIGN_FIX`: Agent code change proposal.
  - `5. SNAPSHOT`: Snapshot creation via `git stash push -u` to capture exact state (requires clean
    working tree).
  - `6. APPLY`: Modify files (workflow mutation).
  - `7. VERIFY`: Re-run failing command (`pnpm type-check`, `pnpm test`, etc.).
- [x] Document loop limits and rollback behavior. (10% of Phase)
  - Hard cap of 3 diagnostic cycles before user escalation.
  - Mandatory rollback from snapshot if `VERIFY` fails, restoring tree completely. Snapshot cleanup
    must occur after.

### Task 2: Implement Trivial Error Fast-Path

- [x] Define what qualifies as a "Trivial Error":
  - Error must be fully localized to a single file and isolated line (e.g., simple typo, missing
    import).
  - Classifier must explicitly flag `autoFixable: false` but `complexity: trivial`.
- [x] Define the fast-path bypass logic:
  - Bypasses `ROOT_CAUSE`.
  - Proceeds directly: `CLASSIFY` → `EXTRACT_CONTEXT` → `DESIGN_FIX` → `SNAPSHOT` → `APPLY` →
    `VERIFY`.
- [x] Implement safeguards:
  - If `VERIFY` fails on a fast-path fix, the workflow immediately defaults to the full 7-state path
    on the next cycle and logs a fast-path failure.

### Task 2: Implement BFF/Hydration Guard

- [x] Add explicit detection rules for Astro/React mismatch patterns:
  - [x] `client:*` directives missing on stateful components. (5% of Phase)
  - [x] Server-only `import.meta.env` accessed in client components. (5% of Phase)
  - [x] Non-serializable classes (Date, Map, Set) passed from BFF to client. (5% of Phase)
  - [x] `window`/`document` accessed during SSR (requires `useEffect` or `onMount`). (5% of Phase)

### Task 3: Domain-Specific Validation Rules

- [x] Integrate checks to be run _during_ the `DESIGN_FIX` state:
  - [x] **WCAG**: Must not remove `aria-*` tags or alter semantic HTML incorrectly.
  - [x] **3-Layer Color**: Modifications to `.scss` files must preserve defined CSS tokens.

---

## ✅ Acceptance Criteria

- [x] `error-remediation.md` correctly specifies the `error-classifier.mjs` script execution.
- [x] The 7-state machine is fully documented, including input/outputs for each step.
- [x] The workflow explicitly mentions avoiding "fix-fail loops" via auto-rollback and branch
      resets.
- [x] Validation checklist for A11y and aesthetics is present before the `APPLY` step.

---

## 📎 References

- [Planning Governance Framework](../../README.md)
- [Diagnostic Automation](./01-diagnostic-automation.md)
