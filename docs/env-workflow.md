# Environment Workflow

**Owns:** variable categories, source policy, and precedence for Celebra-me environments.

**Does not own:** database ops procedures (`docs/database-workflow.md`) or schema overview. See the
Ownership Matrix in [`.agent/ownership.yaml`](../.agent/ownership.yaml).

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
- `.env.preview.local` / `.env.production.local`: the **single canonical secret file** per hosted
  target for operational DB workflows (environment variables take precedence). Do not keep parallel
  copies under `.secrets/` or `.tmp/secrets/`.
- `.secrets/`: reserved for non-DB script-owned fallbacks only (e.g. `.secrets/cloudinary.env`).
- Shell/Vercel environment: production and deployment values.

Production must never be inferred from `.env` or `.env.local`. Production-only values belong in the
shell, Vercel, or gitignored secret paths documented by the owning workflow.

## Validation Role of Preview vs Local Default

- **Local Default (Integration, `dev-local`, `dev-extra`)**: Local development
  (`SUPABASE_URL=http://127.0.0.1:54321`) is the default application runtime for Integration and the
  Local development lanes. Use it for normal development, unit testing, component/SCSS iteration,
  and disposable destructive migration reconstruction.
- **Preview Runtime Default (`dev-preview`)**: `dev-preview` (canonical external worktree)
  intentionally runs local Astro against the dedicated Preview Supabase project. Application runtime
  values come from `.env.preview.local` (overlay) and set `CELEBRA_RUNTIME_TARGET=preview`. This is
  **runtime connectivity only** — it does not authorize Preview DB migrations, syncs, invitation
  updates, or E2E provision/publish.
- **Preview Validation / Ops Role**: Preview (`PREVIEW_DB_URL`, Vercel Preview deployments, Preview
  E2E) remains the hosted validation environment for workflows requiring broader verification,
  including:
  - Hosted SSR and Vercel edge/runtime behavior,
  - Supabase Auth and MFA flows,
  - Invitation publication and provisioning preflights,
  - Storage asset host resolution,
  - Hosted database migration sanity audits (`pnpm db:preview:audit`),
  - Representative Preview E2E test suites (`pnpm test:e2e:preview`).
- **Worktree Authorization Invariant**: Worktree path location grants no environment privilege
  (`path ≠ privilege`). Being inside a development worktree does not grant automatic Preview or
  Production mutation permission. Runtime target (`CELEBRA_RUNTIME_TARGET`), UI environment banners,
  and credential presence also do not authorize mutations. Environment access is determined strictly
  by task scope, target environment, operation risk, and existing repository safety rules. Content
  promote/mirror vs RSVP isolation:
  [`docs/core/content-parity-rsvp-isolation.md`](core/content-parity-rsvp-isolation.md).

## Credential Preflight and Fail-Fast Taxonomy

Operations that depend on external credentials or secrets (Supabase Auth/DB, Vercel Preview
deployments, Cloudinary asset provisioning) must perform a credential preflight check before
execution:

1. **Taxonomy of Operational Failures**:
   - **Missing Access / Credential** → `Environmental Blocker`: When a required environment variable
     or secret file is absent, operations stop immediately. Report status `Needs manual action`
     naming the missing input. No retry loops, no speculative `.env` edits, and no fallback to
     Production endpoints.
   - **Credential Present but Rejected** → `Authentication Diagnosis`: Perform one bounded
     diagnostic pass (verify project ref, hostname, or credential format). Stop if unresolved; do
     not guess credentials or bypass security guards.
   - **Valid Access + Operation Failure** → `Application Diagnosis`: Proceed with normal technical
     diagnosis of the application error.

2. **Preflight Principles**:
   - **Credential Availability ≠ Operation Authorization**: Having valid API keys or DB connection
     strings in your environment does not grant permission to run remote mutations unless the
     current task explicitly authorizes that operation.
   - **Zero Speculative Edits**: Never modify `.env` or `.env.local` files speculatively to bypass
     missing access or failed authentication checks.

## Variable Categories

- **Public client-safe (`PUBLIC_*`):** Anything prefixed `PUBLIC_` can reach the browser. Never
  expose `SUPABASE_SERVICE_ROLE_KEY` or other server-only secrets with a `PUBLIC_` prefix.
- **Server-only app/runtime:** Read at runtime from `process.env`, normally through
  `src/lib/server/env.ts`. Includes credentials, API keys, deployment metadata, and internal URLs.
