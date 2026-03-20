# Planning Governance Framework

> Source of truth for creating, executing, tracking, and archiving plans in `celebra-me`.

**Last Updated:** 2026-03-20  
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
- `gatekeeper-workflow`, `commitlint`, hooks, and CI validate or execute the contract; they do not
  define intent.
- If work will be committed, it must belong to a plan. Small changes use a micro-plan;
  already-written work uses a retroactive plan before commit.
- Every non-completed executable plan must define a commit strategy before implementation begins.
- Every non-completed executable plan must review and lock that strategy before `gatekeeper-commit`
  is used.

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

## Commit Strategy Lifecycle

### Draft the Commit Strategy

Every executable plan must create a preliminary `commit-map.json` before implementation work begins.

This preliminary strategy must define, per unit:

- one dominant implementation intent
- expected file boundaries
- a planned commit header that already matches the canonical unit subject
- a commit purpose
- the owning phase
- any compatible support files under `allowRelated`

Implementation work must not begin without this preliminary partition.

### Implement Against the Planned Units

During implementation, changes are expected to stay aligned with the planned units.

Allowed adjustments:

- split a unit when a second dominant intent appears
- merge units when the real change is more cohesive than expected
- expand `allowRelated` when supporting files are legitimately attached to the same dominant intent

Disallowed adjustments:

- postponing commit planning until implementation is complete
- letting `gatekeeper-workflow` invent commit structure from heuristics
- mixing docs, refactor, and fix work inside one unit unless the plan explicitly justifies it

### Run the Final Commit Review

Before running `gatekeeper-commit`, the plan must receive a second review of the commit strategy.

That review must confirm:

- actual changed files still match the intended units
- planned headers still describe the dominant intent correctly
- purposes still match the implemented change
- `include` and `allowRelated` still reflect reality
- phase descriptions and plan notes reflect the implemented scope
- validation results, runtime compatibility notes, and intentional deltas are documented
- any gatekeeper-relevant scope expansion is recorded

### Mark the Plan Ready for Gatekeeper

`gatekeeper-commit` is only for plans whose commit strategy has already been reviewed and marked
ready.

For non-completed plans, readiness is expressed in `commit-map.json` through:

- top-level `commitStrategyReview.readyForGatekeeperAt`
- unit-level statuses promoted from `draft` / `locked` to `ready` or `revised-after-gatekeeper`

If readiness is missing, or any active unit still remains in `draft` / `locked`, then
`gatekeeper-workflow` must block instead of inferring intent.

### Update the Plan When Gatekeeper Finds Drift

If `gatekeeper-workflow` or related validation finds a material issue, the plan must be updated
before continuing.

Plan updates are mandatory for:

- `unit_mismatch`
- `unit_ambiguity`
- `invalid_plan_contract`
- findings that change unit boundaries
- findings that change commit headers, purpose, or allowed related files
- findings that require documenting an architectural exception

Purely operational fixes that do not change intent, file boundaries, or the explanation of the
change may proceed without redesigning the plan.

### Required `commit-map.json` shape

