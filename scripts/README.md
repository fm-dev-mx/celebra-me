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

| Command                     | Canonical Script               | Purpose                                                                              |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| `pnpm ops check-links`      | `scripts/check-links.mjs`      | validate relative links inside changed Markdown files                                |
| `pnpm ops validate-schema`  | `scripts/validate-schema.mjs`  | compare theme-contract variants against modular section-theme selectors              |
| `pnpm ops validate-commits` | `scripts/validate-commits.mjs` | replay commitlint and commit-audit checks across a commit range                      |
| `pnpm ops graphify-views`   | `scripts/graphify/entry.ts`    | generate Graphify operational domain and community reports                           |
| `pnpm ops graphify-refresh` | `scripts/graphify/refresh.ts`  | rebuild, cluster, promote, fingerprint, and validate the canonical Graphify snapshot |

Removed one-shot commands (`optimize-assets`, `new-invitation`, `adopt-legacy-events`, `ops dbs`)
are no longer registered. Use `pnpm dbs` and `pnpm invitation:*` for invitation operations.

## Invitation Provisioning & Promotion Commands

| Command                              | Audience      | Canonical Script                                              | Purpose                                                                |
| ------------------------------------ | ------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm dbs`                           | Human / agent | `scripts/provision/dbs-cli.ts`                                | Canonical read-only matrix: schema migrations, registry publication, migrate readiness |
| `pnpm dbs --compact`                 | Human / agent | `scripts/provision/managed-status.ts`                         | Connectivity CONTENT + SCHEMA only (not publication; Git-hook friendly) |
| `pnpm invitation:release`            | Human / agent | `scripts/provision/invitation-release-cli.ts`                 | Define, plan, apply, approve, and release managed invitations          |
| `pnpm invitation:reconcile`          | Human / agent | `scripts/provision/invitation-reconcile-cli.ts`               | Guided Local/Preview managed divergence reconciliation                 |
| `pnpm invitation:content-parity`     | Human / agent | `scripts/provision/content-parity-cli.ts`                     | Read-only semantic content parity (excludes RSVP/PII)                  |
| `pnpm invitation:preview-fixture`    | Human / agent | `scripts/provision/preview-e2e-fixture-cli.ts`                | Preview-only E2E fixture bootstrap (not Dashboard create)              |
| `pnpm invitation:purge-by-id`        | Human / agent | `scripts/provision/invitation-id-purge-cli.ts`                | Preview-only UUID purge with dry-run audit                             |
| `pnpm invitation:cross-db-reconcile` | Human / agent | `scripts/provision/cross-db-invitation-reconciliation-cli.ts` | Read-only cross-DB invitation inventory parity                         |
| `pnpm invitation:inventory-audit`    | Human / agent | `scripts/provision/inventory-audit-cli.ts`                    | Tabular/JSON inventory matrix (distinct from `dbs` summary)            |
| `pnpm invitation:diagnose-identity`  | Human / agent | `scripts/provision/managed-identity-diagnostics-cli.ts`       | Managed identity / alias diagnostics                                   |
| `pnpm invitation:local-corpus`       | Human / agent | `scripts/provision/local-render-corpus/cli.ts`                | Bootstrap local render corpus slugs                                    |
| `pnpm invitation:romina-draft-reset` | Owner (temp)  | `scripts/provision/romina-draft-reset-cli.ts`                 | Temporary one-off; remove after owner confirms complete                |

Operator cards:
[`docs/domains/database/cheatsheets/README.md`](../docs/domains/database/cheatsheets/README.md).

The CLI resolves source/package input through `invitation-package-input.ts`, retains one immutable
plan per target, and delegates mutation ordering/result synthesis to
`invitation-lifecycle-execution.ts`. Preview apply uses `preview-apply.ts`. Production promotion
uses `invitation-promote.ts` + `production-preflight.ts` + the managed import engine. Any blocked
selected target aborts the complete mutation phase.

## Validation Commands

`pnpm validate:markdown-tables` checks active Markdown tables in the current changed range. Warnings
are advisory; excessive cell prose is blocking. For explicit correction, use
`pnpm format:markdown-tables -- --files <path...>` or `pnpm format:markdown-tables -- --all-active`.
The pre-commit `lint-staged` pipeline applies the correction, runs Prettier, and performs a final
check. In VS Code, install the recommended Markdownlint extension; an explicit save runs its fix
action before the configured Prettier formatter.

| Command                      | Canonical Script                   | Purpose                                                       |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `pnpm validate:event-parity` | `scripts/validate-event-parity.ts` | compare content events against the Supabase `events` table    |
| `pnpm validate:structure`    | `scripts/validate-structure.mjs`   | validate deterministic repository and agent structure rules   |
| `pnpm validate:staged`       | `scripts/validate-staged.mjs`      | validate staged files without modifying them                  |
| `pnpm validate:changed`      | `scripts/validate-changed.mjs`     | validate staged, unstaged, and untracked working-tree changes |

## Database Command Inventory

| Command                                    | Audience       | Owner          | Purpose                                                               |
| ------------------------------------------ | -------------- | -------------- | --------------------------------------------------------------------- |
| `pnpm db:push`                             | Safety rail    | `package.json` | blocked fail-closed replacement for ambiguous raw Supabase push       |
| `pnpm db:start` / `pnpm db:stop`           | Human          | Supabase CLI   | start/stop persistent-local Supabase stack                            |
| `pnpm db:availability:verify`              | Agent/human    | `scripts/db/`  | fail-closed reachability + read-only session preflight                |
| `pnpm db:prod:backup`                      | Owner          | `scripts/db/`  | read-only production public dump                                      |
| `pnpm db:prod:backup:critical`             | Owner          | `scripts/db/`  | complete Production DB/Auth/Storage critical set                      |
| `pnpm db:prod:backup:daily`                | Operator       | `scripts/db/`  | scheduled local critical backup + EFS/report verification             |
| `pnpm db:backup:verify-manifest`           | Human          | `scripts/db/`  | validate critical backup manifest                                     |
| `pnpm db:backup:create-manifest`           | Human          | `scripts/db/`  | assemble manifest from captured artifacts                             |
| `pnpm db:backup:create-disposable-fixture` | Human          | `scripts/db/`  | synthetic recovery set for disposable drill                           |
| `pnpm db:restore:verify-disposable`        | Human          | `scripts/db/`  | rebuild/restore/verify in disposable-test only                        |
| `pnpm db:contract:verify`                  | Human/agent    | `scripts/db/`  | read-only mutation schema/privilege contract verification             |
| `pnpm db:prod:audit`                       | Owner/agent    | `scripts/db/`  | object-audit readiness vs disposable reference                        |
| `pnpm db:branch:parity`                    | Agent/human    | `scripts/db/`  | branch migration identity/content sensitivity (`--json`)              |
| `pnpm db:branch:diagnose`                  | Agent          | `scripts/db/`  | branch-lane diagnosis from structured evidence                        |
| `pnpm db:branch:remediate-disposable`      | Agent          | `scripts/db/`  | verify then rebuild disposable-test only                              |
| `pnpm release-check`                       | Owner          | `scripts/db/`  | clean-HEAD type-check + test + build; writes release evidence         |
| `pnpm db:migrate`                          | Human/agent    | `scripts/db/`  | Canonical schema migrate CLI (`migrate-cli.ts`; TTY Cancelar default) |
| `pnpm db:local:audit`                      | Human/agent    | `scripts/db/`  | object-audit readiness for persistent-local                           |
| `pnpm db:preview:audit`                    | Human/agent    | `scripts/db/`  | object-audit readiness for Preview                                    |
| `pnpm db:preview:sync-invitations`         | Human/agent    | `scripts/db/`  | Prod→Preview content mirror (specialized; RSVP reset)                 |
| `pnpm db:disposable:start`                 | Human/agent    | `scripts/db/`  | start disposable containers                                           |
| `pnpm db:disposable:reset`                 | Human/agent/CI | `scripts/db/`  | reset isolated disposable test environment                            |
| `pnpm db:disposable:test`                  | Human          | `scripts/db/`  | pgTAP + migration tests (also embedded in validate pipeline)          |
| `pnpm test:db:rsvp-contracts`              | CI             | `scripts/db/`  | disposable RSVP DB/HTTP contracts                                     |
| `pnpm test:db:managed-contracts`           | CI             | `scripts/db/`  | disposable managed rekey contracts                                    |
| `pnpm db:disposable:phase3-concurrency`    | Human          | `scripts/db/`  | concurrency/stale-plan scenarios                                      |
| `pnpm db:validate:pipeline`                | Human/agent    | `scripts/db/`  | full database validation pipeline                                     |
| `pnpm db:local:restore-from-dump`          | Human          | `scripts/db/`  | import production dump into persistent local (PII)                    |
| `pnpm db:prod:export-auth`                 | Owner          | `scripts/db/`  | read-only Auth user export                                            |
| `pnpm db:prod:export-storage`              | Owner          | `scripts/db/`  | Storage bucket export                                                 |
| `pnpm db:sql:lint -- --file <path>`        | Human/agent    | `scripts/db/`  | lint a manifest-bearing production SQL patch                          |
| `pnpm db:prod:patch -- --file <path>`      | Owner          | `scripts/db/`  | specialized Production SQL (dry-run default; owner `--apply`)         |

Status evidence classes and retention notes:
[`docs/domains/database/cheatsheets/README.md`](../docs/domains/database/cheatsheets/README.md).

Behavior and safety rules live in [`docs/database-workflow.md`](../docs/database-workflow.md) and
the [manual SQL manifest](../.agent/rules/manual-sql-manifest.md).

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
pnpm validate:event-parity
pnpm ops validate-commits HEAD~5 HEAD
```
