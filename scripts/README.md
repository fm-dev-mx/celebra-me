# Scripts & Governance Tools

This directory contains the core automation and governance tools for the `celebra-me` project.

## Core Tools

| Script                                          | Purpose                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `.agent/governance/bin/gatekeeper.mjs`          | Core validation engine and machine-readable report emitter. Owns governance findings and route data.   |
| `.agent/governance/bin/gatekeeper-workflow.mjs` | Workflow CLI for `inspect`, `autofix`, `stage`, `scaffold`, and `cleanup`. Owns `.git/` session state. |
| `scripts/validate-commits.mjs`                  | Commit-range validator that runs commitlint against full commit messages and enforces ADU atomicity.   |
| `scripts/cli.mjs`                               | Standardized CLI entry point for ops commands.                                                         |

## Gatekeeper Report Profiles

Use `.agent/governance/bin/gatekeeper.mjs` with `--report-json` and `--report-profile`:

- `full`: backward-compatible full report for deep inspection
- `workflow`: lean report for workflow automation
- `route`: minimal route and split payload for lightweight consumers

## Gatekeeper Workflow Commands

Use `.agent/governance/bin/gatekeeper-workflow.mjs` for commit orchestration:

- `inspect`: quick workflow report plus `.git/gatekeeper-session.json`
- `autofix`: retry auto-fix commands in quick mode, then run one final strict verification pass
- `stage --domain <id>`: stage one ADU split and refresh `.git/gatekeeper-s0*` artifacts
- `scaffold --domain <id>`: emit a commit message scaffold for the selected domain
- `scaffold --domain <id>` may optionally refine the subject with AI when policy and env config
  enable it
- `cleanup`: remove workflow-owned `.git/` session artifacts

## Compatibility Entry Points

- `pnpm gatekeeper:commit-ready`: compatibility wrapper to workflow inspection
- `pnpm gatekeeper:commit-ready:create <branch>`: create an explicit branch, then run inspection
- protected branch auto-branching from `main` and `develop` remains owned by `gatekeeper.mjs`

## Ownership Rules

- Commit-message rules are owned by `commitlint.config.cjs`.
- Route and split decisions are owned by `gatekeeper.mjs`.
- Protected-branch auto-branching is owned by `gatekeeper.mjs`.
- Explicit branch creation for compatibility helpers is owned by `gatekeeper-commit-ready.mjs`.
- `.git/` session lifecycle is owned by `gatekeeper-workflow.mjs`.
- Hook execution order is owned by `.husky/*`.
- Commit intent planning is owned by `.agent/plans/README.md` and each active plan's
  `commit-map.json`.
- Documentation explains commands and owners; it does not duplicate executable logic.

## Commit Message Contract

- Subjects must follow `type(scope): verb target`.
- Subjects must describe the dominant change, not commit bookkeeping.
- In plan-aware mode, `type`, `scope`, and subject come from the selected commit unit.
- In fallback mode, type and scope are deterministic. Optional AI may refine only the subject
  fragment.
- Multi-file or complex commits require exact per-file bullets in the body.
- Each bullet must use one real changed file path followed by a concise action-led description.
- Folder-wide, prefix, and grouped bullets are not valid.
