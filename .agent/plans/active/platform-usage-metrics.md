---
title: Platform limits and cost metrics in the admin dashboard
status: active
created: 2026-10-02
updated: 2026-10-02
type: implementation
related_docs:
  - docs/core/architecture.md
  - docs/env-workflow.md
  - src/lib/memories/contract/limits.ts
  - src/lib/platform/server/cloudflare-usage.ts
---

# Platform limits and cost metrics — approved plan

Operation mode: `implement`. The plan below was approved by the repository owner on 2026-10-02 after
one decision round. Nothing outside this scope is authorized.

## Objective

A super-admin page that shows infrastructure provider limit and cost metrics (Cloudflare, Vercel,
Supabase, Cloudinary), split per environment where feasible, answering three decisions only: am I
running out of quota, when, and what will I pay. Limits are shown before costs.

## Decisions (owner-approved)

1. Scope: Cloudflare + Vercel + Supabase + Cloudinary; limits and cost where the plan exposes it.
   Every other provider in `.env.example` / `docs/env-workflow.md` is listed as discarded.
2. Environments: Preview and Production shown separately when the metric is environment-owned;
   shared metrics are labeled "de la cuenta/proyecto, no de un entorno". Local is excluded (no cost
   generation; its occasional real usage already lands in account totals).
3. Location: new admin page "Plataforma"; the Cloudflare meter leaves "Espacios de recuerdos", which
   keeps only per-space figures (including committed storage by spaces).
4. Freshness: live queries with a short cache (5-15 min), no daily snapshots. Simple projection from
   the period in progress for the "when" answer. Links to official dashboards for the rest.
5. Alerts: meters with 70 % / 90 % color thresholds only. No email or WhatsApp.
6. When a limit is exceeded the system only warns. Uploads and sales are never blocked by our code
   (provider-side rejections at their own quota are plan behavior, not our gating).

## Metric inventory (verified 2026-10-02 unless marked)

Legend: (V) verified against repo code or official docs; (NV) not verified.

### Cloudflare — shared account; account-wide quotas

| Metric vs free quota                    | Source                                                                            | Credential                                                                                                  | Freshness                            | Window                                      | Show                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------- |
| R2 storage vs 10 GB-month               | GraphQL `r2StorageAdaptiveGroups` (`src/lib/memories/server/cloudflare-usage.ts`) | `MEMORIES_CLOUDFLARE_ACCOUNT_ID`, `MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN` (existing, Account Analytics: Read) | analytics lag + 5 min cache (V code) | 24 h snapshot (V code)                      | yes (approximate; real quota is 30-day avg GB-month, V R2 pricing 2026-10-01) |
| R2 Class A ops vs 1 M/month             | `r2OperationsAdaptiveGroups`                                                      | same                                                                                                        | same                                 | UTC calendar month                          | yes (V code + docs)                                                           |
| R2 Class B ops vs 10 M/month            | same                                                                              | same                                                                                                        | same                                 | UTC calendar month                          | yes                                                                           |
| Workers requests vs 100,000/day         | `workersInvocationsAdaptive`                                                      | same                                                                                                        | same                                 | UTC day (resets 00:00 UTC = 17:00 Mazatlan) | yes (V Workers pricing 2026-10-02)                                            |
| Durable Objects requests vs 100,000/day | `durableObjectsInvocationsAdaptiveGroups`                                         | same                                                                                                        | same                                 | UTC day                                     | yes (V Workers pricing 2026-10-02)                                            |
| Period spend                            | none (Free = $0)                                                                  | none                                                                                                        | -                                    | month                                       | yes, as text                                                                  |
| R2 overage in money                     | static documented prices ($0.015/GB-month, $4.50/M Class A, $0.36/M Class B)      | none                                                                                                        | -                                    | month                                       | only when used > limit (V R2 pricing)                                         |
| Workers/DO overage in money             | prices only exist on paid plan                                                    | none                                                                                                        | -                                    | -                                           | no; units only (V prices; NV exact Free behavior past 100k/day)               |

Discarded for now: Durable Objects duration (13,000 GB-s/day, V docs) - reconsider if DO usage
grows. The Preview token absence report is (NV): documented as optional/usually empty in
`docs/env-workflow.md`; confirming would require reading Vercel secrets.

### Supabase — one project per environment; project quotas (Free plan)

