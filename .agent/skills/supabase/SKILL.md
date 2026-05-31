---
name: supabase
description: |
  Supabase Auth, RLS policies, Edge Functions, Realtime, Storage, CLI, and MCP
  guidance for Celebra-me.
domain: backend
version: 1.0.0
when_to_use:
  - Writing or reviewing Supabase RLS policies
  - Configuring Auth, Edge Functions, Realtime, or Storage
  - Running Supabase CLI commands or migrations
  - Debugging Data API access or JWT issues
preconditions:
  - Read .agent/README.md
  - Read .agent/GATEKEEPER_RULES.md
related_skills:
  - backend-engineering
  - supabase-postgres
related_docs:
  - docs/core/architecture.md
---

# Supabase

> **Related skills**: [`backend-engineering`](../backend-engineering/SKILL.md) for
> service/repository layers, [`supabase-postgres`](../supabase-postgres/SKILL.md) for query
> performance.

## RLS and Auth

### Core Rules

- Always enable RLS on every table in exposed schemas (`public` by default).
- Use `TO authenticated` + `USING (auth.uid() = user_id)` — never `TO authenticated` alone (that is
  authentication without authorization, aka BOLA/IDOR).
- UPDATE policies must have both `USING` and `WITH CHECK`.
- Prefer `TO anon` or `TO authenticated` over `auth.role()` — the function is deprecated.

```sql
-- Correct RLS pattern
CREATE POLICY "users_own_rows" ON table_name
    FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "users_update_own_rows" ON table_name
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);
```

### Security Checklist

- **Never use `raw_user_meta_data` for authorization** — it is user-editable. Use
  `raw_app_meta_data` / `app_metadata`.
- **Deleting a user does not invalidate existing tokens** — sign out or revoke sessions first.
- **Views bypass RLS by default** — use `CREATE VIEW ... WITH (security_invoker = true)` on Postgres
  15+.
- **`SECURITY DEFINER` functions bypass RLS** — never add `SECURITY DEFINER` to resolve a permission
  error. Keep such functions in non-exposed schemas with an `auth.uid()` check.
- **Storage upsert requires INSERT + SELECT + UPDATE** — granting only INSERT is not enough.

## CLI Usage

Discover commands via `--help`, never guess:

```bash
supabase --help                    # Top-level commands
supabase <group> --help            # Subcommands
supabase <group> <command> --help  # Flags
```

### Known Gotchas

- `supabase db query` requires CLI v2.79.0+ — use MCP `execute_sql` or `psql` as fallback.
- `supabase db advisors` requires CLI v2.81.3+ — use MCP `get_advisors` as fallback.
- Always create migration files with `supabase migration new <name>`, never manually.
- Verify migrations with `supabase migration list --local`.

## Making Schema Changes

1. Iterate with `execute_sql` (MCP) or `supabase db query` (CLI) — these do NOT write migration
   history entries.
2. When ready to commit: run advisors, review the security checklist, generate migration with
   `supabase db pull <name> --local --yes`, then verify with `supabase migration list --local`.

## Storage

- Always enable RLS on storage buckets.
- Upsert requires INSERT + SELECT + UPDATE policies.
- Use typed wrappers for REST calls (see `backend-engineering` skill).

## Documentation Lookup

Supabase docs pages can be fetched by appending `.md` to the URL path:

```
https://supabase.com/docs/guides/auth/row-level-security.md
https://supabase.com/docs/guides/api/securing-your-api.md
```

Prefer MCP `search_docs` tool when available, then `.md` fetch, then web search.
