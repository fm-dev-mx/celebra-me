# Phase 02: Script Enhancement

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Add lean report profiles, deterministic session management, and workflow subcommands
that offload split and retry logic from markdown into executable scripts.

**Weight:** 30% of total plan

---

## 🎯 Analysis / Findings [STATUS: COMPLETED]

- `gatekeeper.mjs` needs machine-focused report profiles and selective checks without breaking the
  current full JSON contract.
- `gatekeeper-workflow.mjs` should own session creation, invalidation, cleanup, and split staging.
- Workflow routing must escalate unmapped files, S0 drift, and invalid session state without asking
  markdown to interpret those conditions.

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

### Gatekeeper Core

- [x] Add `--report-profile full|workflow|route` and `--checks` support to `gatekeeper.mjs` (35% of
      Phase)
- [x] Emit `workflowRoute`, `workflowReasons`, `autoFixCommands`, and session metadata in lean
      report profiles (15% of Phase)

### Workflow Orchestration

- [x] Extend `gatekeeper-workflow.mjs` with `inspect`, `autofix`, `stage`, `scaffold`, and `cleanup`
      subcommands (30% of Phase)
- [x] Implement atomic session writes, TTL-based invalidation, branch / HEAD / signature mismatch
      rejection, and idempotent cleanup in `.git/` (20% of Phase)

---

## ✅ Acceptance Criteria

- [x] Machine consumers can read route and split decisions from a lean report without full findings
      payloads.
- [x] One command can stage a domain split deterministically from saved session state.
- [x] Stale session files cannot be reused silently.

---

## 📎 References

- [.agent/governance/bin/gatekeeper.mjs](../../../governance/bin/gatekeeper.mjs)
- [.agent/governance/bin/gatekeeper-workflow.mjs](../../../governance/bin/gatekeeper-workflow.mjs)
- [.agent/governance/bin/gatekeeper-commit-ready.mjs](../../../governance/bin/gatekeeper-commit-ready.mjs)