| Metric vs Free quota                           | Source                                                      | Credential                                                                                                                                                                                          | Freshness                         | Window   | Show                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| Database/disk size vs 500 MB                   | Management API `GET /v1/projects/{ref}/config/disk/util`    | `SUPABASE_MANAGEMENT_TOKEN` (proposed; read-only PAT: `analytics_usage_read`, `infra_disk_config_read`) + `SUPABASE_PROJECT_REF_PREVIEW` / `SUPABASE_PROJECT_REF_PRODUCTION` (proposed, non-secret) | 5-15 min cache; provider lag (NV) | snapshot | yes (V docs endpoint + scopes; NV live; NV whether disk util equals "database size") |
| Egress vs 5 GB, Storage vs 1 GB, MAU vs 50,000 | Supabase usage dashboard only                               | none (link)                                                                                                                                                                                         | dashboard                         | month    | link only (V quotas; NV any API equivalent)                                          |
| Spend / overages                               | Free = $0, no on-demand; risk is hard limit / project pause | none                                                                                                                                                                                                | -                                 | -        | yes, as text (V pricing)                                                             |

Rate limit 30 req/min on analytics endpoints (V docs). Local is Docker and out of scope.

### Vercel — one project (Hobby); project/team quotas

| Metric                                                                                | Source                                                                    | Credential                                                                     | Freshness             | Window        | Show                                              |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------- | ------------- | ------------------------------------------------- |
| Period spend by service                                                               | `GET /v1/billing/charges` (FOCUS, 1-day granularity) / `vercel usage` CLI | `VERCEL_API_TOKEN` (proposed, billing read-only) + `VERCEL_TEAM_ID` (proposed) | billing pipeline (NV) | billing cycle | yes (V changelog/docs; NV that it works on Hobby) |
| Use vs included (invocations 1 M, Active CPU 4 h, Provisioned Memory 360 GB-hrs, ...) | Vercel Usage dashboard (allotment + projection)                           | none (link)                                                                    | dashboard             | cycle         | link only (V pricing/limits; NV usage API)        |
| Operational limits (projects, 100 deploys/day, ...)                                   | docs Limits 2026-09-16                                                    | none                                                                           | static                | -             | no (does not answer the decision questions)       |
| Spend / overages                                                                      | Hobby $0, no on-demand pricing                                            | -                                                                              | -                     | -             | yes, as text (V pricing)                          |

Environment (Preview vs Production) breakdown is (NV) - label "del proyecto, no de un entorno" and
link to the dashboard.

### Cloudinary — one shared cloud (public_id namespaces `preview/...` / `production/...`)

| Metric                                       | Source                                                                                            | Credential                                                                                                                                                                          | Freshness                                           | Window                          | Show                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| Credits used vs included                     | Admin API `usage` (`cloudinary.api.usage()`, already used in `scripts/invitation/media-audit.ts`) | `CLOUDINARY_USAGE_API_KEY` / `CLOUDINARY_USAGE_API_SECRET` (proposed, read-only restricted key); fallback: existing `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` (higher privilege) | "numbers are updated periodically" (V docs) + cache | monthly credit cycle            | yes (V Admin API `usage` fields: storage, credits, bandwidth, requests, resources, add-ons) |
| Storage, bandwidth, requests, resource count | same                                                                                              | same                                                                                                                                                                                | same                                                | cumulative/cycle (NV per field) | yes (V fields; NV Free plan limits)                                                         |
| Spend / overages                             | Free $0; Free credit count (NV)                                                                   | -                                                                                                                                                                                   | -                                                   | -                               | credits used/remaining only                                                                 |

Per-environment split is not feasible from the usage API (one product environment); our records
classify by public_id prefix (`classifyCloudinaryPublicIdEnvironment`) but that is out of scope.

### Other providers in the inventory - discarded

Upstash Redis (rate limiting, no critical quota), Gmail (transactional mail), GA4 and Meta
Pixel/CAPI (product/marketing analytics), Vercel Analytics / Speed Insights (their event quotas live
in the Vercel Usage dashboard). None answers the platform decision questions.

## Environment feasibility

Implemented refinement (2026-10-02, reported to the owner): R2 storage is queried grouped by
`bucketName` and shown as one line per non-local bucket plus the account total (single-bucket
fallback query keeps the meter alive if the dimension is ever rejected). R2 Class A/B, Workers and
Durable Objects stay account totals only (their quota is account-wide and the split adds rows
without answering a decision question; the `bucketName`/`scriptName` dimensions remain an option).

