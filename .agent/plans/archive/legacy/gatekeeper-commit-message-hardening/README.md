# Gatekeeper Commit Message Precision Hardening With Optional AI Title Assist

**Completion:** `0%` | **Status:** `PENDING`

**Objective:** Harden Gatekeeper commit generation so every multi-file commit body covers each
touched file exactly once, while optional AI can refine only the title subject when deterministic
signals are weak.

**Estimated Duration:** 4 phases / ~1-2 days **Owner:** system-agent **Created:** 2026-03-16

---

## 🎯 Scope

### In Scope

- Centralize deterministic commit-message analysis in shared governance modules.
- Tighten commitlint and workflow generation to exact per-file body coverage for all commits.
- Add optional AI subject assist with deterministic fallback and no AI authority over scope, type,
  body coverage, or final validation.
- Update governance docs, tests, and plan artifacts to reflect the new contract.

### Out of Scope

- Making AI mandatory for commit creation.
- Using AI to generate body bullets, scope selection, or validation decisions.
- Changing ADU routing, domain splitting, or protected-branch behavior outside commit-message logic.

---

## 🔴 Blockers & Risks

| Risk / Blocker                            | Severity | Mitigation                                                                          |
| ----------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| AI title assist adds latency or failures  | Medium   | Keep AI opt-in, assist-only, time-bounded, and always fall back to deterministic.   |
| Workflow and commitlint contract drift    | High     | Keep commitlint as the single blocking owner and reuse shared analysis helpers.     |
| Exact per-file bullets increase strictness| Medium   | Update tests and docs in the same implementation pass.                              |
| Long paths can exceed body line budgets   | Medium   | Abort scaffold generation when the path leaves too little room for a useful clause. |

---

## 🗺️ Phase Index

| #   | Phase                                                                                             | Weight | Status    |
| --- | ------------------------------------------------------------------------------------------------- | ------ | --------- |
| 01  | [Audit and Trade-off Analysis](./phases/01-audit-and-tradeoff-analysis.md)                       | 20%    | `PENDING` |
| 02  | [Deterministic Scaffold and AI Title Assist](./phases/02-deterministic-scaffold-and-ai-title-assist.md) | 35%    | `PENDING` |
| 03  | [Validation and Governance Alignment](./phases/03-validation-and-governance-alignment.md)       | 25%    | `PENDING` |
| 04  | [Regression Verification and Rollout](./phases/04-regression-verification-and-rollout.md)       | 20%    | `PENDING` |

---

> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../README.md). No phase may be committed without owner approval.
