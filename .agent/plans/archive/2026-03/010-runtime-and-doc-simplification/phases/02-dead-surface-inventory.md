# Phase 02: Dead Surface Inventory

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Audit `src/`, `tests/`, and evergreen docs to separate provably removable surface
from simplification candidates that still have active consumers.

**Weight:** 10% of total plan

---

## Findings

- `src/components/dashboard/guests/use-guests.ts` has no runtime consumers.
- `src/components/dashboard/guests/use-guest-mutations.ts` has no runtime consumers.
- `tests/components/guests.hooks.test.tsx` was the only surviving consumer of those hooks.
- Multiple files in `src/components/behavior/` still have active consumers and were therefore
  classified as simplification candidates, not safe-delete targets.
- The active evergreen drift was concentrated in plan governance and `docs/DOC_STATUS.md`, while
  architecture and conventions already centered on `src/lib/invitation/page-data.ts`.

---

## Acceptance Criteria

- Safe-delete candidates are backed by reference evidence, not by style preference.
- Thin wrappers with active consumers remain out of scope for this pass.
- Inventory findings are specific enough to drive deletion and test migration work directly.
