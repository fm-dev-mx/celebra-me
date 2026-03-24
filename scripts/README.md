# Scripts & Governance Tools

This directory contains the core automation and governance tools for the `celebra-me` project.

## Core Tools

| Script                                          | Purpose                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `.agent/governance/bin/gatekeeper-workflow.mjs` | Workflow CLI for `inspect`, `commit`, and `cleanup`. Owns `.git/` session state.               |
| `.agent/governance/bin/doctor-commit-plan.mjs`  | Plan doctor that validates active plan readiness and working-tree coverage before commit flow.  |
| `scripts/validate-commits.mjs`                  | Commit-range validator that replays commitlint against full planned messages and trailer metadata. |
| `scripts/cli.mjs`                               | Standardized CLI entry point for operational commands such as schema and event parity validation. |

## Gatekeeper Workflow Commands

Use `.agent/governance/bin/gatekeeper-workflow.mjs` for commit orchestration:

- `inspect --plan <id>`: validate one active plan against the live working tree and write
  `.git/gatekeeper-session.json`
- `commit --plan <id> --unit <id>`: inspect, stage, and commit one planned unit atomically
- `cleanup`: remove workflow-owned `.git/` session artifacts

## Ops CLI Commands

Use `pnpm ops <command>` for repository operations:

- `optimize-assets`
- `validate-schema`
- `validate-event-parity`
- `validate-commits`
- `new-invitation`

## Ownership Rules

- Commit-message rules are owned by `commitlint.config.cjs`.
- Workflow execution and `.git/` session lifecycle are owned by `gatekeeper-workflow.mjs`.
- Plan readiness diagnostics are owned by `doctor-commit-plan.mjs`.
- Hook execution order is owned by `.husky/*`.
- Commit intent planning is owned by `.agent/plans/README.md` and each active plan's
  `commit-map.json`.
- Documentation explains commands and owners; it does not duplicate executable logic.

## Commit Message Contract

- Subjects must follow `type(scope): verb target`.
- Subjects must describe the dominant change, not commit bookkeeping.
- In plan-aware mode, `type`, `scope`, and subject come from the selected commit unit.
- The semantic body comes from `messagePreview.summary` in the plan.
- Traceability lives in a dedicated `Files:` section with one exact file path per bullet.
- Planned commits must end with `Plan-Id` and `Commit-Unit` trailers.
