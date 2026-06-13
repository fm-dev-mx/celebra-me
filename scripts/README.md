# Scripts & Governance Tools

This directory contains the operational scripts exposed through `pnpm ops`, plus the repository
script documentation for governance-sensitive tooling.

## Dispatcher

- `scripts/cli.mjs`: canonical command dispatcher for `pnpm ops <command>`

`package.json` owns the public script alias (`"ops": "node scripts/cli.mjs"`). `scripts/cli.mjs`
owns the command inventory.

## Dev Scripts

| Command                                | Purpose                                                |
| -------------------------------------- | ------------------------------------------------------ |
| `node scripts/dev/seed-invitation.mjs` | Create a mock invitation project with placeholder data |

> **Note:** Dev scripts are not exposed through `pnpm ops` — run them directly with `node`. They
> require `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. All data generated is
> synthetic placeholder data; no real client PII should be hardcoded.

## Available Ops Commands

| Command                          | Canonical Script                   | Purpose                                                                                                                 |
| -------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm ops check-links`           | `scripts/check-links.mjs`          | validate relative links inside changed Markdown files                                                                   |
| `pnpm ops optimize-assets`       | `scripts/optimize-assets.mjs`      | optimize and copy the current demo asset set into the expected invitation asset slots                                   |
| `pnpm ops validate-schema`       | `scripts/validate-schema.mjs`      | compare centralized theme-contract variants against modular section-theme selectors and documented base-style fallbacks |
| `pnpm ops validate-event-parity` | `scripts/validate-event-parity.ts` | compare content events against the Supabase `events` table                                                              |
| `pnpm ops validate-commits`      | `scripts/validate-commits.mjs`     | replay commitlint and commit-audit checks across a commit range                                                         |
| `pnpm ops new-invitation`        | `scripts/new-invitation.mjs`       | scaffold a new invitation content file plus related support artifacts                                                   |

`pnpm ops adopt-legacy-events` remains registered for historical visibility but fails closed.

## Database Command Inventory

| Command                               | Owner          | Purpose                                                         |
| ------------------------------------- | -------------- | --------------------------------------------------------------- |
| `pnpm db:push`                        | `package.json` | blocked fail-closed replacement for ambiguous raw Supabase push |
| `pnpm db:sql:lint -- --file <path>`   | `scripts/db/`  | lint a manifest-bearing production SQL patch                    |
| `pnpm db:prod:patch -- --file <path>` | `scripts/db/`  | dry-run-only production patch entrypoint                        |

Behavior and safety rules live in [`docs/database-workflow.md`](../docs/database-workflow.md) and
the [manual SQL manifest](../.agent/db/manual-sql-manifest.md).

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
pnpm ops check-links
pnpm ops validate-schema
pnpm ops validate-event-parity --allowMissingDb
pnpm ops validate-commits HEAD~5 HEAD
pnpm ops new-invitation mi-evento --eventType xv
```