```json
{
  "planId": "{plan-id}",
  "mode": "planned-commits",
  "defaultFallback": "none",
  "commitStrategyReview": {
    "draftedAt": "2026-03-20T10:00:00Z",
    "reviewedAt": "2026-03-20T11:30:00Z",
    "readyForGatekeeperAt": "2026-03-20T11:45:00Z",
    "notes": "Final review confirmed the unit boundaries after implementation."
  },
  "units": [
    {
      "id": "{unit-id}",
      "phaseId": "01-{phase-id}",
      "status": "draft",
      "domain": "core",
      "type": "refactor",
      "subject": {
        "verb": "retire",
        "target": "legacy presenter layers"
      },
      "purpose": "collapse route-only indirection into page-data assembly",
      "include": ["src/lib/**"],
      "allowRelated": ["tests/**", "docs/**"],
      "correctionPolicy": "absorb-compatible",
      "messagePreview": {
        "header": "refactor(core): retire legacy presenter layers",
        "summary": [
          "collapse route-only indirection into page-data assembly",
          "keep related tests and docs inside the same implementation intent"
        ]
      }
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
- use active-lifecycle statuses from: `draft`, `locked`, `ready`, `revised-after-gatekeeper`,
  `completed`

Each unit must not:

- author `scope` separately from `domain`
- rely on free-form markdown to explain the commit message
- mix unrelated cleanup with feature or refactor work
- use unsupported correction policies

### Strategy review rules

`commitStrategyReview` is required for every plan whose `manifest.json` status is not `COMPLETED`.

It must always record:

- `draftedAt`

Once the final commit review begins, it must also record:

- `reviewedAt`
- `notes`

Once the plan is ready for `gatekeeper-commit`, it must also record:

- `readyForGatekeeperAt`

The timestamps may be equal for small changes, but they must reflect the real lifecycle:

- draft strategy exists before implementation
- final review closes before gatekeeper execution
- readiness only exists once the active units are executable without reinterpretation

### Message preview rules

`messagePreview` is required for active executable plans.

If present:

- `header` must already satisfy commitlint length and format constraints
- `header` must exactly equal `type(domain): verb target`
- `header` becomes the exact planned header that `gatekeeper-workflow` must honor
- `summary` must contain one to four semantic bullets
- `summary` must not contain file paths
- `summary` becomes the exact semantic body that `gatekeeper-workflow` must honor

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

## No-Plan Intake

### Rule

There is no direct commit path without a plan.

If a change will become a commit, it must belong to an executable plan before `gatekeeper-commit` is
used.

### Small change not yet implemented

Create a micro-plan first.

Minimum structure:

- `README.md`
- `CHANGELOG.md`
- `manifest.json`
- `commit-map.json`
- `phases/01-<phase>.md`

Micro-plans may contain:

- one phase
- one unit
- a short objective
- a short final review

### Work already written without a plan

Create a retroactive plan before commit.

That retroactive plan must:

- audit the actual changed files
- identify the dominant implementation intent
- define one or more commit units in `commit-map.json`
- document any required split before `gatekeeper-commit`

### Ephemeral work

Scratch files, disposable debugging, and throwaway experiments stay outside the workflow.

## Workflow Contract

Before `inspect`:

- run `pnpm gatekeeper:plans:validate -- --plan <plan-id>`
- make sure the working tree contains exactly one material commit unit
- remove or isolate unrelated scratch files and unrelated untracked files

### Inspect

```bash
pnpm gatekeeper:workflow:inspect -- --plan <plan-id>
```

`inspect` reads the working tree, validates `commit-map.json`, confirms gatekeeper readiness, and
returns exactly one of:

- `matched_unit`
- `unit_ambiguity`
- `unit_mismatch`
- `plan_archived`
- `plan_not_found`
- `invalid_plan_contract`
- `commit_strategy_not_ready`
- `empty_change_set`

`inspect` is the primary entrypoint.

### Stage

```bash
node .agent/governance/bin/gatekeeper-workflow.mjs stage --plan <plan-id> --unit <unit-id>
```

`stage` stages exactly one unit from the working tree and writes `gatekeeper-s0.json`.

### Scaffold

```bash
node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --unit <unit-id>
```

`scaffold` is non-mutating. It builds the exact planned header, semantic summary bullets, `Files:`
inventory, and required trailers.

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

`manifest.json` may keep its current high-level status model. Commit-strategy lifecycle states do
not need to become manifest statuses if the plan records them in `commit-map.json`.

## Archiving

When a plan is complete:

1. finish the implementation and closure notes
2. finish closure notes in `CHANGELOG.md`
3. move the directory to `.agent/plans/archive/`
4. mark the archived `manifest.json` status as `ARCHIVED`
5. stop using its `commit-map.json` for new execution

Archived plans are historical only. If more work is needed, create a new active plan.

## Continuous Hygiene

- `.agent/plans/` should contain only active plans and `README.md`
- completed or superseded plans should be archived during normal close-out, not during ad hoc
  cleanup
- before starting a new plan, audit the active root for plans that are already complete, replaced,
  or otherwise obsolete
