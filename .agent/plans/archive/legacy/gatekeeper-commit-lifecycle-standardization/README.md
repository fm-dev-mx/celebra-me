# Gatekeeper Commit Lifecycle Standardization

**Completion:** `100%` | **Status:** `READY_FOR_COMMIT`

## Commit Strategy Status

- `drafted`: yes
- `final review completed`: yes
- `gatekeeper ready`: yes
- source of truth: `./commit-map.json`

**Objective:** Standardize the executable lifecycle for `plan -> commit strategy -> gatekeeper` so
the repository has one deterministic commit path for planned work, small changes, and retroactive
regularization.

**Estimated Duration:** 3 phases / ~0.5 day **Owner:** fm-dev-mx **Created:** 2026-03-20

---

## Scope

### In Scope

- tighten active-plan validation so draft plans can exist, but `inspect` only executes when the plan
  is genuinely ready for gatekeeper
- enforce a single canonical planned header contract across plan data and runtime scaffolding
- document the official lifecycle, including `No-Plan Intake`, micro-plans, and retroactive plans
- align the Noir restoration plan example with the canonical header contract

### Out of Scope

- changing commitlint subject semantics away from `verb + target`
- introducing automatic change-set splitting inside `gatekeeper-workflow`
- replacing the existing gatekeeper session model or git hook chain

---

## Implemented File Modifications

| File                                                     | Why it changes                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `.agent/governance/bin/validate-commit-plan.mjs`         | Makes commit strategy lifecycle validation match the documented phases and enforces canonical `messagePreview.header` values. |
| `.agent/governance/bin/commit-plan.mjs`                  | Blocks `inspect` until the active plan is actually ready and every executable unit has a gatekeeper-ready status.             |
| `.agent/governance/bin/gatekeeper-workflow.mjs`          | Refuses non-canonical planned headers at scaffold/commit time and uses the canonical unit header by default.                  |
| `.agent/plans/README.md`                                 | Becomes the primary contract for lifecycle, readiness, one-unit worktrees, and no-plan intake.                                |
| `.agent/workflows/gatekeeper-commit.md`                  | Documents the operator sequence around validation, inspect, one-unit worktrees, and wrapper semantics.                        |
| `docs/core/git-governance.md`                            | Aligns core governance docs with the executable workflow contract.                                                            |
| `.agent/plans/noir-premiere-restoration/commit-map.json` | Aligns example `messagePreview.header` values with the canonical unit subject.                                                |
| `.agent/plans/noir-premiere-restoration/README.md`       | Aligns the documented Noir commit sequence with the canonical header contract.                                                |

---

## Success Criteria

- active plans can validate in draft mode without falsely looking gatekeeper-ready
- `inspect` blocks when `readyForGatekeeperAt` is missing or any active unit remains in `draft` /
  `locked`
- `messagePreview.header` cannot diverge from `type(domain): verb target`
- docs define one official path for:
  - planned work
  - small new work
  - already-written work without a plan
- the current Noir example no longer teaches a conflicting header format

---

## Validation Outcome

- `pnpm gatekeeper:plans:validate` must pass after these changes
- targeted Node governance scripts must load without syntax errors

---

## Planned Commit Split

1. `refactor(governance): tighten gatekeeper readiness and scaffold contract`
2. `docs(governance): document gatekeeper lifecycle and no-plan intake`
3. `docs(docs): align noir restoration commit previews`

These units are recorded in `./commit-map.json`.
