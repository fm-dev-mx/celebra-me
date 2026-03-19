# Planning Governance Framework

> Source of truth for creating, executing, tracking, and archiving plans in `celebra-me`.

**Last Updated:** 2026-03-19  
**Authority:** `.agent/README.md`  
**Scope:** `.agent/plans/`

## Core Rules

- Every active executable plan lives directly under `.agent/plans/<plan-id>/`.
- Every active executable plan must include:
  - `README.md`
  - `CHANGELOG.md`
  - `manifest.json`
  - `commit-map.json`
  - `phases/`
- Archived plans move to `.agent/plans/archive/` and become read-only by convention.
- `.agent/plans/README.md` owns the `commit-map.json` contract.
- `gatekeeper-workflow`, `commitlint`, hooks, and CI validate or execute the contract; they do not define intent.

## Mandatory Structure

```text
.agent/plans/{plan-id}/
├── README.md
├── CHANGELOG.md
├── manifest.json
├── commit-map.json
├── phases/
│   ├── 01-{phase-name}.md
│   ├── 02-{phase-name}.md
│   └── ...
└── post-mortem.md    # optional
```

## Commit Planning Contract

### Purpose

`commit-map.json` is the only source of truth for commit intent in the Gatekeeper commit workflow.

This means:

- the plan owns the commit unit
- the unit owns the subject
- the workflow stages and commits exactly one unit
- commitlint validates conformance to that unit
- CI reconstructs the same unit from commit trailers

There is no commit-planning fallback to domain heuristics.

### Required `commit-map.json` shape

```json
{
  "planId": "{plan-id}",
  "mode": "planned-commits",
  "defaultFallback": "none",
  "units": [
    {
      "id": "{unit-id}",
      "phaseId": "01-{phase-id}",
      "status": "planned",
      "domain": "core",
      "type": "refactor",
      "subject": {
        "verb": "retire",
        "target": "legacy presenter layers"
      },
      "purpose": "collapse route-only indirection into page-data assembly",
      "include": ["src/lib/**"],
      "allowRelated": ["tests/**", "docs/**"],
      "correctionPolicy": "absorb-compatible"
    }
  ]
}
```

### Unit rules

Each unit must:

- represent exactly one dominant implementation intent
- map to a real `phaseId` from `manifest.json`
- define `domain`, `type`, `subject.verb`, `subject.target`, `purpose`, and `include`
- use `allowRelated` only for aligned tests, docs, or support changes
- use `correctionPolicy: "absorb-compatible"`

Each unit must not:

- author `scope` separately from `domain`
- rely on free-form markdown to explain the commit message
- mix unrelated cleanup with feature or refactor work
- use unsupported correction policies

### Domain and scope

- `domain` is authored in `commit-map.json`
- `scope` is derived from `domain`
- `domain-map.json` is not a second source of truth for commit semantics

### Trailers

Every planned commit must end with:

```text
Plan-Id: <plan-id>
Commit-Unit: <unit-id>
```

These trailers are required for local validation, pre-push validation, and CI.

## Workflow Contract

### Inspect

```bash
pnpm gatekeeper:workflow:inspect -- --plan <plan-id>
```

`inspect` reads the working tree, validates `commit-map.json`, and returns exactly one of:

- `matched_unit`
- `unit_ambiguity`
- `unit_mismatch`
- `plan_not_found`
- `invalid_plan_contract`
- `empty_change_set`

### Stage

```bash
node .agent/governance/bin/gatekeeper-workflow.mjs stage --plan <plan-id> --unit <unit-id>
```

`stage` stages exactly one unit from the working tree and writes `gatekeeper-s0.json`.

### Scaffold

```bash
node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --unit <unit-id>
```

`scaffold` is non-mutating. It builds the exact planned subject, deterministic file bullets, and required trailers.

### Commit

```bash
node .agent/governance/bin/gatekeeper-workflow.mjs commit --unit <unit-id>
```

`commit` revalidates the live staged set against the unit and aborts on drift.

## Validation Ownership

- `.agent/plans/README.md`
  - owns plan and `commit-map.json` contract
- `.agent/governance/bin/validate-commit-plan.mjs`
  - validates the contract before runtime execution
- `.agent/governance/bin/gatekeeper-workflow.mjs`
  - inspect, stage, scaffold, commit, cleanup
- `commitlint.config.cjs`
  - validates local commit message conformance to the selected unit
- `scripts/validate-commits.mjs`
  - validates pushed commits from durable trailers plus plan metadata
- `.husky/pre-commit` / `.husky/pre-push`
  - enforce local staged and range validation order

## Manifest Rules

Every active plan still requires a `manifest.json` with:

- `id`
- `title`
- `status`
- `completion`
- `created`
- `updated`
- `owner`
- `phases`

Each `phaseId` used in `commit-map.json` must exist in `manifest.json`.

## Archiving

When a plan is complete:

1. update `manifest.json` to `COMPLETED`
2. finish closure notes in `CHANGELOG.md`
3. move the directory to `.agent/plans/archive/`
4. mark `status: ARCHIVED`
5. stop using its `commit-map.json` for new execution

Archived plans are historical only. If more work is needed, create a new active plan.
