---
name: production-sql-patches
description: |
  Author continuation-aware production SQL patches for soft-delete Postgres/Supabase tables:
  state-aware preflight, explicit INSERT/UPDATE/RESURRECT (not ON CONFLICT), field preservation,
  manifest headers, and rollback guidance. Patches are exceptional fixes only; managed invitation
  content goes through `pnpm prod:apply -- --slug`. Does not execute production SQL.
domain: backend
version: 1.1.0
when_to_use:
  - Writing or reviewing a manual production SQL patch
  - Continuation updates on soft-delete tables
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/rules/database.md
  - Read .agent/rules/manual-sql-manifest.md
  - Explicit user authorization before any production-oriented write guidance that implies execution
related_skills:
  - supabase
  - supabase-postgres
  - client-invitation-audit
related_docs:
  - .agent/rules/manual-sql-manifest.md
  - docs/database-workflow.md
---

# Production SQL Patches

Operational authoring for patches under `scripts/manual/production-patches/`. **Manifest format** is
owned by [`.agent/rules/manual-sql-manifest.md`](../../rules/manual-sql-manifest.md); the lint,
plan, and owner apply flow is owned by
[`docs/database-workflow.md`](../../../docs/database-workflow.md). This skill owns continuation-safe
SQL patterns.

## When a patch is the wrong tool

A patch is narrow, owner-applied DML for an exceptional correction that no other workflow can
express yet. It is never a parallel path for work that already has an owner workflow
([`.agent/rules/database.md`](../../rules/database.md)):

- **Schema** belongs in a versioned `supabase/migrations/` file applied with
  `pnpm prod:apply -- --schema`.
- **Managed invitation content** belongs in its definition, released with `pnpm invitation:release`
  and applied to Production with `pnpm prod:apply -- --slug <slug>`. Do not embed invitation content
  JSON in a patch to publish or update a managed invitation.

Never execute production SQL without explicit current-task authorization.

## Patterns

### 1. State-aware preflight

Do not abort solely because a row exists (continuation). Allow 0 or 1 active row; abort on ambiguity
(>1). Resolve/verify owner UUID. Log state.

### 2. Explicit DO blocks — not ON CONFLICT

Soft-delete + unique constraints without `deleted_at` make `ON CONFLICT` unsafe for resurrect.

Three states per target key:

1. No row → `INSERT`
2. Active (`deleted_at IS NULL`) → `UPDATE` with `COALESCE` on preserved fields
3. Soft-deleted → `UPDATE` clearing `deleted_at` (RESURRECT)

### 3. Field preservation

| Field          | Rule                               |
| -------------- | ---------------------------------- |
| `created_by`   | `COALESCE(created_by, v_owner_id)` |
| `published_at` | `COALESCE(published_at, now())`    |
| `version`      | Increment on content update        |
| `updated_at`   | Always `now()`                     |

### 4. Owner and intermediate IDs

Centralize owner via `set_config('app.owner_user_id', …, true)` once; pass intermediate IDs the same
way between DO blocks. `pnpm prod:apply -- --patch` requires `--owner-user-id` only when the SQL
reads `app.owner_user_id`.

### 5. Manifest

Every new patch starts with the `@script-id` / `@purpose` / `@env: production` / dry-run / rollback
header from `manual-sql-manifest.md`. `@expected-rows-min` may be `0` for continuation. Residual and
paired-store discovery rules live in that manifest; do not restate them here.

### 6. Rollback

Document whether re-running UPDATE/RESURRECT is enough. Destructive DELETE rollbacks require a
verified backup and explicit operator confirmation language in the file.

## Hard constraints

- Do not run production mutations from this skill.
- Do not invent schema outside migrations.
- Do not use a patch to publish or update managed invitation content.
- Prefer dry-run SELECT evidence in the manifest before any apply recommendation.
