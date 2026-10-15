# Environment Workflow

Use the five-operation command/evidence map in
[`docs/core/release-process.md`](core/release-process.md#canonical-operation-map); this document
only defines environment identity and variable sourcing.

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
  Preview MFA bypass on hosted Preview deployments (`CELEBRA_DEPLOY_ENV=preview`, built from
  `develop`). Never enable them in Production. Local Preview runtime
  (`CELEBRA_RUNTIME_TARGET=preview`) uses `DEV_MFA_BYPASS` instead: it activates only on the Astro
  dev server (`import.meta.env.DEV`) with `DEV_MFA_BYPASS=true`, no declared deploy identity, and
  either Local Supabase or `CELEBRA_RUNTIME_TARGET=preview` with the Preview project URL. A built
  bundle never qualifies, because edge runtimes do not report `NODE_ENV`.
- **Lane runtime target:** `CELEBRA_RUNTIME_TARGET` is `local` or `preview` for local Astro
  processes. Lane detection sets it automatically; shell override is allowed for intentional tests.
  It never forges hosted identity and is not mutation authorization. Its `preview` names the Preview
  database a local process talks to; `CELEBRA_DEPLOY_ENV=preview` names a hosted Preview deployment.
- **Canonical-status cache path:** `CELEBRA_STATUS_CACHE_PATH` optionally overrides the durable
  status cache file used by the app/runtime status server. Default is
  `.cache/canonical-status.json`.
- **Preview-only operational:** `PREVIEW_DB_URL`, `PREVIEW_SUPABASE_URL`, and
  `PREVIEW_SUPABASE_SERVICE_ROLE_KEY` are used by Preview DB workflows and never by Production. They
  live in `.env.preview.local` (no tracked template), not ordinary Local `.env.local` files.
- **Operational script-only:** Command confirmations (e.g. `CONFIRM_REMOTE_SERVICE_ROLE`), DB
  workflow inputs, and one-off script filters. These can use script-owned local file loaders and are
  intentionally omitted from `ImportMetaEnv`. `pnpm invitation:release` treats Preview and
  Production URLs/credentials as script-only values; packages and invitation definitions must
  contain semantic asset references, never those values.
- **Deploy-provided app/runtime:** `CELEBRA_DEPLOY_ENV` (`production` | `preview`) is declared by
  each hosted environment and is the only deploy identity; `src/lib/server/deploy-identity.ts` is
  its single reader (enforced by `validate:structure`). Local processes leave it unset and are
  recognized positively (Astro dev server, or a built bundle on Local Supabase); any other
  combination fails closed. `CELEBRA_BUILD_SHA` and `CELEBRA_BUILD_REF` are baked in at build time
  by `vite.define` and reported by `/api/health`. All three are typed for app/runtime use but
  omitted from the local template.
- **Production-only shell variables:** `PROD_DB_URL` is a Postgres connection string only;
  `PROD_SUPABASE_URL` and `PROD_SUPABASE_SERVICE_ROLE_KEY` are the independently verified API and
  Storage inputs for the complete critical backup. They come only from the operator shell or
  approved ignored secret files and are intentionally absent from `.env.example` and app typing. The
  local daily backup task resolves the same ignored sources under the interactive operator account;
  credentials are never copied into the scheduled-task definition.
- **Production owner apply:** No environment variable authorizes it; the owner gate is an
  interactive TTY confirmation with no approval-token, secret, or noninteractive alternative.
  `CELEBRA_AGENT_CONTEXT` marks an agent session and makes the gate refuse; only the Cursor hooks
  set it. Gate sequence: [`database-workflow.md`](database-workflow.md) (`pnpm db:migrate`).
- **Hosted migrate identity:** clean Git `HEAD` is the target release. Production contract phases
  resolve the prior deployed SHA from GitHub/Vercel evidence, require its trusted Production smoke,
  and read `supabase/deployed-app-capabilities.json` from that exact Git tree. Shell variables never
  authorize deployed-app readiness. An unavailable remote preflight is reported as `UNVERIFIED` and
  never authorizes apply; invalid evidence blocks both preflight and apply. Preview DB URL must
  match the canonical Preview project ref.
- **Test-only:** `PLAYWRIGHT_*`, audit run IDs, test fixture variables. The canonical local E2E
  server is isolated by default; `PLAYWRIGHT_REUSE_EXISTING_SERVER=true` is an explicit opt-in.
- **Retired:** `DATABASE_URL` and `RSVP_TOKEN_SECRET` are read nowhere. Keep them out of templates
  unless a workflow reintroduces them intentionally.

### Two meanings of `preview`

The word `preview` appears in two variables that answer different questions. Never treat one as a
substitute for the other.

| Variable                 | Question it answers                         | Who sets it                            | `preview` means                                                      |
| ------------------------ | ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| `CELEBRA_DEPLOY_ENV`     | Which hosted deployment is this?            | Each hosted environment (Vercel)       | A hosted Preview deployment built from `develop`                     |
| `CELEBRA_RUNTIME_TARGET` | Which database does a local process target? | Lane bootstrap or an intentional shell | A local Astro process (`dev-preview`) talking to the Preview project |

- A hosted deployment is identified only by `CELEBRA_DEPLOY_ENV`, read only by
  `src/lib/server/deploy-identity.ts`. `CELEBRA_RUNTIME_TARGET` never forges hosted identity, so a
  local process with `CELEBRA_RUNTIME_TARGET=preview` is still a local process (`isLocalProcess()`
  rules, `DEV_MFA_BYPASS`), not a Preview deployment (`PREVIEW_MFA_BYPASS`).
- `resolveRuntimeTarget()` in `scripts/shared/celebra-runtime-env.ts` folds both into one
  `RuntimeTarget` value for database selection: a declared `CELEBRA_DEPLOY_ENV` wins, then
  `CELEBRA_RUNTIME_TARGET`, then the lane default. Its `source` field records which input decided.
- Neither variable authorizes Preview or Production mutations (see the Worktree Authorization
  Invariant above).

### Contract Category Inventories

The deterministic env contract test uses these explicit lists to reconcile the secret-free template
with app/runtime typing:

| Contract category         | Variables                                                                                                                                                                                                                                                                                                                                                                                                               | Relationship                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `operational-script-only` | `LOCAL_SUPER_ADMIN_PASSWORD`, `RSVP_ADMIN_PASSWORD`, `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_APPROVED_PREVIEW_DEPLOYMENT_HOST`, `PLAYWRIGHT_PREVIEW_SUPABASE_URL`, `PLAYWRIGHT_HOST_LOGIN`, `PLAYWRIGHT_HOST_PASSWORD`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `PLAYWRIGHT_PREVIEW_INVITATION_ID`, `PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION`, `PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING`, `PLAYWRIGHT_PREVIEW_DEBUG_ARTIFACTS` | Present in `.env.example`; omitted from typing.       |
| `deploy-provided-runtime` | `CELEBRA_DEPLOY_ENV`, `CELEBRA_BUILD_SHA`, `CELEBRA_BUILD_REF`                                                                                                                                                                                                                                                                                                                                                          | Present in app/runtime typing; omitted from template. |

`SUPER_ADMIN_EMAILS` is a server-only runtime list. Its first entry is the project owner: the only
account that may confirm or clear owner review in the invitation workflow, and the local super admin
that `pnpm db:local:bootstrap-admin` creates. Set it in Vercel Preview and Production; when it is
absent, nobody can record owner review.

`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are server-only runtime
secrets for invitation image upload (Astro API + `invitation:release` CLI). The platform usage
console may use the optional restricted `CLOUDINARY_USAGE_API_KEY` / `CLOUDINARY_USAGE_API_SECRET`
pair instead and falls back to the upload keys. Never create `PUBLIC_CLOUDINARY_*` equivalents or
place real Cloudinary values in tracked files. Missing values fail closed: invitation image uploads
do not fall back to Supabase Storage.

`PREVIEW_MEDIA_SECRET` is an optional server-only secret that seals the watermarked photo URLs of
unpaid invitation previews (`/vista-previa/<token>`). When it is absent, the keys are derived from
`SUPABASE_SERVICE_ROLE_KEY`, so no deployment needs it; setting or rotating it only changes preview
URLs. Never expose it with a `PUBLIC_` prefix.

Event memories have no browser-facing environment variable. The browser calls same-origin APIs; the
backend uses server-only Worker origins and repository-owned route paths. Missing or invalid values
fail closed.

### Event memories environment cheatsheet

This table is the sole human-facing authority for where each value belongs. Local private values go
in ignored files; tracked examples contain empty values only. Preview/Staging and Production use
independent key pairs and credentials. Per-event configuration (public slug, window, retention,
quotas) is not environment configuration: it lives in the `event_memory_settings` table and is
managed from the super-admin dashboard.

| Name                                             | Local                              | Preview / Staging                                                                   | Production                                           | Value source                                                                               |
| ------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY`    | `.env.local` secret                | Vercel Preview secret                                                               | Vercel Production secret, independent                | Locally generated PKCS#8 P-256 upload pair                                                 |
| `MEMORIES_RETRIEVAL_REQUEST_SIGNING_PRIVATE_KEY` | `.env.local` secret                | Vercel Preview secret                                                               | Vercel Production secret, independent                | Locally generated PKCS#8 P-256 retrieval pair                                              |
| `MEMORIES_PRIVATE_UPLOAD_ORIGIN`                 | Local Wrangler origin              | Vercel Preview config                                                               | Vercel Production config                             | Deployed Sign Worker origin; path stays in code                                            |
| `MEMORIES_PRIVATE_RETRIEVAL_ORIGIN`              | Local Wrangler origin              | Vercel Preview config                                                               | Vercel Production config                             | Deployed Retrieval Worker origin; path stays in code                                       |
| `MEMORIES_SHARE_SECRET`                          | `.env.local` secret (optional)     | Vercel Preview secret                                                               | Vercel Production secret, independent                | Cryptographically secure random generator (≥ 32 bytes); signs shared-gallery links         |
| `CRON_SECRET`                                    | Synthetic `.env.local` secret      | Vercel Preview secret                                                               | Vercel Production secret, independent                | Cryptographically secure random generator                                                  |
| `MEMORIES_CLOUDFLARE_ACCOUNT_ID`                 | Optional; usually empty            | Vercel Preview config (optional)                                                    | Vercel Production config                             | Cloudflare account id; read only by the admin usage console                                |
| `MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN`            | Optional; usually empty            | Vercel Preview secret (optional)                                                    | Vercel Production secret, independent                | Account API token (Manage account → Account API tokens) limited to Account Analytics: Read |
| `MEMORIES_R2_BUCKET_NAME`                        | `celebra-memories-local`           | `celebra-memories-staging`                                                          | `celebra-memories`                                   | Bucket whose R2 usage the console reports                                                  |
| `SUPABASE_MANAGEMENT_TOKEN`                      | Optional; usually empty            | Vercel Preview secret (optional)                                                    | Vercel Production secret, independent                | Read-only Management PAT (`analytics_usage_read`, `infra_disk_config_read`)                |
| `SUPABASE_PROJECT_REF_PREVIEW`                   | Preview project ref                | Vercel Preview config                                                               | Vercel Production config                             | Non-secret Supabase project ref shown on the platform console                              |
| `SUPABASE_PROJECT_REF_PRODUCTION`                | Production project ref             | Vercel Preview config                                                               | Vercel Production config                             | Non-secret Supabase project ref shown on the platform console                              |
| `VERCEL_API_TOKEN`                               | Optional; usually empty            | Vercel Preview secret (optional)                                                    | Vercel Production secret, independent                | Read-only billing token for the platform usage console                                     |
| `VERCEL_TEAM_ID`                                 | Team id                            | Vercel Preview config                                                               | Vercel Production config                             | Non-secret team id for the billing usage query                                             |
| `CLOUDINARY_USAGE_API_KEY`                       | Optional; falls back to upload key | Vercel Preview secret (optional)                                                    | Vercel Production secret (optional)                  | Restricted read-only key for the Cloudinary usage report                                   |
| `CLOUDINARY_USAGE_API_SECRET`                    | Optional; falls back to upload key | Vercel Preview secret (optional)                                                    | Vercel Production secret (optional)                  | Secret of the restricted usage key                                                         |
| `MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PREVIEW`    | Optional; Local-only override      | Not consulted                                                                       | Not consulted                                        | Per-environment token status for the local platform console                                |
| `MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PRODUCTION` | Optional; Local-only override      | Not consulted                                                                       | Not consulted                                        | Per-environment token status for the local platform console                                |
| `MEMORIES_R2_BUCKET_NAME_PREVIEW`                | Optional; Local-only override      | Not consulted                                                                       | Not consulted                                        | Preview bucket for the local platform console                                              |
| `MEMORIES_R2_BUCKET_NAME_PRODUCTION`             | Optional; Local-only override      | Not consulted                                                                       | Not consulted                                        | Production bucket for the local platform console                                           |
| `SUPABASE_MANAGEMENT_TOKEN_PREVIEW`              | Optional; Local-only override      | Not consulted                                                                       | Not consulted                                        | Per-environment token status for the local platform console                                |
| `SUPABASE_MANAGEMENT_TOKEN_PRODUCTION`           | Optional; Local-only override      | Not consulted                                                                       | Not consulted                                        | Per-environment token status for the local platform console                                |
| `MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY`      | Sign Worker `.dev.vars`            | Sign Worker Staging secret                                                          | Sign Worker Production secret                        | SPKI public key from the upload pair                                                       |
| `MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY`   | Retrieval Worker `.dev.vars`       | Retrieval Worker Staging secret                                                     | Retrieval Worker Production secret                   | SPKI public key from the retrieval pair                                                    |
| `MEMORIES_UPLOAD_CAPABILITY_SECRET`              | Sign Worker `.dev.vars`            | Sign Worker Staging secret                                                          | Independent Sign Worker Production secret            | Secret that seals one-use upload capabilities (AES-GCM)                                    |
| `MEMORIES_STORAGE_TARGET`                        | Wrangler versioned var: `local`    | Wrangler versioned var: `staging`                                                   | Wrangler versioned var: `production`                 | Repository Worker configuration                                                            |
| `MEMORIES_ALLOWED_ORIGINS`                       | Wrangler versioned var             | Wrangler versioned var; branch previews via `--var` at deploy time, never committed | Wrangler versioned var: `https://www.celebra-me.com` | Repository Worker configuration (comma-separated origins)                                  |
| `MEMORIES_BUCKET`                                | Simulated local R2 binding         | Binding to the Staging bucket                                                       | Binding to the Production bucket                     | Wrangler R2 binding; never a variable or secret                                            |
| Supabase URL / anon / service role               | Values reported by local Supabase  | Vercel Preview values from the Preview project                                      | Vercel Production values from the Production project | Matching Supabase project API settings                                                     |

Do not create `PUBLIC_MEMORIES_*`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, or event
memories values in Cloudflare Secrets Store. The platform usage console reads its own
`MEMORIES_CLOUDFLARE_*` names so Wrangler never mistakes the read-only analytics token for deploy
credentials; without them the console reports "sin configurar" and keeps working. The same console
reads `SUPABASE_MANAGEMENT_TOKEN`, `VERCEL_API_TOKEN` and the optional `CLOUDINARY_USAGE_*` pair,
each read-only and least-privilege. The console is scoped per environment: the Preview deployment
shows only Preview, the Production deployment only Production, and Local shows both (the panel
labels shared account/project quotas explicitly). To diagnose each environment's configuration from
Local, load the optional `*_PREVIEW` / `*_PRODUCTION` overrides above in `.env.local`; Local only
reflects what is loaded there. Interactive deployment authentication is owned by `wrangler login`;
Worker runtime secrets are applied to the exact environment with
`wrangler secret put --env <environment>`. Never place API tokens, capability secrets, object keys,
signed URLs, or reusable secret values in tracked templates, documentation, logs, or evidence.

## Rules

- Use local Supabase defaults for local development: `SUPABASE_URL=http://127.0.0.1:54321` and
  `PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be used by public health checks.
- Service-role scripts must fail closed for remote Supabase unless they have a command-specific
  confirmation.
- `pnpm invitation:release` runs without prompts under `--non-interactive` (or without a TTY). A
  non-interactive apply whose plan deletes or overwrites rows or Storage objects also requires
  `--confirm-destructive`, and a non-interactive Preview write requires
  `CELEBRA_TASK_SCOPE=preview:<slug>:<operation>`.
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

## Tooling and CI variables read by code

Names that code reads but that the sections above do not cover. This is a name inventory only:
values, defaults, and hosts stay in the owning file, `.env.example`, or the operator shell. All are
optional unless marked **required**. Paths are relative to the repository root.

### App/runtime names typed in `src/env.d.ts`

These are present in `.env.example` and the lane bootstrap allowlist
(`scripts/shared/celebra-runtime-env.ts`); they follow the server-only or `PUBLIC_*` rules above.

| Area           | Names                                                                                        | Read by                                                      |
| -------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Supabase keys  | `SUPABASE_ANON_KEY`, `PUBLIC_SUPABASE_ANON_KEY`                                              | `src/lib/server/supabase-credentials.ts`, dashboard MFA page |
| Base URL       | `BASE_URL`                                                                                   | `astro.config.mjs`, `src/lib/rsvp/security/auth-security.ts` |
| Contact        | `CONTACT_FORM_RECIPIENT_EMAIL`, `CONTACT_WHATSAPP`, `GMAIL_USER`, `GMAIL_PASS`               | `src/lib/server/email.ts`, `src/utils/whatsapp.ts`           |
| Admin security | `REQUIRE_FRESH_MFA_FOR_ADMIN`, `TRUST_DEVICE_SECRET`, `TRUST_DEVICE_MAX_AGE_DAYS`            | `src/lib/rsvp/auth/`, `src/lib/rsvp/security/`               |
| Meta CAPI      | `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_CAPI_DELIVERY_MODE`, `META_TEST_EVENT_CODE` | `src/lib/commercial/meta-capi/service.ts`                    |
| Browser tags   | `PUBLIC_GA_MEASUREMENT_ID`, `PUBLIC_META_PIXEL_ENABLED`, `PUBLIC_META_PIXEL_ID`              | `src/lib/tracking/`                                          |

### Build and local server

| Name                          | Read by                                   | Notes                                                 |
| ----------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| `ASTRO_PORT`                  | `astro.config.mjs`, `scripts/screenshot/` | Port override; lanes set their own port               |
| `PROD_SUPABASE_HOST`          | `astro.config.mjs`                        | Image `remotePatterns` host override                  |
| `CELEBRA_ENV_BOOTSTRAP_LOG`   | `astro.config.mjs`                        | `1` logs lane bootstrap decisions (names only)        |
| `ENABLE_TEST_VARIANT_HARNESS` | `astro.config.mjs`                        | `1` enables the visual variant harness in `astro dev` |

### Local DB tooling and disposable test environment

| Name                                                                                            | Read by                               | Notes                                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| `LOCAL_DB_URL`                                                                                  | `scripts/db/db-target-config.ts`      | Overrides the persistent Local DB URL          |
| `DISPOSABLE_API_PORT`, `DISPOSABLE_DB_PORT`, `DISPOSABLE_STUDIO_PORT`, `DISPOSABLE_SHADOW_PORT` | `scripts/db/db-target-config.ts`      | Ports of the `disposable-test` stack           |
| `LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD`                                                     | `scripts/db/_check-admin-login.mjs`   | Set by the local admin bootstrap and validator |
| `EXPECTED_MIGRATIONS`                                                                           | `scripts/db/migrate-expected.ts`      | Rejected when set; use `--expected`            |
| `CELEBRA_MANAGED_STATUS_DEBUG`                                                                  | `scripts/provision/managed-status.ts` | Debug output for managed status                |
| `CELEBRA_SKIP_MANAGED_STATUS`                                                                   | `scripts/agent/lane-sync.ts`          | `1` skips the remote status probe              |

### Release, backup, and invitation operations

| Name                                                                                                    | Read by                                            | Notes                                             |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `CELEBRA_TARGET_RELEASE_SHA`                                                                            | `scripts/db/migration-deployment-compatibility.ts` | Target release for contract checks                |
| `CELEBRA_CRITICAL_BACKUP_PURPOSE`, `CELEBRA_CRITICAL_BACKUP_PLAN_ID`, `CELEBRA_CRITICAL_BACKUP_PENDING` | `scripts/db/backup-critical-production.ts`         | Set by `scripts/db/critical-production-backup.ts` |
| `CELEBRA_OPERATOR_TASK`                                                                                 | `scripts/provision/preview-write-auth.ts`          | Set by the VS Code `invitation:release` task      |
| `CELEBRA_PURGE_RESUME_STORAGE_PATHS`                                                                    | `scripts/provision/invitation-id-purge.ts`         | Only with `--resume-storage-cleanup`              |
| `CELEBRA_GIT_SAFETY_ROOT`, `CELEBRA_GIT_SAFETY_SESSION`                                                 | `scripts/agent/git-safety.mjs`                     | Defaults for `--root` / `--session`               |
| `CELEBRA_CLI_ASCII`                                                                                     | `scripts/lib/cli-theme.ts`                         | `1` forces ASCII glyphs                           |

### Post-deploy smoke (Vercel `repository_dispatch`)

Set by `.github/workflows/post-deploy-smoke.yml` from the dispatch payload and read by
`scripts/ops/post-deploy-smoke.ts`; **required** inside that workflow, never configured by hand:

- `VERCEL_DISPATCH_EVENT`, `VERCEL_DISPATCH_URL`, `VERCEL_DISPATCH_ENVIRONMENT`,
  `VERCEL_DISPATCH_GIT_REF`, `VERCEL_DISPATCH_COMMIT_SHA`, `VERCEL_DISPATCH_DEPLOYMENT_ID`,
  `VERCEL_DISPATCH_PROJECT_ID`, `VERCEL_DISPATCH_EXPECTED_PROJECT_ID` (dispatch inputs).
- `POST_DEPLOY_BASE_URL`, `POST_DEPLOY_APPROVED_HOST`, `POST_DEPLOY_ENVIRONMENT`,
  `POST_DEPLOY_COMMIT_SHA`, `POST_DEPLOY_DEPLOYMENT_ID`, `POST_DEPLOY_RUN_ID`,
  `POST_DEPLOY_STARTED_AT` (validated outputs exported through `GITHUB_ENV`).
- `VERCEL_PROJECT_ID` is a repository variable (`vars.*`) consumed by the same workflow.

### CI validation (`.github/workflows/commit-validation.yml`)

| Name                                               | Read by                                                               | Notes                             |
| -------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------- |
| `VALIDATION_BASE_SHA`, `VALIDATION_HEAD_SHA`       | `scripts/shared-changed-files.mjs`, `scripts/ops/classify-release.ts` | Range set by the workflow         |
| `PR_HEAD_SHA`, `PR_HEAD_REF`, `PR_HEAD_REPOSITORY` | `scripts/ops/ci-evidence-reuse.ts`                                    | Pull request head identity        |
| `GH_TOKEN`                                         | `scripts/ops/ci-browser-scope.ts`, `scripts/ops/ci-evidence-reuse.ts` | Workflow token for the GitHub API |
| `BROWSER_STEP_OUTCOME`                             | `scripts/ops/browser-outcome.ts`                                      | Outcome of the browser step       |

### Playwright and visual parity

| Name                                                       | Read by                                       | Notes                                    |
| ---------------------------------------------------------- | --------------------------------------------- | ---------------------------------------- |
| `PLAYWRIGHT_USE_CANONICAL_FIXTURES`                        | `playwright.config.ts`, `astro.config.mjs`    | Serves synthetic canonical fixtures      |
| `PLAYWRIGHT_WEB_SERVER_COMMAND`                            | `playwright.config.ts`                        | Overrides the canonical web server       |
| `PLAYWRIGHT_WEB_SERVER_URL`                                | `scripts/playwright/preview-environment.ts`   | Local server URL for Preview configs     |
| `PLAYWRIGHT_PREVIEW_EXECUTION_MODE`                        | `playwright.preview*.config.ts`               | Set by each Preview config; not an input |
| `PLAYWRIGHT_REQUIRE_VISUAL_PREFLIGHT`                      | `scripts/screenshot/visual-parity-cli.ts`     | `true` in CI and visual certification    |
| `VISUAL_PARITY_MODE`                                       | `playwright.config.ts`, `scripts/screenshot/` | Compare or diagnostic mode               |
| `VISUAL_PARITY_OUTPUT_ROOT`, `VISUAL_PARITY_SNAPSHOT_ROOT` | `scripts/screenshot/visual-parity-cli.ts`     | Output and baseline roots                |

### Event memories Worker bindings

`NONCE_GUARD` (Durable Object) and `SIGN_RATE_LIMITER` (rate limit) are Wrangler bindings in
`workers/celebra-memories-sign/` and `workers/celebra-memories-retrieve/`, like `MEMORIES_BUCKET`:
declared in each `wrangler.json`, never variables or secrets.

### Platform-provided (no configuration)

Read as provided by the platform or terminal; never set them in env files: `CI`, `NODE_ENV`, `DEV`
(`import.meta.env`), `GITHUB_SHA`, `GITHUB_REF_NAME`, `GITHUB_REPOSITORY`, `GITHUB_RUN_ID`,
`GITHUB_EVENT_NAME`, `GITHUB_OUTPUT`, `GITHUB_ENV`, `GITHUB_STEP_SUMMARY`, `GITHUB_API_URL`,
`VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_GIT_PREVIOUS_SHA` (build
fallbacks and `scripts/ops/vercel-ignore-build.mjs` only), `PGOPTIONS`, `PGCONNECT_TIMEOUT` (libpq,
set by scripts), `USER`, `USERNAME`, `TERM`, `TERM_PROGRAM`, `TERMINAL_EMULATOR`, `WT_SESSION`,
`MSYSTEM`, `NO_COLOR`, `FORCE_COLOR` (terminal detection in `scripts/lib/cli-theme.ts`).

## Cleanup Notes

- When adding or retiring variables, reconcile the template, app/runtime typing, and category lists
  according to their roles. Script-only variables do not belong in `src/env.d.ts`.
