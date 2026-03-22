# Phase 01: Preflight and Scope Lock

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Confirm the active-surface scope, lock out archive-wide cleanup, and record the
current validation blocker before runtime edits begin.

**Weight:** 15% of total plan

---

## Findings

- `009-agent-governance-onboarding` is already archived and no longer blocks a new executable plan.
- The active runtime surface lives under `src/`, with evergreen docs under `.agent/` and
  `docs/core|domains|DOC_STATUS`.
- `node.exe` / `pnpm` are not executable in the current environment, so validation must remain a
  closeout step instead of a mid-flight gate.

---

## Acceptance Criteria

- The plan is scoped to active runtime, tests, and evergreen docs only.
- Archive-wide cleanup is excluded except for active-reference drift.
- The validation blocker is recorded explicitly in the active plan.
