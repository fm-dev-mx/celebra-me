# Scripts & Governance Tools

This directory contains the operational scripts exposed through `pnpm ops`, plus the repository
script documentation for governance-sensitive tooling.

## Dispatcher

- `scripts/cli.mjs`: canonical command dispatcher for `pnpm ops <command>`

`package.json` owns the public script alias (`"ops": "node scripts/cli.mjs"`). `scripts/cli.mjs`
owns the command inventory.

## Available Ops Commands

| Command                          | Canonical Script                    | Purpose                                                                               |
| -------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `pnpm ops optimize-assets`       | `scripts/optimize-assets.mjs`       | optimize and copy the current demo asset set into the expected invitation asset slots |
| `pnpm ops validate-schema`       | `scripts/validate-schema.mjs`       | compare centralized theme-contract variants against section-theme selectors           |
| `pnpm ops validate-event-parity` | `scripts/validate-event-parity.mjs` | compare content events against the Supabase `events` table                            |
| `pnpm ops validate-commits`      | `scripts/validate-commits.mjs`      | replay commitlint and commit-audit checks across a commit range                       |
| `pnpm ops new-invitation`        | `scripts/new-invitation.mjs`        | scaffold a new invitation content file plus related support artifacts                 |

## Ownership Rules

- Public npm script aliases are owned by `package.json`.
- Ops command registration and help output are owned by `scripts/cli.mjs`.
- Command-specific behavior is owned by the corresponding script file in `scripts/`.
- Commit-message policy is owned by `commitlint.config.cjs` and `docs/core/git-governance.md`.
- Hook execution order is owned by `.husky/*`.

Documentation should point to these source files instead of duplicating executable logic.

## Examples

```bash
pnpm ops --help
pnpm ops validate-schema
pnpm ops validate-event-parity --allowMissingDb
pnpm ops validate-commits HEAD~5 HEAD
pnpm ops new-invitation mi-evento --eventType xv
```
