# Phase 03: Validation and Governance Alignment

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Tighten commitlint to the exact-per-file contract, remove duplicate validator
ownership, and align governance docs with the implemented behavior.

**Weight:** 25% of total plan

---

## 🎯 Analysis / Findings [STATUS: PENDING]

- Commitlint must become stricter than the prior grouped-path model to enforce one bullet per
  changed file.
- Compatibility validation should route through commitlint instead of carrying its own rule set.
- Governance docs must describe AI as optional assistive behavior only and avoid re-encoding
  executable heuristics.

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### Validation Ownership

- [ ] Tighten commitlint path coverage to exact changed-file bullets only (40% of Phase)
- [ ] Convert the compatibility commit-message validator into a thin commitlint wrapper (20% of Phase)

### Governance Sync

- [ ] Update workflow and governance docs for exact per-file coverage and optional AI title assist (25% of Phase)
- [ ] Update the documentation dashboard for the new active plan and revised workflow contract (15% of Phase)

---

## ✅ Acceptance Criteria

- [ ] Commitlint rejects grouped folder or prefix bullets.
- [ ] Commitlint remains the single blocking owner for commit-message policy.
- [ ] Docs describe AI assist as optional, deterministic fallback as mandatory, and exact per-file bullets as the new contract.

---

## 📎 References

- [commitlint.config.cjs](../../../../commitlint.config.cjs)
- [.agent/governance/bin/validate-commit-msg.mjs](../../../governance/bin/validate-commit-msg.mjs)
- [docs/core/git-governance.md](../../../../docs/core/git-governance.md)
