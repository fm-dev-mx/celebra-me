---
name: supabase
description: |
  Supabase Auth, RLS policies, Edge Functions, Realtime, Storage, CLI, MCP, and
  Postgres query, index, pooling, schema, and locking guidance for Celebra-me.
domain: backend
version: 1.3.0
when_to_use:
  - Writing or reviewing Supabase RLS policies
  - Configuring Auth, Edge Functions, Realtime, or Storage
  - Running Supabase CLI commands or migrations
  - Debugging Data API access or JWT issues
  - Writing or reviewing SQL queries and schema
  - Diagnosing slow queries, connection issues, or query plans
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/rules/database.md before operational database work
related_skills:
  - backend-engineering
related_docs:
  - docs/core/architecture.md
---

# Supabase

> **Related skills**: [`backend-engineering`](../backend-engineering/SKILL.md) for
> service/repository layers; [`database-parity`](../database-parity/SKILL.md) for migration identity
> and backups.

## Current Library Docs (Context7)

When `@supabase/supabase-js`, Auth, RLS helpers, Storage, or CLI behavior is uncertain, consult
current library docs via Context7 (or the runtime's equivalent docs MCP) using the versions pinned
in `package.json`. Prefer also this skill and `docs/database-workflow.md`. Context7 never overrides
Celebra-me migrations, RLS contracts, or canonical docs.

## RLS and Auth

### Core Rules

- Always enable RLS on every table in exposed schemas (`public` by default).
- Use `TO authenticated` + `USING (auth.uid() = user_id)` — never `TO authenticated` alone (that is
  authentication without authorization, aka BOLA/IDOR).
- Prefer `TO anon` or `TO authenticated` over `auth.role()` — the function is deprecated.

### Security Checklist

- **Never use `raw_user_meta_data` for authorization** — it is user-editable. Use
  `raw_app_meta_data` / `app_metadata`.
- **Deleting a user does not invalidate existing tokens** — sign out or revoke sessions first.
- **Views bypass RLS by default** — use `CREATE VIEW ... WITH (security_invoker = true)` on Postgres
  15+.
- **`SECURITY DEFINER` functions bypass RLS** — never add `SECURITY DEFINER` to resolve a permission
  error. Keep such functions in non-exposed schemas with an `auth.uid()` check.

## CLI Usage

Discover commands via `--help`, never guess:

```bash
supabase --help                    # Top-level commands
supabase <group> --help            # Subcommands
supabase <group> <command> --help  # Flags
```

Do **not** run raw `supabase db push` (linked or `--db-url` Production). Use
`pnpm db:migrate -- --target <local|preview|production|disposable-test>`. Production MCP
`apply_migration` and mutating `execute_sql` are blocked; read-only Production MCP is allowed.

## Making Schema Changes

Follow [database safety](../../rules/database.md) and the
[database workflow](../../../docs/database-workflow.md): author versioned migrations, validate on
disposable-test, and promote through guarded target workflows. Do not iterate with ad-hoc SQL on
persistent Local, Preview, or Production and then reverse-engineer migration history. Production
apply remains owner-only; a request to author SQL does not authorize its execution.

## Storage

- Always enable RLS on storage buckets.
- Upsert requires INSERT + SELECT + UPDATE policies.
- Use typed wrappers for REST calls (see `backend-engineering` skill).

## Postgres Performance and Schema

### Query Performance

#### Missing Indexes

Check for sequential scans on large tables:

```sql
EXPLAIN ANALYZE SELECT * FROM large_table WHERE column = 'value';
```

Add indexes for columns used in `WHERE`, `JOIN`, `ORDER BY`, and `GROUP BY`:

```sql
CREATE INDEX CONCURRENTLY idx_table_column ON table_name (column);
```

#### Partial Indexes

Use partial indexes for filtered queries:

```sql
CREATE INDEX idx_published_events ON events (published_at)
    WHERE status = 'published';
```

#### Composite Indexes

Match the index order to the query predicate order. For `WHERE a = 1 AND b = 2`, create
`INDEX ON table (a, b)` — column order matters.

### Connection Management

- Use **transaction mode** PgBouncer for HTTP-based workloads (serverless functions).
- Use **session mode** for long-lived connections (admin tools, migrations).
- Pool size = `max_connections * 0.8 / active_workers` as a starting point.
- Avoid running migrations during peak traffic.

### Schema Design

- Prefer `bigint` over `int` for primary keys — avoids overflow with high-volume tables.
- Use `timestamptz` instead of `timestamp` for event dates.
- Add `CHECK` constraints for business rules at the database level.
- Use `NOT NULL` with a default where applicable to avoid null-coalescing in queries.

### Concurrency and Locking

- `UPDATE` and `DELETE` on the same row from concurrent transactions can cause deadlocks.
- Prefer `FOR UPDATE SKIP LOCKED` when selecting rows for processing in job queues.
- Keep transactions short — hold locks for the minimum time.
- Avoid `LOCK TABLE` in application code.

### Monitoring

Enable and query `pg_stat_statements` to identify slow queries:

```sql
SELECT query, mean_exec_time, calls, rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

Use `auto_explain` in development to log slow queries automatically.

### Diagnostics

When investigating a performance issue:

1. Check `pg_stat_activity` for running queries and locks.
2. Run `EXPLAIN (ANALYZE, BUFFERS)` on the suspected query.
3. Review `pg_stat_user_indexes` for unused indexes.
4. Check connection pool utilization in Supabase dashboard.

## Documentation Lookup

Supabase docs pages can be fetched by appending `.md` to the URL path:

```
https://supabase.com/docs/guides/auth/row-level-security.md
https://supabase.com/docs/guides/api/securing-your-api.md
```

Prefer MCP `search_docs` tool when available, then `.md` fetch, then web search.

Postgres references: https://www.postgresql.org/docs/current/performance-tips.html and
https://supabase.com/docs/guides/database/overview.
