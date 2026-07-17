# Production Patch Execution Workflow

This directory contains generated SQL patches for manual production execution.
**You (the operator) execute these patches.** The agent never connects to production.

---

## Approved patch directory

Only SQL files under `scripts/manual/production-patches/` are valid targets for the
production patch runner. Generated SQL is immutable — do not hand-edit it.

## Prerequisites

| Requirement | Source | How to supply |
|---|---|---|
| `SUPABASE_URL` | Vercel environment / `.env.production.local` | Set as env var: `$env:SUPABASE_URL = "https://<project>.supabase.co"` |
| `PROD_DB_URL` | `.env.production.local` or gitignored secret file | The runner's `getProdDbUrl()` reads from `PROD_DB_URL` env var or `./.env.production.local` etc. |
| `--owner-user-id` | Production Celebra-me admin panel (create user → copy UUID) | Pass as CLI argument to `--apply` |

## Supported PROD_DB_URL formats and project validation

Before executing any patch, the runner verifies that `SUPABASE_URL` and `PROD_DB_URL`
reference the **same Supabase project**. Supported connection string formats:

| Format | Example |
|---|---|
| Direct (db prefix) | `postgresql://user:pass@db.<ref>.supabase.co:5432/postgres` |
| Direct (no prefix) | `postgresql://user:pass@<ref>.supabase.co:5432/postgres` |
| Pooler (ref in username) | `postgresql://<ref>.<region>:pass@<region>.pooler.supabase.com:6543/postgres` |
| Pooler (host prefix) | `postgresql://user:pass@postgres.<ref>.pooler.supabase.com:5432/postgres` |

The project reference is extracted from:
- **SUPABASE_URL**: hostname (`<ref>.supabase.co`)
- **PROD_DB_URL**: hostname OR database username, depending on format

**Pooler URLs** that use `<region>.pooler.supabase.com` hostnames extract the
project reference from the **first segment of the database username**
(e.g., `username = "<ref>.<region>"` → project ref = `<ref>`).

The runner aborts **before connecting** when:
- The project references do not match
- The connection format is unsupported or ambiguous
- Either URL is malformed

No credentials or project URLs are printed in logs.

## Patch SQL properties

- **Generated code** — never edit by hand; run generator `--check` to verify parity.
- **Zero operator-editable placeholders** — all runtime values injected by the runner.
- **Transactional** — wrapped in `BEGIN`/`COMMIT`; preflight failures abort before any mutation.
- **Deterministic** — safe to re-run after a preflight failure.
- **Ownership-conflict safe** — aborts with a clear message rather than silently reassigning.
- **Asset-aware** — validates exactly the expected number of active canonical assets.
- **Idempotent preflight** — repeated dry-run or preflight-triggered re-runs produce the same result.

## Execution order

1. **Create customer user** in the Celebra-me production system.
2. **Obtain production UUID** from the new user.
3. **Prepare invitation** through the dashboard workflow (slug, event type, correct owner, assets).
4. **Configure environment**: set `SUPABASE_URL` and ensure `PROD_DB_URL` is available.
5. **Dry-run** (recommended — no database connection).
6. **Apply** with `--owner-user-id <UUID> --file <patch.sql>`.
7. **Verify** with read-only queries.

## Commands

### Dry-run (lint only, no database connection)

The `db:prod:patch` script delegates mode selection to the CLI. No mode is hardcoded.

```bash
pnpm db:prod:patch -- --dry-run \
  --file "scripts/manual/production-patches/<patch-file>.sql"
```

Expected output:
```
Production patch dry-run passed lint: .../<patch-file>.sql
No database connection was opened and no SQL was executed.
```

### Apply (PowerShell)

```powershell
$env:SUPABASE_URL = "https://<project>.supabase.co"

pnpm db:prod:patch -- --apply `
  --owner-user-id "<PRODUCTION_OWNER_USER_ID>" `
  --file "scripts/manual/production-patches/<patch-file>.sql"
```

The runner:
1. Validates UUID syntax before connecting
2. Validates `SUPABASE_URL` (HTTPS, `.supabase.co` origin, no credentials/query/fragment)
3. Verifies `SUPABASE_URL` and `PROD_DB_URL` reference the same project
4. Injects both values into the psql session (session-scoped `set_config`)
5. Executes the entire SQL transaction

### Generator parity check

If the SQL changes, regenerate it:

```bash
pnpm exec tsx scripts/dev/generate-romina-invitation-sql.ts
```

Then verify the checked-in artifact matches:

```bash
pnpm exec tsx scripts/dev/generate-romina-invitation-sql.ts --check
```

## Ownership conflict handling

The SQL checks both `invitations.created_by` and `events.owner_user_id` before
making any changes. If either is populated with a user different from the supplied
owner UUID, the patch aborts with a message identifying the conflict.

## Safe re-run conditions

- **After preflight failure**: fix the issue and re-run — no mutation occurred.
- **After successful apply**: do not re-run the same patch; the invitation is already published.
- **Dry-run**: always safe, never opens a database connection.

## Post-execution verification

Run these read-only queries to confirm:

```sql
-- Invitation status
SELECT slug, event_type, status, created_by, base_demo_id, theme_id
FROM public.invitations WHERE slug = '<slug>' AND event_type = '<type>';

-- Published content
SELECT slug, event_type, version, published_at
FROM public.published_invitation_content WHERE slug = '<slug>' AND event_type = '<type>';

-- Event ownership
SELECT slug, event_type, owner_user_id, status, published_at
FROM public.events WHERE slug = '<slug>';

-- Owner membership
SELECT e.slug, em.user_id, em.membership_role
FROM public.event_memberships em
JOIN public.events e ON e.id = em.event_id
WHERE e.slug = '<slug>' AND em.deleted_at IS NULL;
```

## Recovery

| Failure | Action |
|---|---|
| Preflight abort | Fix the reported issue, re-run |
| Mid-execution failure | Restore from verified backup, fix root cause, re-apply |
| Wrong owner applied | Archive the invitation through the approved workflow |
