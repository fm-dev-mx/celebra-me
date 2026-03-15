# Phase 03: Workflow Refactoring

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Rewrite the Gatekeeper commit workflow, hooks, package scripts, and docs so each
governance rule has one executable owner and markdown becomes orchestration-only.

**Weight:** 25% of total plan

---

## 🎯 Analysis / Findings [STATUS: COMPLETED]

- Workflow markdown currently embeds banned vocabulary, split heuristics, and manual staging steps
  that should live in scripts or hooks.
- Hooks and docs describe a sequence that no longer matches actual validation ownership.
- Commit-message body enforcement must move fully into `commitlint.config.cjs`.

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

### Workflow and Hooks

- [x] Replace manual markdown logic with workflow command references for inspect, autofix, stage,
      scaffold, and cleanup (30% of Phase)
- [x] Reorder `.husky/pre-commit` to run formatting first and strict verification second, including
      S0 mode validation (25% of Phase)
- [x] Replace `.husky/pre-push` staged Gatekeeper usage with commit-range validation and tests (15%
      of Phase)

### Contract Alignment

- [x] Update `package.json` scripts for lean workflow entrypoints and compatibility aliases (10% of
      Phase)
- [x] Move multi-file body enforcement fully into `commitlint.config.cjs` and update
      `scripts/validate-commits.mjs` to validate full commit messages (20% of Phase)

---

## ✅ Acceptance Criteria

- [x] `gatekeeper-commit.md` becomes orchestration-only.
- [x] Hook order validates the final staged snapshot instead of a pre-format snapshot.
- [x] No governance rule is expressed as executable logic in more than one place.

---

## 📎 References

- [.agent/workflows/gatekeeper-commit.md](../../../workflows/gatekeeper-commit.md)
- [.husky/pre-commit](../../../../.husky/pre-commit)
- [.husky/pre-push](../../../../.husky/pre-push)
- [package.json](../../../../package.json)
