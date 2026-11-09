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
targets are rejected before any API call in apply mode. Production remains dry-run only here: its
Auth backfill must first be integrated with the exclusive `pnpm prod:apply` owner workflow,
including release evidence, backup coverage, and the owner gate. Do not activate alias-only login in
Production until that integration and backfill are complete.

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
