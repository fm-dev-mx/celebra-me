---
name: production-sql-patches
description: |
  Author continuation-aware production SQL patches for soft-delete Postgres/Supabase tables:
  state-aware preflight, explicit INSERT/UPDATE/RESURRECT (not ON CONFLICT), field preservation,
  manifest headers, payload sync, and rollback guidance. Does not execute production SQL.
domain: backend
version: 1.0.0
when_to_use:
  - Writing or reviewing a manual production SQL patch
  - Continuation updates on soft-delete tables
  - Syncing canonical JSON payloads into SQL-embedded jsonb
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

Operational authoring for patches under `scripts/manual/production-patches/` (or equivalent).
**Manifest format** is owned by
[`.agent/rules/manual-sql-manifest.md`](../../rules/manual-sql-manifest.md). This skill owns
continuation-safe SQL patterns.

Schema changes still belong in versioned `supabase/migrations/`. Manual patches are corrections, not
a parallel migration system. Never execute production SQL without explicit current-task
authorization.

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
way between DO blocks.

### 5. Manifest

Every new patch starts with the `@script-id` / `@purpose` / `@env: production` / dry-run / rollback
header from `manual-sql-manifest.md`. `@expected-rows-min` may be `0` for continuation.

### 6. Canonical payload sync

When SQL embeds `v_new_content := '…'::jsonb`, keep it identical to the canonical JSON file. Sync
technique and test sketch:
[`references/content-payload-sql-sync.md`](references/content-payload-sql-sync.md).

### 7. Rollback

Document whether re-running UPDATE/RESURRECT is enough. Destructive DELETE rollbacks require backup

- explicit operator confirmation language in the file.

## Hard constraints

- Do not run production mutations from this skill.
- Do not invent schema outside migrations.
- Prefer dry-run SELECT evidence in the manifest before any apply recommendation.
