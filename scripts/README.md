# Scripts & Governance Tools

This directory contains the core automation and validation tools for the `celebra-me` project.

## Core Tools

| Script | Purpose |
| --- | --- |
| `scripts/validate-commits.mjs` | Commit-range validator that replays commitlint against commit messages in a revision range. |
| `scripts/cli.mjs` | Standardized CLI entry point for operational commands such as schema and event parity validation. |

## Ops CLI Commands

Use `pnpm ops <command>` for repository operations:

- `optimize-assets`
- `validate-schema`
- `validate-event-parity`
- `validate-commits`
- `new-invitation`

## Ownership Rules

- Commit-message rules are owned by `commitlint.config.cjs`.
- Commit-range validation is owned by `scripts/validate-commits.mjs`.
- Hook execution order is owned by `.husky/*`.
- Commit intent planning is documented under `.agent/plans/`.
- Documentation explains commands and owners; it does not duplicate executable logic.

## Commit Message Contract

- Subjects must follow `type(scope): verb target`.
- Subjects must describe the dominant change, not commit bookkeeping.
- Conventional commit validation is enforced locally and in CI.
