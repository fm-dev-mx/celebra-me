---
name: supabase-postgres
description: |
  Postgres query optimization, indexing, connection pooling, schema design,
  locking, and monitoring guidance for Celebra-me.
domain: backend
version: 1.0.0
when_to_use:
  - Writing or reviewing SQL queries and schema
  - Diagnosing slow queries or connection issues
  - Designing indexes or analyzing query plans
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
related_skills:
  - supabase
  - backend-engineering
related_docs:
  - docs/core/architecture.md
---

# Supabase Postgres Best Practices

> **Related skills**: [`supabase`](../supabase/SKILL.md) for RLS and Auth,
> [`backend-engineering`](../backend-engineering/SKILL.md) for service/repository layers.

## Priority Categories

| Priority | Category                 | Impact      |
| -------- | ------------------------ | ----------- |
| 1        | Query Performance        | CRITICAL    |
| 2        | Connection Management    | CRITICAL    |
| 3        | Security & RLS           | CRITICAL    |
| 4        | Schema Design            | HIGH        |
| 5        | Concurrency & Locking    | MEDIUM-HIGH |
| 6        | Data Access Patterns     | MEDIUM      |
| 7        | Monitoring & Diagnostics | LOW-MEDIUM  |
| 8        | Advanced Features        | LOW         |

## Query Performance

### Missing Indexes

Check for sequential scans on large tables:

```sql
EXPLAIN ANALYZE SELECT * FROM large_table WHERE column = 'value';
```

Add indexes for columns used in `WHERE`, `JOIN`, `ORDER BY`, and `GROUP BY`:

```sql
CREATE INDEX CONCURRENTLY idx_table_column ON table_name (column);
```

### Partial Indexes

Use partial indexes for filtered queries:

```sql
CREATE INDEX idx_active_events ON events (start_date)
    WHERE status = 'published';
```

### Composite Indexes

Match the index order to the query predicate order. For `WHERE a = 1 AND b = 2`, create
`INDEX ON table (a, b)` — column order matters.

## Connection Management

- Use **transaction mode** PgBouncer for HTTP-based workloads (serverless functions).
- Use **session mode** for long-lived connections (admin tools, migrations).
- Pool size = `max_connections * 0.8 / active_workers` as a starting point.
- Avoid running migrations during peak traffic.

## Schema Design

- Prefer `bigint` over `int` for primary keys — avoids overflow with high-volume tables.
- Use `timestamptz` instead of `timestamp` for event dates.
- Add `CHECK` constraints for business rules at the database level.
- Use `NOT NULL` with a default where applicable to avoid null-coalescing in queries.

## Concurrency and Locking

- `UPDATE` and `DELETE` on the same row from concurrent transactions can cause deadlocks.
- Prefer `FOR UPDATE SKIP LOCKED` when selecting rows for processing in job queues.
- Keep transactions short — hold locks for the minimum time.
- Avoid `LOCK TABLE` in application code.

## Monitoring

Enable and query `pg_stat_statements` to identify slow queries:

```sql
SELECT query, mean_exec_time, calls, rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

Use `auto_explain` in development to log slow queries automatically.

## Diagnostics

When investigating a performance issue:

1. Check `pg_stat_activity` for running queries and locks.
2. Run `EXPLAIN (ANALYZE, BUFFERS)` on the suspected query.
3. Review `pg_stat_user_indexes` for unused indexes.
4. Check connection pool utilization in Supabase dashboard.

## References

- https://www.postgresql.org/docs/current/performance-tips.html
- https://supabase.com/docs/guides/database/overview