- **Preview-only app/runtime:** `PREVIEW_MFA_BYPASS` and `PREVIEW_ADMIN_EMAILS` support the guarded
  Preview MFA bypass on Vercel Preview deployments. Never enable them in Production. Local Preview
  runtime (`CELEBRA_RUNTIME_TARGET=preview`) uses `DEV_MFA_BYPASS` instead—it now activates when
  `DEV_MFA_BYPASS=true` + `NODE_ENV=development` + `CELEBRA_RUNTIME_TARGET=preview` + remote
  Supabase URL, provided the process is not on Vercel.
- **Lane runtime target:** `CELEBRA_RUNTIME_TARGET` is `local` or `preview` for local Astro
  processes. Lane detection sets it automatically; shell override is allowed for intentional tests.
  It never forges Vercel identity and is not mutation authorization.
- **Canonical-status cache path:** `CELEBRA_STATUS_CACHE_PATH` optionally overrides the durable
  status cache file used by the app/runtime status server. Default is
  `.cache/canonical-status.json`.
- **Preview-only operational:** `PREVIEW_DB_URL`, `PREVIEW_SUPABASE_URL`, and
  `PREVIEW_SUPABASE_SERVICE_ROLE_KEY` are used by Preview DB workflows and never by Production. They
  live in `.env.preview.local` (see `.env.preview.local.example`), not ordinary Local `.env.local`
  files.
- **Operational script-only:** Command confirmations (e.g. `CONFIRM_REMOTE_SERVICE_ROLE`), DB
  workflow inputs, and one-off script filters. These can use script-owned local file loaders and are
  intentionally omitted from `ImportMetaEnv`. `pnpm invitation:release` treats Preview and
  Production URLs/credentials as script-only values; packages and invitation definitions must
  contain semantic asset references, never those values.
- **Platform-provided app/runtime:** Vercel supplies `VERCEL`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_ENV`,
  `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, and `VERCEL_REGION`. They are typed for
  app/runtime use but omitted from the local template.
- **Production-only shell variables:** `PROD_DB_URL` is a Postgres connection string only;
  `PROD_SUPABASE_URL` and `PROD_SUPABASE_SERVICE_ROLE_KEY` are the independently verified API and
  Storage inputs for the complete critical backup. They come only from the operator shell or
  approved ignored secret files and are intentionally absent from `.env.example` and app typing. The
  local daily backup task resolves the same ignored sources under the interactive operator account;
  credentials are never copied into the scheduled-task definition.
- **Production owner apply:** Requires interactive TTY confirmation via
  `requireOwnerProductionApply` (arrow menu defaulting to Cancel, optional technical review, then
  short bound code `<VERB> <8-hex>`). Default summary hides URLs, full hashes, executors, and
  internal policy names. There is no approval-token, secret, or noninteractive confirmation env
  alternative. `CELEBRA_AGENT_CONTEXT` rejects agent self-authorization and is injected by default
  in agent sessions (Cursor hooks). It is not a substitute for owner TTY confirmation. Apply also
  requires valid `pnpm release-check` evidence for the current clean `HEAD`.
- **Preview hosted migrate identity:** clean Git `HEAD` (same release pattern as Production). For
  contract phases, `CELEBRA_DEPLOYED_APP_SHA` / `CELEBRA_DEPLOYED_APP_CAPABILITIES` authorize
  deployed-app readiness. Preview DB URL must match the canonical Preview project ref.
- **Test-only:** `PLAYWRIGHT_*`, audit run IDs, test fixture variables. The canonical local E2E
  server is isolated by default; `PLAYWRIGHT_REUSE_EXISTING_SERVER=true` is an explicit opt-in.
- **Stale/manual-only:** `DATABASE_URL` and `RSVP_TOKEN_SECRET` are not active runtime inputs. Keep
  them out of templates unless a future workflow reintroduces them intentionally.

### Contract Category Inventories

The deterministic env contract test uses these explicit lists to reconcile the secret-free template
with app/runtime typing:

| Contract category           | Variables                                                                                                                                                                                                                                                                                                                                                                                                                                  | Relationship                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `operational-script-only`   | `LOCAL_SUPER_ADMIN_PASSWORD`, `RSVP_ADMIN_PASSWORD`, `RSVP_ADMIN_USER`, `SUPER_ADMIN_EMAILS`, `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_APPROVED_PREVIEW_DEPLOYMENT_HOST`, `PLAYWRIGHT_PREVIEW_SUPABASE_URL`, `PLAYWRIGHT_HOST_LOGIN`, `PLAYWRIGHT_HOST_PASSWORD`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `PLAYWRIGHT_PREVIEW_INVITATION_ID`, `PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION`, `PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING`, `PLAYWRIGHT_PREVIEW_DEBUG_ARTIFACTS` | Present in `.env.example`; omitted from typing.       |
| `platform-provided-runtime` | `VERCEL`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_REGION`                                                                                                                                                                                                                                                                                                                          | Present in app/runtime typing; omitted from template. |

`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are server-only runtime
secrets for invitation image upload (Astro API + `invitation:release` CLI). Never create
`PUBLIC_CLOUDINARY_*` equivalents or place real Cloudinary values in tracked files. Missing values
fail closed: invitation image uploads do not fall back to Supabase Storage.

Valentina Memories has no browser-facing environment variable. The browser calls same-origin APIs;
the backend uses server-only Worker origins and repository-owned route paths. Missing or invalid
values fail closed.

### Valentina Memories environment cheatsheet

This table is the sole human-facing authority for where each value belongs. Local private values go
in ignored files; tracked examples contain empty values only. Preview/Staging and Production use
independent key pairs and credentials.

| Name                                             | Local                              | Preview / Staging                              | Production                                           | Value source                                         |
| ------------------------------------------------ | ---------------------------------- | ---------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY`    | `.env.local` secret                | Vercel Preview secret                          | Vercel Production secret, independent                | Locally generated PKCS#8 P-256 upload pair           |
| `MEMORIES_RETRIEVAL_REQUEST_SIGNING_PRIVATE_KEY` | `.env.local` secret                | Vercel Preview secret                          | Vercel Production secret, independent                | Locally generated PKCS#8 P-256 retrieval pair        |
| `MEMORIES_PRIVATE_UPLOAD_ORIGIN`                 | Local Wrangler origin              | Vercel Preview config                          | Vercel Production config                             | Deployed Sign Worker origin; path stays in code      |
| `MEMORIES_PRIVATE_RETRIEVAL_ORIGIN`              | Local Wrangler origin              | Vercel Preview config                          | Vercel Production config                             | Deployed Retrieval Worker origin; path stays in code |
| `CRON_SECRET`                                    | Synthetic `.env.local` secret      | Vercel Preview secret                          | Vercel Production secret, independent                | Cryptographically secure random generator            |
| `MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY`      | Sign Worker `.dev.vars`            | Sign Worker Staging secret                     | Sign Worker Production secret                        | SPKI public key from the upload pair                 |
| `MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY`   | Retrieval Worker `.dev.vars`       | Retrieval Worker Staging secret                | Retrieval Worker Production secret                   | SPKI public key from the retrieval pair              |
| `MEMORIES_UPLOAD_CAPABILITY_SECRET`              | Sign Worker `.dev.vars`            | Sign Worker Staging secret                     | Independent Sign Worker Production secret            | HMAC secret for one-use upload capabilities          |
| `MEMORIES_STORAGE_TARGET`                        | Wrangler versioned var: `local`    | Wrangler versioned var: `staging`              | Wrangler versioned var: `production`                 | Repository Worker configuration                      |
| `MEMORIES_BUCKET`                                | Simulated local R2 binding         | Binding to the Staging bucket                  | Binding to the Production bucket                     | Wrangler R2 binding; never a variable or secret      |
| Supabase URL / anon / service role               | Values reported by local Supabase  | Vercel Preview values from the Preview project | Vercel Production values from the Production project | Matching Supabase project API settings               |

Do not create `PUBLIC_MEMORIES_*`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, or Valentina
Memories values in Cloudflare Secrets Store. Interactive deployment authentication is owned by
`wrangler login`; Worker runtime secrets are applied to the exact environment with
`wrangler secret put --env <environment>`. Never place API tokens, capability secrets, object keys,
signed URLs, or reusable secret values in tracked templates, documentation, logs, or evidence.

## Rules

- Use local Supabase defaults for local development: `SUPABASE_URL=http://127.0.0.1:54321` and
  `PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be used by public health checks.
- Service-role scripts must fail closed for remote Supabase unless they have a command-specific
  confirmation.
- `pnpm invitation:release` requires `--non-interactive` in non-TTY automation and refuses divergent
  overwrite without both `--allow-divergent-overwrite` and an exact
  `--confirm-overwrite <target>:<slug>:<package-hash>` token.
- `PUBLIC_*` variables must be browser-safe.
- `PROD_DB_URL` is only for Postgres workflows such as backups, refreshes, and reviewed migrations.
- `PROD_SUPABASE_URL` and `PROD_SUPABASE_SERVICE_ROLE_KEY` are accepted only by the read-only
  complete critical backup workflow. DB/API/Storage/credential project refs must agree with the
  allowlisted Production identity before any request.
- Production backup secrets remain local operational inputs. They must not be added to Vercel, CI,
  Supabase jobs, application runtime variables, or Task Scheduler arguments.
- Logs may show variable names, source filenames, presence/absence, and local/remote classification.
  They must not show full URLs, keys, passwords, raw tokens, or DB connection strings.
- Examples should use local placeholders unless explicitly marked shell-only.

## Current Precedence

- Astro/Vite bootstrap runs `scripts/shared/celebra-runtime-env.ts` from `astro.config.mjs` before
  app runtime modules access environment values.
- Lane detection (`scripts/shared/worktree-lane.ts`) selects the runtime default:
  - Integration / `dev-local` / `dev-extra` → Local
  - `dev-preview` → Preview
- File loading for local processes (`NODE_ENV=development`, non-Vercel):
  1. Vite `loadEnv` merges `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`
  2. Preview lane additionally overlays `.env.preview.local` (required) for Preview runtime keys
  3. Allowlisted keys from files override inherited shell values
  4. `CELEBRA_RUNTIME_TARGET` is set from the lane default unless already present
- `src/lib/server/env.ts#getEnv` reads `process.env` only. It never reads `.env` files directly and
  has no test-mode filesystem behavior.
