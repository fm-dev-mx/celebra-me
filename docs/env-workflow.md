# Environment Workflow

**Owns:** variable categories, source policy, and precedence for Celebra-me environments.

**Does not own:** database ops procedures (`docs/database-workflow.md`) or schema overview. See the
Ownership Matrix in [`.agent/index.md`](../.agent/index.md).

This is the canonical human-facing environment guide for Celebra-me. Keep real values out of docs,
issues, logs, and chat.

## Contract Roles

- `.env.example` is the secret-free inventory and local template. It tracks supported variable names
  with non-sensitive placeholders, including selected operational script inputs.
- `src/env.d.ts` is the app/runtime type surface. It declares variables used by code under `src/`
  and intentionally omits variables used only by operational scripts.
- This guide owns variable categories, source policy, and precedence. It explains intentional
  differences between the template inventory and app/runtime typing.

## Source Hierarchy

- `.env.example`: tracked, secret-free inventory and local template.
- `.env`: ignored local values only.
- `.env.local`: ignored local overrides only; never point it at production.
- `.env.*.local`: ignored, machine-specific or one-off local files.
- `.secrets/` and `.tmp/secrets/`: ignored secret paths for operational values.
- Shell/Vercel environment: production and deployment values.

Production must never be inferred from `.env` or `.env.local`. Production-only values belong in the
shell, Vercel, or gitignored secret paths documented by the owning workflow.

## Variable Categories

- **Public client-safe (`PUBLIC_*`):** Anything prefixed `PUBLIC_` can reach the browser. Never
  expose `SUPABASE_SERVICE_ROLE_KEY` or other server-only secrets with a `PUBLIC_` prefix.
- **Server-only app/runtime:** Read at runtime from `process.env`, normally through
  `src/lib/server/env.ts`. Includes credentials, API keys, deployment metadata, and internal URLs.
- **Preview-only app/runtime:** `PREVIEW_MFA_BYPASS` and `PREVIEW_ADMIN_EMAILS` support the guarded
  Preview MFA bypass. Never enable them in Production.
- **Preview-only operational:** `PREVIEW_DB_URL`, `PREVIEW_SUPABASE_URL`, and
  `PREVIEW_SUPABASE_SERVICE_ROLE_KEY` are used by Preview DB workflows and never by Production.
- **Operational script-only:** Command confirmations (e.g. `CONFIRM_REMOTE_SERVICE_ROLE`), DB
  workflow inputs, one-off script filters, and Cloudinary provisioning credentials. These can use
  script-owned local file loaders and are intentionally omitted from `ImportMetaEnv`.
  `pnpm invitation:update` treats Preview and Production URLs/credentials as script-only values;
  packages and invitation definitions must contain semantic asset references, never those values.
- **Platform-provided app/runtime:** Vercel supplies `VERCEL`, `VERCEL_ENV`, and
  `VERCEL_GIT_COMMIT_REF`. They are typed for app/runtime use but omitted from the local template.
- **Production-only shell variables:** `PROD_DB_URL` is a Postgres connection string only. It must
  never be accepted where a Supabase REST/API URL is required.
- **Test-only:** `PLAYWRIGHT_*`, audit run IDs, test fixture variables.
- **Stale/manual-only:** `DATABASE_URL` and `RSVP_TOKEN_SECRET` are not active runtime inputs. Keep
  them out of templates unless a future workflow reintroduces them intentionally.

### Contract Category Inventories

The deterministic env contract test uses these explicit lists to reconcile the secret-free template
with app/runtime typing:

| Contract category           | Variables                                                                                                                                                                                                                                                                                                                                                                                                                        | Relationship                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `operational-script-only`   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `LOCAL_SUPER_ADMIN_PASSWORD`, `RSVP_ADMIN_PASSWORD`, `RSVP_ADMIN_USER`, `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_HOST_LOGIN`, `PLAYWRIGHT_HOST_PASSWORD`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `PLAYWRIGHT_PREVIEW_INVITATION_ID`, `PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION`, `PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING`, `PLAYWRIGHT_PREVIEW_DEBUG_ARTIFACTS` | Present in `.env.example`; omitted from typing.       |
| `platform-provided-runtime` | `VERCEL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF`                                                                                                                                                                                                                                                                                                                                                                                  | Present in app/runtime typing; omitted from template. |

The Cloudinary variables are server-only operational inputs for trusted provisioning scripts. Never
create `PUBLIC_CLOUDINARY_*` equivalents or place real Cloudinary values in tracked files.

## Rules