| Metric                                  | Local                                                                      | Preview                                             | Production         | Required label                                                |
| --------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- | ------------------ | ------------------------------------------------------------- |
| R2 storage                              | no own value; local bucket excluded from lines, still counted in the total | own bucket line (scope of this panel's environment) | own bucket line    | bucket lines are environment-owned; the sum is "de la cuenta" |
| R2 Class A/B, Workers / Durable Objects | no                                                                         | account total only                                  | account total only | "de la cuenta, no de un entorno"                              |
| Supabase                                | no (Docker)                                                                | yes (own project)                                   | yes (own project)  | environment-owned                                             |
| Vercel                                  | no                                                                         | not separable (one project)                         | not separable      | "del proyecto, no de un entorno" + dashboard link             |
| Cloudinary                              | no                                                                         | no (one cloud)                                      | no                 | "de la cuenta (product environment), no de un entorno"        |
| Costs ($0 today)                        | excluded                                                                   | -                                                   | -                  | "del plan/periodo"                                            |

Local is excluded from the page: no costs, and its real Cloudflare usage already lands in the
account totals that are shown.

## Menu and other dashboards

Real menu (V `src/layouts/DashboardLayout.astro`): Administracion, Espacios de recuerdos, Estado
(conditional), Codigos de acceso, Produccion de invitaciones, Comercial, Usuarios. The label
"Publicacion de demos" does not exist in code (NV) - open question for the owner.

- Espacios de recuerdos: keeps per-space cards and committed storage by spaces; the Cloudflare
  platform meter moves to "Plataforma".
- Estado operacional: deployment/capability status, not consumption - no.
- Comercial: conversion/leads - no.
- GA4 / Vercel Analytics / Speed Insights: product analytics, not infrastructure limits - no.

Location comparison: extend Espacios de recuerdos (mixes platform with memories operations), new
"Plataforma" page (owner-approved), or new page without moving the meter (duplicates logic). Chosen:
new page "Plataforma".

## What is shown / not shown

Shown per provider card (independent degradation per provider): used/quota meter with 70/90 %
thresholds and scope label; simple projection from the period in progress (intraday rate for daily
quotas, estimated exhaustion date for monthly ones, labeled "estimacion de ritmo constante"); "$0
(plan gratuito)" plus estimated overage only when used > limit (money only for R2); freshness stamp
("aprox. HH:MM") and an official-dashboard link; states ok / sin configurar / no disponible.

Not shown: history and snapshots (decision 4); email/WhatsApp alerts (decision 5); guest names,
object keys, account identifiers (privacy only aggregates); per-environment splits for Vercel and
Cloudinary (not feasible/verified); Vercel operational limits, DO duration, GA4/Analytics metrics;
projected paid-plan costs and undocumented overage prices (units only).

## Architecture

Single home for quotas, warning thresholds, formatting, cache and the Cloudflare client. Contract
(no imports) -> server -> client; client only renders; tokens stay server-only; responses are
aggregated (never raw provider payloads); super-admin only, rate-limited.

Generic code moves out of `memories` into `src/lib/platform/` (the platform page is not a memories
concern). Mechanical, bounded move:

- New: `src/lib/platform/contract/limits.ts` (quotas per provider + 70/90 thresholds, moved from
  `src/lib/memories/contract/limits.ts`), `src/lib/platform/contract/types.ts` (`PlatformMeter`,
  `ProviderUsage` with `kind: 'ok' | 'unconfigured' | 'unavailable'`).
- New: `src/lib/platform/server/cloudflare-usage.ts` (moved from `src/lib/memories/server/`; same
  pattern: 5 s timeout, never throws, 5 min cache, no error bodies), `supabase-usage.ts`,
  `vercel-usage.ts`, `cloudinary-usage.ts` (same pattern), `platform-usage.service.ts` (independent
  aggregation per provider).
- New: `src/lib/platform/dashboard-copy.ts` (Spanish "usted" UI copy + generic formatters taken from
  `src/lib/memories/dashboard-copy.ts`).
- New UI: `src/components/dashboard/platform/PlatformUsagePanel.tsx` + one card per provider (island
  following `MemoriesPlatformUsage.tsx`); SCSS per `.agent/rules/dashboard-styling.md` (no inline
  styles; `memories-meter` classes become `platform-meter`).
- New route/API: `src/pages/dashboard/admin/plataforma.astro`,
  `src/pages/api/dashboard/admin/platform/usage.ts` with `requireAdminStrongSession` +
  `requireAdminRateLimit(request, 'platform:usage')` + `withPrivateCache` (pattern of
  `src/pages/api/dashboard/admin/memories/platform-usage.ts`).
- Menu entry "Plataforma" (adminOnly) in `src/layouts/DashboardLayout.astro`.
- Memories cleanup: `src/pages/dashboard/admin/recuerdos.astro` and `src/lib/memories/client/api.ts`
  stop using `platform-usage`; the Cloudflare block leaves (committed-by-spaces stays);
  `src/pages/api/dashboard/admin/memories/platform-usage.ts` is deleted and its tests updated (one
  endpoint = one home).
- `eslint.config.js` (`eslint-plugin-boundaries`): new `platform-contract` (import-free),
  `platform-server`, `platform-ui` elements with the same policies as `memories-*`; allow
  `memories-ui -> platform-contract` and `page -> platform-server`.
- Env names only (`src/env.d.ts`, `docs/env-workflow.md`, `.env.example`): keep
  `MEMORIES_CLOUDFLARE_*` (already-deployed secrets); proposed `SUPABASE_MANAGEMENT_TOKEN`,
  `SUPABASE_PROJECT_REF_PREVIEW`, `SUPABASE_PROJECT_REF_PRODUCTION`, `VERCEL_API_TOKEN`,
  `VERCEL_TEAM_ID`, optional `CLOUDINARY_USAGE_API_KEY`/`CLOUDINARY_USAGE_API_SECRET`. Each
  credential read-only, one per environment, least privilege.
- Time windows are labeled UTC with the America/Mazatlan (UTC-7) equivalent: "dia UTC = 00:00 UTC
  (17:00 en Mazatlan)"; UTC calendar month.

## Verification

- Jest units: per-provider degradation (`ok`/`unconfigured`/`unavailable`), R2 Class A/B
  classification, UTC window bounds, 70/90 thresholds, formatting, exhaustion projection, and no
  secrets in payloads. Move/extend `tests/unit/memories/cloudflare-usage.test.ts` and
  `tests/unit/memories/limits-coherence.test.ts`.
- API tests around the new endpoint (401/403, rate limit, cache, one failing provider does not break
  the aggregate); update `tests/api/memories.console.test.ts`.
- Commands: `pnpm test:changed`, `pnpm test`, `pnpm type-check`, `pnpm lint`, `pnpm lint:styles`,
  `pnpm validate:changed`, `pnpm ci:static`; close with `pnpm run ci` when feasible.
- Manual Preview/Production checks: with and without `MEMORIES_CLOUDFLARE_*` (Preview expected
  state: "sin datos"); scope labels; uploads and sales are not blocked past 100 %.

## Risks

- `MEMORIES_CLOUDFLARE_*` absent in Preview (NV) -> Cloudflare card "sin datos" there; existing
  degradation covers it.
- `/v1/billing/charges` on Hobby (NV) -> Vercel card may show text only; dashboard link.
- Supabase Management API on Free: analytics/disk endpoints availability and scopes (NV live); link
  to the usage page; 30 req/min limit respected by cache.
- Cloudinary "updated periodically" (V docs) and Free credit count (NV) -> "aprox." stamp.
- R2 GB-month semantics (V docs) vs 24 h snapshot (V code) -> "aproximado" label.
- Projection without history is coarse (constant-rate assumption) -> explicit label.
- Static overage prices may stale -> units first, prices cited with date.
- Menu label "Publicacion de demos" unresolved (NV) -> confirm with the owner.
- Local shares the Cloudflare account -> account totals include dev; labels cover it.

## Task Contract

- Authorized actions: edit only the scope above; no Git writes, no deploys, no database mutations,
  no token/account creation.
- Non-goals: history/snapshots, proactive alerts, GA4/Analytics widgets, paid-plan projections,
  provider-side blocking logic, renaming existing `MEMORIES_CLOUDFLARE_*` secrets.
- Invariants: Spanish UI ("usted"), English code, SCSS only, server/client boundary, no secrets in
  client/API responses/logs, aggregates only, no absolute machine paths, technical commit-free
  session (Git writes remain separately gated).
- Acceptance: the six plan sections realized as described; every shown metric carries source,
  credential name, freshness, window and scope label; tests and listed commands pass.
- Stop conditions: any request to read secret values, mutate Git/DB, or widen scope; unresolved
  boundary/lint conflicts that would weaken `eslint-plugin-boundaries`.

## Implementation status (2026-10-02)

Implemented as planned (contract -> server -> client under `src/lib/platform/`, page
`/dashboard/admin/plataforma`, endpoint `GET /api/dashboard/admin/platform/usage`, meter classes
extracted to `src/styles/dashboard/_meter.scss` as `usage-meter`). Validation run locally:
`pnpm test` (7173 passed, 1 pre-existing skip), `pnpm type-check`, `pnpm lint`, `pnpm lint:styles`,
`pnpm validate:changed`, `pnpm build:app`. E2E suites were intentionally not run here (need
Preview/browser fixtures); they remain for CI.

Open, owner-side: provision the read-only credentials (`SUPABASE_MANAGEMENT_TOKEN`,
`VERCEL_API_TOKEN`, optional `CLOUDINARY_USAGE_*`) and the non-secret refs/team id per
`docs/env-workflow.md`; confirm whether the menu entry "Publicacion de demos" (not found in code)
maps to something else; decide later whether R2 operations get a per-bucket breakdown.

## Amendment 2026-10-03 — environment-scoped panels and missing-credential notices

Owner-approved additions (decision round of 2026-10-03):

1. **Panel scoping:** Local shows both environments (Preview and Production); the Preview deployment
   shows only Preview and the Production deployment only Production. Applies to both metrics and
   credential-status notices.
2. **Shared quotas stay visible** in every scoped panel as an explicit context section labeled
   "compartido por ambos entornos" (R2 operations, Workers, Durable Objects, R2 account storage
   total, Vercel, Cloudinary): hiding them would misanswer "am I running out of quota".
3. **Missing-credential notices** show variable name + brief description + the official link where
   to generate it (verified 2026-10-02/03: Cloudflare account API token template URL
   `dash.cloudflare.com/?to=/:account/api-tokens` with the `account_analytics: read` permission
   pre-filled - Manage account > Account API tokens, a service token not tied to a user, not the
   empty User API Tokens page; Supabase `supabase.com/dashboard/account/tokens` with Usage
   Analytics + Disk Config Read scopes; Vercel `vercel.com/account/tokens`; Cloudinary
   `console.cloudinary.com/settings/api-keys`). Names only, never values; non-blocking gaps also
   render on `ok` cards (Supabase with one ref missing, Cloudinary falling back to the upload key).
4. **Per-environment config resolution:** in Local each section reads `NAME_PREVIEW` /
   `NAME_PRODUCTION` and falls back to plain `NAME` (shared values). Deployments read only their
   plain names. Local-only suffixed names (names only, optional):
   `MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PREVIEW/_PRODUCTION`,
   `MEMORIES_R2_BUCKET_NAME_PREVIEW/_PRODUCTION`, `SUPABASE_MANAGEMENT_TOKEN_PREVIEW/_PRODUCTION`.
   Exception: the R2 bucket falls back to the suffix classifier over observed buckets (base ->
   Production, `-staging`/`-preview` -> Preview, `-local` -> excluded), never to the plain Local
   bucket. `MEMORIES_CLOUDFLARE_ACCOUNT_ID`, `VERCEL_API_TOKEN`, `VERCEL_TEAM_ID` and the
   `CLOUDINARY_*` names stay shared (one account/project/cloud).
5. Local reflects only what is loaded locally; to diagnose "Preview lacks the token" from Local,
   leave the Preview-suffixed value unset. Vercel and Cloudinary have no per-environment split (not
   verified); Workers/DO remain account totals.

Implemented 2026-10-03: `src/lib/platform/server/env-profiles.ts` resolves per-environment profiles,
`src/lib/platform/contract/environments.ts` attributes buckets by the repository naming convention,
the report is assembled as sections (`PlatformUsageReport = PlatformSection[]`) and the panel
renders one section per visible environment plus the shared one. Validation run locally: `pnpm test`
(7192 passed, 1 pre-existing skip), `pnpm type-check`, `pnpm lint`, `pnpm lint:styles`,
`pnpm validate:changed`, `pnpm build:app`. E2E suites intentionally left for CI.
