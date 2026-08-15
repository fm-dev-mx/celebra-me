# Manual SQL Manifest

Manual production SQL patch files first checked by `pnpm db:prod:patch -- --dry-run --file <path>`
must start with a manifest before any SQL statement. Direct production SQL is prohibited as a normal
workflow; all schema changes must be introduced through versioned migrations in
`supabase/migrations/`. The patch entrypoint is lint-only; this manifest does not authorize
execution. Owner mutation is available only through `pnpm prod:apply -- --patch <path>`.

Older non-manifest SQL files are historical records only. Do not copy them as templates for new
production patches.

```sql
-- @script-id: YYYYMMDD_short_description
-- @purpose: one sentence describing the production correction
-- @env: production
-- @ticket: issue, PR, incident, or operator note reference
-- @tables: comma-separated public tables touched
-- @operation: update | insert | delete | select-only
-- @expected-rows-min: 0
-- @expected-rows-max: 0
-- @requires-backup: true
-- @dry-run-query: SELECT statement that previews exactly the target rows
-- @rollback: concrete rollback or explicit reason rollback is not possible
```

## Field Rules

- `@script-id` must be stable and unique enough to identify the patch in logs and review notes.
- `@purpose` must describe the user-visible or operational problem being corrected.
- `@env` must be exactly `production`.
- `@ticket` must point to the review, incident, or operator record that approved preparing the
  patch.
- `@tables` must name every table the SQL could touch.
- `@operation` must match the highest-risk operation in the file.
- `@expected-rows-min` and `@expected-rows-max` must bound the intended row count.
- `@requires-backup` must be `true`.
- `@dry-run-query` must be a read-only preview query with the same targeting predicate.
- Residual: after the intended state exists, `@dry-run-query` returns 0 rows.
- Paired: when `@paired-stores` is set, the dry-run must select `store` and every `@pair-key`
  column. Those files are auto-discovered into `pnpm dbs` unless `@catalog: historical`.
- `@rollback` must be actionable enough for review; if rollback is impossible, say why.

Keep the SQL narrowly scoped. Broad destructive operations, schema changes, RLS changes,
`SECURITY DEFINER`, and `CASCADE` belong in reviewed migrations or a future execution harness, not
manual production patches.