- Use local Supabase defaults for local development: `SUPABASE_URL=http://127.0.0.1:54321` and
  `PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be used by public health checks.
- Service-role scripts must fail closed for remote Supabase unless they have a command-specific
  confirmation.
- `pnpm invitation:update` requires `--non-interactive` in non-TTY automation and refuses divergent
  overwrite without both `--allow-divergent-overwrite` and an exact
  `--confirm-overwrite <target>:<slug>:<package-hash>` token.
- `PUBLIC_*` variables must be browser-safe.
- `PROD_DB_URL` is only for Postgres workflows such as backups, refreshes, and reviewed migrations.
- Logs may show variable names, source filenames, presence/absence, and local/remote classification.
  They must not show full URLs, keys, passwords, raw tokens, or DB connection strings.
- Examples should use local placeholders unless explicitly marked shell-only.

## Current Precedence

- Astro/Vite bootstrap loads supported local env files through Vite `loadEnv` in `astro.config.mjs`
  before app runtime modules access environment values. The bootstrap propagates those loaded values
  into `process.env`.
- `src/lib/server/env.ts#getEnv` reads `process.env` only. It never reads `.env` files directly and
  has no test-mode filesystem behavior.
- Shell/Vercel values remain authoritative in Production and CI. In explicit local development, the
  `astro.config.mjs` allowlist permits intended local values to override inherited shell values;
  other loaded values only fill missing `process.env` entries.
- DB workflow scripts centralize local app env loading in `scripts/db/db-workflow-lib.ts`, with
  `.env.local`/`.env` merged and `process.env` overriding file values.
- Cloudinary provisioning has its own operational loader: existing `process.env` values win, then
  missing values may be filled from `.env.local`, `.env`, and `.secrets/cloudinary.env` in that
  order.
- Older operational scripts still load env files locally and are guarded case-by-case. Broad
  precedence normalization is intentionally deferred to avoid changing deployment behavior.

## External Vercel Preview E2E

Preview Playwright configs (`playwright.preview*.config.ts`) load `.env.e2e.local` before resolving
configuration. The default `playwright.config.ts` used by `pnpm test:e2e:ci` / `pnpm run ci` does
not load that file, so a local Preview harness cannot redirect the canonical CI suite. Existing
shell or CI variables take precedence; the file fills only missing values in Preview configs. The
file is ignored by the existing `.env.*.local` rule and must never be copied into Vercel runtime
environment variables.

Required for authenticated Preview runs:

```text
PLAYWRIGHT_BASE_URL
PLAYWRIGHT_HOST_LOGIN
PLAYWRIGHT_HOST_PASSWORD
VERCEL_AUTOMATION_BYPASS_SECRET
PLAYWRIGHT_PREVIEW_INVITATION_ID
```

`PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING=true` authorizes the idempotent Preview fixture
command (`pnpm test:e2e:preview:provision`): create or reconcile slug `e2e-preview-publication`,
copy demo-derived content, and run publication preflight. It does **not** publish.

`PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION=true` separately authorizes fixture-only publication (baseline
publish during provisioning, and the serialized publication smoke in `pnpm test:e2e:preview`). It is
false by default. Neither flag authorizes Production operations.

Run public smoke checks with `pnpm test:e2e:preview:public` and authenticated checks with
`pnpm test:e2e:preview`. Run fixture provisioning only after explicit owner approval with
`pnpm test:e2e:preview:provision`, then copy the printed non-secret fixture UUID to
`PLAYWRIGHT_PREVIEW_INVITATION_ID` in `.env.e2e.local`. Authorize publication separately when a
baseline or smoke publish is required.

The Deployment Protection secret is sent only during a single same-origin health request that asks
Vercel to establish its bypass cookie. It is never configured as a global browser header, so
cross-origin image, font, analytics, Supabase, and Cloudinary requests cannot receive it.

Authenticated Preview projects always disable screenshots, video, traces, and persistent
`storageState`. `PLAYWRIGHT_PREVIEW_DEBUG_ARTIFACTS=true` enables only a sanitized JSON attachment
containing route outcomes, status codes, counts, and booleans; it never includes request bodies,
headers, cookies, tokens, login values, or CSRF values. Preview configs also disable Playwright's
automatic failure-time page snapshot so authenticated DOM content cannot be written to the report.

## Cleanup Notes

- `RSVP_ADMIN_USER` is still used as a local admin alias during production-to-local refresh.
- `DATABASE_URL` and `RSVP_TOKEN_SECRET` only appear in historical notes/plans and should remain
  deferred unless a concrete active owner is found.
- When adding or retiring variables, reconcile the template, app/runtime typing, and category lists
  according to their roles. Script-only variables do not belong in `src/env.d.ts`.
