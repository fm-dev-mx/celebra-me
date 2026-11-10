# Login alias migration

`migrate-login-alias.mjs` uses only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the process
environment. It never loads environment files. Supply credentials through the owner's existing
secure environment setup, separately for each target.

Owner commands for Local and Preview (not executed by this task):

```sh
pnpm auth:migrate-login-alias --dry-run
pnpm auth:migrate-login-alias --apply
```

Apply accepts only the canonical Local and Preview API identities. Production and unknown hosted
targets are rejected before any API call in apply mode. Production remains dry-run only here: the
owner applies its backfill through `pnpm prod:apply -- --patch` with
`scripts/manual/production-patches/20261109_auth_login_alias_app_metadata_backfill.sql`, which adds
the plan review, backup coverage, and the owner gate (see "Protected login aliases" in
[`docs/core/release-process.md`](../../docs/core/release-process.md)). Do not activate alias-only
login in Production until that backfill is complete.

## Read-only check

```sh
pnpm auth:check-login-alias
```

`--check` only reads the account directory of the environment named by `SUPABASE_URL` and prints
totals, never an alias, an email or an account id:

```json
{
  "target": "preview",
  "accounts": 120,
  "protectedAliases": 40,
  "legacyOnly": 0,
  "duplicates": 0,
  "ok": true
}
```

- `target`: the environment `SUPABASE_URL` belongs to (`local`, `preview`, `production` or
  `unknown`). Check it before recording evidence: a result is proof only for that environment.
- `legacyOnly`: accounts whose alias is only in `user_metadata`. They cannot log in by alias.
- `duplicates`: aliases owned by more than one account. Login rejects them.
- Exit code 0 only when both are zero and the directory is not empty; otherwise 1, with "Login alias
  prerequisite is NOT met". An empty directory usually means the wrong target or key.

It may be run against any environment, Production included, because it never writes; it cannot be
combined with `--apply`. Its output is the evidence recorded for the `auth-login-alias-app-metadata`
entry of `supabase/data-prerequisites.json`: see "Data prerequisites" in
[`docs/core/release-process.md`](../../docs/core/release-process.md) for how to record it and what
to do when it fails.

Resetting a password from the admin panel keeps an alias that is already in `app_metadata` and does
not copy one from `user_metadata`: a reset is not a repair for a legacy-only alias. Run the
backfill.

## Pending password change report

`check-pending-passwords.mjs` checks accounts with `must_change_password` open in `app_metadata`. It
is read-only and prints anonymous totals and age distributions without user IDs or emails.

```sh
pnpm auth:check-pending-passwords
```

Example output:

```json
{
  "target": "preview",
  "accounts": 120,
  "pendingPasswords": 2,
  "active": 1,
  "expired": 1,
  "estimated": 0,
  "unknown": 0,
  "ageDays": {
    "0-1": 1,
    "2-7": 0,
    "8-30": 0,
    ">30": 1,
    "unknown": 0
  },
  "oldestDays": 35,
  "newestDays": 0,
  "ok": true,
  "clean": false
}
```

- `target`: environment detected from `SUPABASE_URL`.
- `accounts`: total accounts found in the directory.
- `pendingPasswords`: accounts with `must_change_password: true`.
- `active`: accounts whose temporary password has not expired.
- `expired`: accounts whose temporary password has passed its 24h window.
- `estimated`: accounts lacking `temp_password_expires_at` whose age was estimated from
  `created_at`.
- `unknown`: accounts lacking both `temp_password_expires_at` and `created_at` (`updated_at` is
  never used to prevent unrelated updates from rejuvenating age).
- `ageDays`: distribution of pending changes grouped by age (0-1 days, 2-7 days, 8-30 days, >30
  days, unknown).
- `oldestDays` / `newestDays`: age range in days across open changes with known/estimated age.
- `ok`: true if directory returned accounts in advisory mode; requires 0 pending in strict mode.
- `clean`: true only when `pendingPasswords === 0` and `accounts > 0`.

Use `--strict` to make the check fail with exit code 1 if any account has `must_change_password`
open:

```sh
pnpm auth:check-pending-passwords --strict
```

Its output is evidence for the `auth-must-change-password` prerequisite in
`supabase/data-prerequisites.json`.

## Migration

The default is dry-run. Review the target and existing alias ownership before applying: legacy user
metadata was user-writable and cannot prove legitimate ownership. Duplicate effective aliases block
every write and list the conflicting IDs for owner resolution. Existing protected aliases take
precedence and are never overwritten. Apply re-reads users before writing, preserves other app
metadata, stops on failures, and can be rerun after partial progress. Keep administrative alias
changes paused during the audit/apply window; the Auth API provides no transactional uniqueness
guarantee across users.

Run the backfill before enabling the new login code in each environment: runtime code has no legacy
fallback. Legacy keys remain inert; only this migration reads them. Rollout, real migration runs,
and independent auth review remain owner/coordinator gates.

Alias lookup uses pages of 100 because the Auth list API does not offer an app-metadata index. Each
instance shares one directory request for 30 seconds (including misses); successful matches are
revalidated by ID before use. Local admin writes invalidate that instance's directory. Changes in
another instance can take up to 30 seconds to become discoverable. Duplicate cached matches fail
closed.

Login limits reuse the existing provider: 8/minute per identifier+IP, 30/10 minutes per IP, and
10/15 minutes per identifier and resolved account email. The latter combines alias and email
attempts. The provider's long windows are per instance, since Workers rate-limit bindings support
only 10/60-second periods; this change does not establish a global distributed budget. Shared
networks consume the same IP budget and receive the same generic rejection.