- Shell/Vercel values remain authoritative on Vercel and in CI. Local lane bootstrap validates that
  `SUPABASE_URL` and `PUBLIC_SUPABASE_URL` match the intended Local or Preview project and rejects
  mixed or Production targets for ordinary development lanes.
- DB workflow scripts centralize local app env loading in `scripts/db/db-workflow-lib.ts`, with
  `.env.local`/`.env` merged and `process.env` overriding file values. Local DB workflows refuse
  remote Supabase URLs inside `.env.local`.
- Cloudinary runtime reads `process.env` only. The release CLI may fill missing values from
  `.env.local`, `.env`, and `.secrets/cloudinary.env` in that order before calling the shared server
  module.
- Older operational scripts still load env files locally and are guarded case-by-case. Broad
  precedence normalization is intentionally deferred to avoid changing deployment behavior.

### Per-worktree `.env*` expectations

| Worktree      | Primary runtime files                                                  | Preview ops file                      | Notes                   |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------- | ----------------------- |
| Integration   | `.env.local` (Local)                                                   | optional `.env.preview.local` for ops | Local default           |
| `dev-local`   | `.env.local` (Local)                                                   | usually absent                        | Local default           |
| `dev-preview` | `.env.local` (non-Supabase shared) + **required** `.env.preview.local` | same file holds `PREVIEW_*` ops keys  | Preview runtime default |
| `dev-extra`   | `.env.local` (Local)                                                   | usually absent                        | Local default           |
| Preview E2E   | `.env.e2e.local`                                                       | —                                     | Hosted Playwright only  |

## External Vercel Preview E2E

Preview Playwright configs (`playwright.preview*.config.ts`) load `.env.e2e.local` before resolving
configuration. The default `playwright.config.ts` used by `pnpm test:e2e:ci` / `pnpm run ci` does
not load that file, so a local Preview harness cannot redirect the canonical CI suite. Existing
shell or CI variables take precedence; the file fills only missing values in Preview configs. The
file is ignored by the existing `.env.*.local` rule and must never be copied into Vercel runtime
environment variables. Canonical `webServer` startup supplies Local Supabase URL stubs
(`http://127.0.0.1:54321`) when `SUPABASE_URL` / `PUBLIC_SUPABASE_URL` are unset so Astro's
fail-closed lane bootstrap can start without a checked-in `.env.local`.

Required for authenticated Preview runs:

```text
PLAYWRIGHT_BASE_URL
PLAYWRIGHT_PREVIEW_SUPABASE_URL
PLAYWRIGHT_HOST_LOGIN
PLAYWRIGHT_HOST_PASSWORD
VERCEL_AUTOMATION_BYPASS_SECRET
PLAYWRIGHT_PREVIEW_INVITATION_ID
```

`PLAYWRIGHT_BASE_URL` must use HTTPS and match either the stable Celebra-me Preview alias, the
`develop` branch alias, or an immutable Celebra-me deployment hostname repeated exactly in
`PLAYWRIGHT_APPROVED_PREVIEW_DEPLOYMENT_HOST`. The explicit immutable-host value is required because
an arbitrary `*.vercel.app` suffix does not prove Preview identity. Production domains are always
rejected. `PLAYWRIGHT_PREVIEW_SUPABASE_URL` must resolve to project ref `iwipdvisoyerfdytuhwi`; the
Production ref is always rejected before any remote request.

Public and authenticated read-only commands require the provisioning, publication, and debug guards
to be present and exactly `false`. Missing flags fail closed before Deployment Protection bypass or
application authentication.

`PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING=true` authorizes the Playwright fixture reconcile
command (`pnpm test:e2e:preview:provision`): verify slug `e2e-preview-publication`, copy
demo-derived content, and run publication preflight. It does **not** publish and does **not** create
the invitation row.

Greenfield / fixture-missing Preview bootstrap is owned by the Preview-only CLI:

```bash
# dry-run
pnpm invitation:preview-fixture --dry-run

# apply (automated scope)
CELEBRA_TASK_SCOPE=preview:e2e-preview-publication:e2e-fixture pnpm invitation:preview-fixture --apply
```

That command creates or verifies the canonical fixture owned by `preview@preview.com` using Preview
DB credentials and existing Preview write-auth guards. It never targets Production and does not
restore Dashboard/API managed creation. After apply, copy the printed UUID to
`PLAYWRIGHT_PREVIEW_INVITATION_ID`, then run `pnpm test:e2e:preview:provision`.

`PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION=true` separately authorizes fixture-only publication through
`pnpm test:e2e:preview:publish`. Provisioning requires publication to remain `false` and contains no
publication request. Publication requires provisioning to remain `false`, a configured fixture UUID,
the canonical fixture slug, the dedicated Preview account, and the verified Preview environment.
Neither flag authorizes Production operations.

Run public smoke checks with `pnpm test:e2e:preview:public` and authenticated checks with
`pnpm test:e2e:preview`. Run fixture bootstrap with `pnpm invitation:preview-fixture --apply` after
explicit Preview task scope, then reconcile content with `pnpm test:e2e:preview:provision`. Run
publication only as the separate `pnpm test:e2e:preview:publish` command after explicit
authorization.

The Deployment Protection secret is sent only during a single same-origin health request that asks
Vercel to establish its bypass cookie. It is never configured as a global browser header, so
cross-origin image, font, analytics, Supabase, and Cloudinary requests cannot receive it.

Preview projects always disable screenshots, video, traces, and persistent `storageState`, and
discard temporary test output after execution. Debug artifacts currently fail closed when enabled.
The diagnostics serializer accepts only an explicit allowlist of finite counters and booleans; it
rejects strings and unknown fields so request bodies, URLs, headers, cookies, tokens, login values,
and CSRF values cannot be attached. All Preview output paths remain below the ignored
`output/playwright/` root.

## Canonical local Playwright server lifecycle

The default `playwright.config.ts` passes `ASTRO_DEV_BACKGROUND=1` to its web server. Astro 7 uses
that marker to stay in the foreground under an agent runtime, so Playwright owns and terminates the
process on Windows instead of observing an early wrapper exit and leaving a detached listener on
port 4321. `reuseExistingServer` is false unless the operator deliberately sets
`PLAYWRIGHT_REUSE_EXISTING_SERVER=true`. Canonical CI and release validation must use the default
isolated behavior and must not depend on a previously running server.

## Cleanup Notes

- `RSVP_ADMIN_USER` is still used as a local admin alias during production-to-local refresh.
- `DATABASE_URL` and `RSVP_TOKEN_SECRET` only appear in historical notes/plans and should remain
  deferred unless a concrete active owner is found.
- When adding or retiring variables, reconcile the template, app/runtime typing, and category lists
  according to their roles. Script-only variables do not belong in `src/env.d.ts`.
