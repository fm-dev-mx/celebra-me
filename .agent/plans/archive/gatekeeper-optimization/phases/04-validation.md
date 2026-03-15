# Phase 04: Validation

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Verify that the optimized workflow converges cleanly, rejects stale session state,
and preserves commit-message and architectural governance.

**Weight:** 15% of total plan

---

## 🎯 Analysis / Findings [STATUS: COMPLETED]

- Validation must prove both efficiency gains and safety retention.
- Session corruption, branch changes, and staged-signature drift need explicit regression coverage.
- Local hooks, CI, and docs must all reflect the same executable control points.

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

### Runtime Validation

- [x] Validate quick autofix retries plus one final strict pass (20% of Phase)
- [x] Validate deterministic multi-domain staging and session invalidation on branch / HEAD /
      signature drift (35% of Phase)
- [x] Validate corrupted or expired session cleanup behavior (15% of Phase)

### Commit Governance Validation

- [x] Validate multi-file body enforcement in `commit-msg` and commit-range validation in CI / local
      scripts (20% of Phase)
- [x] Measure lean report size reduction and confirm no staged-only pre-push no-op remains (10% of
      Phase)

---

## ✅ Acceptance Criteria

- [x] Autofix converges with quick retries and one final strict verification.
- [x] Session mismatch causes a single hard stop and cleanup path instead of repeated loops.
- [x] Multi-file commits without compliant bodies fail locally and in range validation.
- [x] Lean workflow reports are materially smaller than full reports while preserving required
      routing data.

---

## 📎 References

- [.agent/governance/bin/gatekeeper.mjs](../../../governance/bin/gatekeeper.mjs)
- [.agent/governance/bin/gatekeeper-workflow.mjs](../../../governance/bin/gatekeeper-workflow.mjs)
- [scripts/validate-commits.mjs](../../../../scripts/validate-commits.mjs)
