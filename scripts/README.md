# Scripts & Governance Tools

This directory contains the core automation and governance tools for the `celebra-me` project.

## Core Tools

| Script                                          | Purpose                                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `.agent/governance/bin/gatekeeper.mjs`          | Core validation engine and machine-readable report emitter. Owns governance findings and route data.  |
| `.agent/governance/bin/gatekeeper-workflow.mjs` | Workflow CLI for `inspect`, `stage`, `scaffold`, `commit`, and `cleanup`. Owns `.git/` session state. |
| `scripts/validate-commits.mjs`                  | Commit-range validator that replays commitlint against full planned messages and trailer metadata.    |
| `scripts/cli.mjs`                               | Standardized CLI entry point for ops commands.                                                        |

## Gatekeeper Report Profiles

Use `.agent/governance/bin/gatekeeper.mjs` with `--report-json` and `--report-profile`:

- `full`: backward-compatible full report for deep inspection
- `workflow`: lean report for workflow automation
- `route`: minimal route and split payload for lightweight consumers

## Gatekeeper Workflow Commands

Use `.agent/governance/bin/gatekeeper-workflow.mjs` for commit orchestration:

- `inspect --plan <id>`: validate one active plan against the live working tree and write
  `.git/gatekeeper-session.json`
- `stage --plan <id> --unit <id>`: stage exactly one planned unit and refresh `.git/gatekeeper-s0*`
  artifacts
- `scaffold --unit <id>`: emit the final planned message with summary bullets, `Files:`, and
  trailers
- `commit --unit <id>`: revalidate the staged unit and create the commit
- `cleanup`: remove workflow-owned `.git/` session artifacts

## Ownership Rules

- Commit-message rules are owned by `commitlint.config.cjs`.
- Route and split decisions are owned by `gatekeeper.mjs`.
- Protected-branch auto-branching is owned by `gatekeeper.mjs`.
- `.git/` session lifecycle is owned by `gatekeeper-workflow.mjs`.
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
