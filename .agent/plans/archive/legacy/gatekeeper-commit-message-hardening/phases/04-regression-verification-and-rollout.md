# Phase 04: Regression Verification and Rollout

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Extend existing test coverage and run the relevant validation passes for deterministic
and AI-assisted title generation paths.

**Weight:** 20% of total plan

---

## 🎯 Analysis / Findings [STATUS: PENDING]

- Existing unit and integration tests already cover scaffold generation and commit validation, so
  this phase should extend that baseline rather than introduce a new harness.
- AI tests must mock transport and never rely on live network access.
- The rollout must verify that commit-range validation and workflow-generated commit validation
  behave consistently.

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### Targeted Coverage

- [ ] Update unit tests for exact per-file coverage, renamed and deleted paths, and stricter subject validation (35% of Phase)
- [ ] Add workflow tests for deterministic dominance scoring, AI assist gating, and fallback behavior (35% of Phase)

### Verification Runs

- [ ] Run targeted governance tests for commit validation and workflow integration (15% of Phase)
- [ ] Run the broader lint, type-check, and test passes required by the changed files (15% of Phase)

---

## ✅ Acceptance Criteria

- [ ] Deterministic-only commits pass the hardened contract.
- [ ] AI-assisted titles pass when valid and fall back cleanly when not.
- [ ] Commit-range validation matches local commit validation outcomes for the same message shape.

---

## 📎 References

- [tests/unit/commit-validation-contract.test.ts](../../../../tests/unit/commit-validation-contract.test.ts)
- [tests/unit/gatekeeper-workflow-hardening.test.ts](../../../../tests/unit/gatekeeper-workflow-hardening.test.ts)
- [tests/integration/gatekeeper-workflow.integration.test.ts](../../../../tests/integration/gatekeeper-workflow.integration.test.ts)
