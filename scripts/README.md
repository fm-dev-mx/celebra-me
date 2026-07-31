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

| Command                           | Canonical Script                                | Purpose                                                                                   |
| --------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm dbs`                        | `scripts/provision/dbs-cli.ts`                  | Read-only Local/Preview/Production status matrix (managed invitations + schema lifecycle) |
| `pnpm dbs --compact`              | `scripts/provision/managed-status.ts`           | Compact CONTENT + SCHEMA composing existing classifiers (Git-hook friendly)               |
| `pnpm invitation:update`          | `scripts/provision/invitation-update-cli.ts`    | Define, plan, apply, package, and approve managed invitations for Local/Preview           |
| `pnpm invitation:reconcile`       | `scripts/provision/invitation-reconcile-cli.ts` | Guided Local/Preview managed divergence reconciliation                                    |
| `pnpm invitation:content-parity`  | `scripts/provision/content-parity-cli.ts`       | Read-only semantic content parity across environments (excludes RSVP/PII)                 |
| `pnpm invitation:promote`         | `scripts/provision/invitation-promote-cli.ts`   | Owner-only Production managed-content promotion from an exact Preview-approved release    |
| `pnpm invitation:preview-fixture` | `scripts/provision/preview-e2e-fixture-cli.ts`  | Preview-only E2E fixture bootstrap for `e2e-preview-publication` (not Dashboard create)   |

The CLI resolves source/package input through `invitation-package-input.ts`, retains one immutable
plan per target, and delegates mutation ordering/result synthesis to
`invitation-lifecycle-execution.ts`. Preview apply uses `preview-apply.ts`. Production promotion
uses `invitation-promote.ts` + `production-preflight.ts` + the managed import engine. Any blocked
selected target aborts the complete mutation phase.

## Validation Commands

| Command                      | Canonical Script                   | Purpose                                                       |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `pnpm validate:event-parity` | `scripts/validate-event-parity.ts` | compare content events against the Supabase `events` table    |
| `pnpm validate:structure`    | `scripts/validate-structure.mjs`   | validate deterministic repository and agent structure rules   |
| `pnpm validate:staged`       | `scripts/validate-staged.mjs`      | validate staged files without modifying them                  |
| `pnpm validate:changed`      | `scripts/validate-changed.mjs`     | validate staged, unstaged, and untracked working-tree changes |

## Database Command Inventory

| Command                                    | Owner          | Purpose                                                                            |
| ------------------------------------------ | -------------- | ---------------------------------------------------------------------------------- |
| `pnpm db:push`                             | `package.json` | blocked fail-closed replacement for ambiguous raw Supabase push                    |
| `pnpm db:prod:backup`                      | `scripts/db/`  | read-only production data dump                                                     |
| `pnpm db:prod:backup:critical`             | `scripts/db/`  | complete read-only Production DB/Auth/Storage set (Phase 3 or predecessor profile) |
| `pnpm db:prod:backup:daily`                | `scripts/db/`  | scheduled local critical backup, EFS/report verification, metrics, and retention   |
| `pnpm db:backup:create-disposable-fixture` | `scripts/db/`  | synthetic complete recovery set for a disposable drill                             |
| `pnpm db:restore:verify-disposable`        | `scripts/db/`  | rebuild, restore, and verify a complete set in disposable-test only                |
| `pnpm db:contract:verify`                  | `scripts/db/`  | read-only required mutation schema/privilege contract verification                 |
| `pnpm db:prod:audit`                       | `scripts/db/`  | read-only production migration history & schema audit                              |
| `pnpm db:branch:parity`                    | `scripts/db/`  | read-only branch migration identity/content + DB-sensitive detection (`--json`)    |
| `pnpm db:branch:diagnose`                  | `scripts/db/`  | read-only branch-lane diagnosis from structured evidence (`--evidence-json`)       |
| `pnpm db:branch:remediate-disposable`      | `scripts/db/`  | verify then rebuild disposable-test only (`--verify-only` / `--execute`)           |
| `pnpm db:prod:migrate`                     | `scripts/db/`  | apply reviewed migrations to production (with preflight checks & backup)           |
| `pnpm db:preview:migrate`                  | `scripts/db/`  | apply pending migrations to Preview (`PREVIEW_DB_URL`)                             |
| `pnpm db:preview:audit`                    | `scripts/db/`  | read-only Preview schema drift audit (`PREVIEW_DB_URL`)                            |
| `pnpm db:disposable:reset`                 | `scripts/db/`  | reset isolated disposable test environment container                               |
| `pnpm test:db:rsvp-contracts`              | `scripts/db/`  | reset disposable DB, start PostgREST, run public RSVP Jest DB/HTTP contracts       |
| `pnpm db:disposable:phase3-concurrency`    | `scripts/db/`  | run system concurrency/stale-plan scenarios against disposable-test                |
| `pnpm db:validate:pipeline`                | `scripts/db/`  | full database validation pipeline (baseline, latest, pgTAP, application flows)     |
| `pnpm db:local:restore-from-dump`          | `scripts/db/`  | import production dump into persistent local database                              |
| `pnpm db:sql:lint -- --file <path>`        | `scripts/db/`  | lint a manifest-bearing production SQL patch                                       |
| `pnpm db:prod:patch -- --file <path>`      | `scripts/db/`  | dry-run-only production patch entrypoint                                           |

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
