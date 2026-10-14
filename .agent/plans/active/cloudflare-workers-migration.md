---
title: Vercel to Cloudflare Workers migration (zero Vercel, Cloudinary retired)
status: active
created: 2026-10-10
updated: 2026-10-13
type: production rollout
autonomy: 2
related_skills:
  - wrangler
  - workers-best-practices
  - cloudflare-email-service
related_docs:
  - docs/core/architecture.md
  - docs/core/release-execution.md
  - docs/core/git-governance.md
  - docs/env-workflow.md
  - docs/database-workflow.md
  - docs/domains/invitations/performance-metrics.md
  - docs/domains/intake/production-flow.md
  - workers/celebra-memories-sign/OWNER.md
  - .agent/rules/database.md
  - .agent/rules/git-safety.md
---

# Vercel to Cloudflare Workers migration

## 1. Objective

Run Celebra-me (Astro 7 SSR) on Cloudflare Workers with functional parity or better, then remove
every trace of Vercel. At the end, Cloudinary is also retired: invitation media lives in R2 and is
transformed with the Images binding.

The project must end smaller than today:

- fewer dependencies, files, scripts, environment variables and providers;
- no shims, aliases, dual fallbacks or temporary flags left behind. The temporary dual build and
  image implementations needed while both platforms serve (F3/F4–F7) are listed in the pruning
  ledger (§14) with their removal point.

Success means all of the following:

- Production serves from the Worker with release evidence equivalent to today's: SHA verification, a
  commit status on the exact SHA, and a deployment attestation for contract migrations.
- The zero-Vercel sweep (§9) returns no matches.
- Cloudinary holds no live dependency (§9).
- The reduction metrics in §10 are measured and no worse than the baseline.

## 2. Operation mode and authorization

| Item               | Rule                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mode per phase     | F0a–F4 `implement` on task branches; F5–F7 and F9 data steps `release-ops`, each operation enumerated and approved by the owner                                                                                     |
| Git writes         | Gated per task (`.agent/rules/git-safety.md`). Commit, push and merge require explicit current-task authorization                                                                                                   |
| Infrastructure     | Owner approves each of these before it happens: creating any Worker, binding, R2 bucket, secret, Access policy or DNS change, the Cloudflare plan change, and deleting the Vercel project or the Cloudinary account |
| Databases          | Preview and Production writes, including the F9 URL rewrite, only through guarded workflows (`.agent/rules/database.md`), with a backup and the exact expected row count                                            |
| Worktree exception | Owner approved on 2026-10-10 a task-only fifth worktree outside the four-lane model. Tooling sees it as lane `unknown` (port 4399, Local runtime). Report it in every handoff                                       |
| Spike branch       | `candidate/cloudflare-workers-spike` is never integrated. This plan file must be committed on a branch that reaches `develop`, not on the spike                                                                     |

## 3. Scope and non-goals

**In scope:**

- Astro adapter, runtime compatibility and environment identity.
- Platform configuration: crons, headers, redirect, secrets and environments.
- Images, email, rate limiting and the memories Workers integration.
- CI/CD and release evidence.
- Observability and analytics, `/privacidad` copy, DNS and domain.
- Documentation, removal of Vercel and Cloudinary, and the zero-legacy validator.

**Non-goals:**

- Database schema redesign.
- Merging the memories Workers into the app Worker.
- Moving Supabase.
- Registrar transfer (D16).
- Product changes beyond parity, except where an owner decision says otherwise.

## 4. Invariants

- **Freeze:** no Production, DNS or production-Worker change from 2026-10-23 to 2026-11-07 (a client
  memories window; the event is on 2026-10-30).
- **Fail-closed security:** every security gate (MFA bypasses, local observability, mutations,
  cookie `Secure`, debug payloads) must fail closed when the deploy identity is missing or invalid.
  Each gate is proven with tests before any app Worker serves traffic.
- **Shared database:** the Vercel and Cloudflare builds of the same SHA run against the same
  database. No migrations from T-3 days to T+7 days around the cutover. No contract migration
  between the cutover and the first trusted smoke produced by the new pipeline.
- **Printed QR continuity:** `https://celebra-me.com/r/<slug>` keeps working at every step. The apex
  answers 307 to `https://www.celebra-me.com` with path and query preserved.
- **Repository rules:** UI copy in Spanish ("usted"); code, identifiers and comments in English;
  relative paths only; SCSS only; server-only code never reaches client islands; `package.json` is
  the only source of scripts; commit messages never mention phase or goal identifiers.

## 5. Known evidence (established 2026-10-10; do not re-audit without cause)

| Fact                                                                                                                                                                                                                                                                    | Where                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@astrojs/cloudflare@14.3.4` (2026-10-06) peers `astro ^7.2.0` and `wrangler ^4.125.0`. Repo has `astro` 7.3.5                                                                                                                                                          | npm registry                                                                                                                                                                                                                    |
| Server talks to Supabase with plain `fetch`. supabase-js runs in the browser only. No direct Postgres at runtime                                                                                                                                                        | `src/lib/rsvp/repositories/supabase.ts:138`, `src/lib/client/mfa-setup.ts:1`                                                                                                                                                    |
| All env reads go through `getEnv()`, which reads `process.env[key]`. No env reads at module scope                                                                                                                                                                       | `src/lib/server/env.ts:7-10`                                                                                                                                                                                                    |
| Without `VERCEL_*`, these fail **open**: the dev MFA bypass (`NODE_ENV` missing counts as development), cookie `Secure`, and `?debug=1`. Storage falls back to `local`                                                                                                  | `src/lib/server/dev-mfa-bypass.ts:45-77`, `src/middleware.ts:131,183,192`, `src/lib/rsvp/auth/cookies.ts:1-3`, `src/pages/api/auth/session.ts:49-50`, `src/lib/intake/services/storage-provider.ts:175-191`                     |
| Without `VERCEL_ENV`, mutations always throw, so Production would have a full write outage                                                                                                                                                                              | `src/lib/server/runtime-mutation-environment.ts:22-51`                                                                                                                                                                          |
| `sharp` runs at request time for the unpaid-invitation watermark and for upload re-encoding. Its static import in the Cloudinary module loads it in 7 routes                                                                                                            | `src/lib/invitation/preview/preview-media-renderer.ts:14-95`, `src/lib/intake/services/asset-policy.ts:11-57`, `src/lib/intake/services/cloudinary-assets.ts:3`                                                                 |
| Workerd blockers that are not runtime APIs: `child_process.spawn` (local status panel), `fs` reads of the repo, and a self-fetch of `/_astro/*`                                                                                                                         | `src/lib/status/server/canonical-status.ts:5-7`, `src/lib/intake/services/editor-divergence.service.ts:10-11`, `src/lib/intake/services/asset.service.ts:353-368`                                                               |
| Fire-and-forget work without `waitUntil`                                                                                                                                                                                                                                | `src/lib/commercial/orders.service.ts:115,170,180`, `src/lib/tracking/lead.service.ts:140`                                                                                                                                      |
| Client IP and origin come from `x-forwarded-*`                                                                                                                                                                                                                          | `src/lib/rsvp/core/http.ts:118-122`, `src/lib/rsvp/security/auth-security.ts:70-126`                                                                                                                                            |
| Crons, the redirect and the security headers exist only in `vercel.json`. The middleware sets no security headers                                                                                                                                                       | `vercel.json`, `src/middleware.ts:118-123`                                                                                                                                                                                      |
| Release evidence comes from GitHub artifacts that Vercel writes (Deployments, `repository_dispatch`, smoke status), not from the Vercel API                                                                                                                             | `.github/workflows/post-deploy-smoke.yml`, `scripts/ops/release-status.ts:60-210`, `scripts/ops/release-readiness.ts:6-218`, `scripts/db/contract-deployment-evidence.ts:36-70`, `scripts/db/deployed-app-attestation.ts:49-89` |
| Vercel project env: 32 names. No `UPSTASH_*`, so the production rate limit is in-memory per instance. No `PREVIEW_MEDIA_SECRET`, so the preview token HMAC falls back to the service role key. No `CLOUDINARY_*` (team-shared variables suspected)                      | Vercel API, names only                                                                                                                                                                                                          |
| Six Vercel env names are unused: `RSVP_TOKEN_SECRET`, `RSVP_CLAIM_CODE_PEPPER`, `RSVP_ADMIN_PASSWORD`, `RSVP_ADMIN_USER`, `SUPER_ADMIN_EMAILS`, `PREVIEW_MFA_BYPAS`                                                                                                     | `git grep`                                                                                                                                                                                                                      |
| Email is the contact form only (Gmail SMTP through `nodemailer`)                                                                                                                                                                                                        | `src/lib/server/email.ts`, `src/pages/api/contact.ts`                                                                                                                                                                           |
| DNS at Namecheap (`pdns1/2.registrar-servers.com`): apex A record to Vercel, `www` CNAME to `vercel-dns`, TTL 3601 s. Mail is Zoho (MX ×3, SPF, DKIM `zmail._domainkey`, DMARC `p=none`). TXT verifications for Google, Facebook, OpenAI and Zoho. No DS record visible | public DNS                                                                                                                                                                                                                      |
| Cloudinary Free plan: 15.04 of 25 credits used (60 %). Bandwidth 15 GB = 14 credits; storage 616 MB; 911 resources; 457 transformations; 85k requests. AI image generation is exhausted (53/50) and already replaced by Canva                                           | Cloudinary usage API                                                                                                                                                                                                            |
| Vercel matches: 982 lines in 177 tracked files (excluding the lockfile and `CHANGELOG.md`); 10 `vercel` packages in the lockfile                                                                                                                                        | `git grep -i -c vercel`                                                                                                                                                                                                         |
| Baseline: 3,295 tracked files; 446,181 TS/TSX/ASTRO/MJS/SCSS lines; 137 scripts; 27 dependencies and 46 devDependencies; 3 workflows; 179 env names read in code                                                                                                        | see §10 commands                                                                                                                                                                                                                |

## 6. Owner decisions

| #   | Decision                                                             | Recommendation                                                                                                                    | Status                 |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| D1  | Workers Paid ($5/month per account; the zone stays on the Free plan) | Contract before F0b (2026-10-15); at the latest before F3/F4 (2026-10-26)                                                         | pending                |
| D2  | Cutover date                                                         | 2026-11-12, 08:00 America/Mazatlan                                                                                                | pending                |
| D3  | Nameserver change date                                               | 2026-11-09, after the freeze                                                                                                      | pending                |
| D4  | Contact-form email                                                   | Cloudflare Email Service, or no email at all if leads are read in the dashboard                                                   | pending                |
| D5  | Analytics                                                            | Cloudflare Web Analytics snippet in F2; decide whether it sits behind consent                                                     | pending                |
| D6  | Watermark EXIF/XMP provenance                                        | Accept the loss; the visible mark and the HTML rights metas stay                                                                  | pending                |
| D7  | Image service for bundled assets on SSR pages                        | Images binding at runtime; accept the visual re-baseline                                                                          | pending                |
| D8  | Rate limiting                                                        | `ratelimits` bindings; delete the Upstash backend                                                                                 | pending                |
| D9  | Cloudinary                                                           | **Retire it in F9: move media to R2 and transforms to the Images binding.** Keep Cloudinary through F7 behind a small REST client | **decided 2026-10-10** |
| D10 | Cron HTTP routes                                                     | `scheduled()` only; delete the routes and `CRON_SECRET`                                                                           | pending                |
| D11 | Local `/dashboard/estado` panel                                      | Delete it and use the status CLI                                                                                                  | pending                |
| D12 | Preview protection and the Preview MFA bypass                        | Access on `preview.celebra-me.com` plus a service token; re-key the bypass to the deploy identity                                 | pending                |
| D13 | Deploy mechanism                                                     | GitHub Actions + wrangler (needs a `CLOUDFLARE_API_TOKEN` secret)                                                                 | pending                |
| D14 | Memories retrieve Worker                                             | Service Binding in F8                                                                                                             | pending                |
| D15 | `CHANGELOG.md` in the zero-Vercel sweep                              | Exclude it as history                                                                                                             | pending                |
| D16 | Registrar                                                            | Stay on Namecheap                                                                                                                 | pending                |
| D17 | Apex redirect status                                                 | Keep 307                                                                                                                          | pending                |
| D18 | Secret hygiene                                                       | Add `PREVIEW_MEDIA_SECRET`; delete the 6 unused names and the Vercel project variable `NODE_ENV=development`                      | pending                |
| D19 | `X-Render-Timing` headers                                            | Delete them                                                                                                                       | pending                |

## 7. Phases

Validation for every phase: `pnpm validate:changed` → `pnpm type-check` → `pnpm run ci`. On Windows,
the certified compare runs through `pnpm validate:prepush --sha <sha> --base-sha <base>`. Each phase
ends with its smoke. One task branch per phase, cut from `develop`.

| Phase                                   | Dates          | Branch / platform                                   | Cloudflare plan                                                               | Objective and main changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Exit criteria                                                                                                                    | Rollback                                   | Effort / risk |
| --------------------------------------- | -------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------- |
| **F0a** Local spike                     | 10-12 → 10-14  | `candidate/cloudflare-workers-spike`, workerd local | none                                                                          | Adapter swap, minimal `wrangler.jsonc`, build. Exercise SSR pages, auth middleware against the Preview DB, `qrcode`, `sanitize-html`, memories ECDSA against the staging Workers, and `astro dev` with lane env                                                                                                                                                                                                                                                                                                                                                                                     | Written works/fails list                                                                                                         | Delete the branch                          | 2 d / M       |
| **F0b** Deployed spike                  | 10-15 → 10-16  | Test Worker on workers.dev behind Access            | **Paid required from here**: on Free, any SSR request over 10 ms of CPU fails | CPU p50/p95 per route, bundle size, Images binding with the watermark                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Go/no-go with measured CPU                                                                                                       | Delete the test Worker                     | 1 d / M       |
| **F1** Deploy identity                  | 10-14 → 10-21  | `feat/deploy-identity`, Vercel                      | none                                                                          | `src/lib/server/deploy-identity.ts` becomes the only reader of `CELEBRA_DEPLOY_ENV`. `CELEBRA_BUILD_SHA`/`CELEBRA_BUILD_REF` come from Vite `define`. Migrate 20 consumers. Remove the `NODE_ENV \|\| 'development'` default. Cookie `Secure` and debug key off the deploy env. No storage fallback. Health reports `CELEBRA_BUILD_SHA`. Validator rule bans direct reads                                                                                                                                                                                                                           | Fail-closed test matrix per gate; Preview VERIFIED                                                                               | Revert the merge                           | 3 d / H       |
| **F2** Neutral preparation              | 10-16 → 11-04  | one branch per slice, Vercel                        | none                                                                          | Headers and redirect in middleware (+ `public/_headers` parity test). `getClientIp()` (`CF-Connecting-IP` on Cloudflare). `runAfterResponse()`. Cloudinary SDK → REST. Drop the static sharp import. Crons as invocable services. Delete Upstash, `vercel-usage`, `/dashboard/estado` (D11) and `perf_hooks`. Rename `vercel-image-policy`. Cloudflare Web Analytics snippet (D5). Delete the unused Vercel env names. Neutral smoke status names (live once on `main`). Memories ECDSA signing passes the PEM string (or WebCrypto) instead of a `KeyObject` (F0a). `editor-divergence` local-only | Full suite; Preview VERIFIED; visual diff 0                                                                                      | Revert per branch                          | 7 d / M       |
| **F3** Images                           | 10-26 → 11-04  | migration branch, Preview Worker                    | Paid                                                                          | `ImageTransformer` interface: `sharp` implementation for the Vercel build, Images binding implementation for the Cloudflare build (temporary dual, pruned in F7). `imageService` (D7). Delivery contract and tests. Visual re-baseline                                                                                                                                                                                                                                                                                                                                                              | Watermark parity captures; upload tests; certified candidate + `visual:parity:accept`                                            | No Production impact                       | 6 d / H       |
| **F4** Cloudflare Preview + pipeline    | 10-26 → 11-06  | Cloudflare Preview alongside Vercel Preview         | Paid                                                                          | Temporary dual build target (`CELEBRA_BUILD_TARGET` selects the adapter; pruned in F7). `wrangler.jsonc` with `env.preview`, sessions disabled. `src/worker.ts` exporting `fetch` + `scheduled`. Secrets. `deploy.yml` (versions upload with SHA tag → smoke → versions deploy → GitHub Deployment + status). `release-status`, `release-readiness` and the attestation. Access + service token. `ratelimits` bindings (D8). Crons in Preview. Staging Sign Worker allow-list moves to the new Preview host                                                                                         | Cloudflare Preview VERIFIED (SHA, health, public and authenticated smoke); crons ran in Preview; the gate reads the new evidence | Disable the workflow; Vercel Preview stays | 7 d / H       |
| **F5** Nameservers                      | **11-09**      | DNS                                                 | Free zone + Paid account                                                      | TTL to 300 s on 11-07. Copy every record DNS-only (Zoho MX, SPF, DKIM, DMARC, TXT). Change NS. DNSSEC. Edge certificate. Email Service sending domain alongside Zoho SPF/DKIM                                                                                                                                                                                                                                                                                                                                                                                                                       | Records match §5; Zoho mail in and out; apex 307; Production VERIFIED                                                            | Restore the Namecheap NS                   | 1 d / H       |
| **F6** Cutover                          | **11-12**      | Production                                          | Paid                                                                          | §8                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | §8                                                                                                                               | Delete the routes (≤ 10 min)               | 1 d / H       |
| **F7** Vercel retirement                | 11-19 → 11-24  | both                                                | Paid                                                                          | Pause, then delete Vercel. Enable production Cron Triggers at the same moment. Switch to Custom Domains. Delete the Vercel legacy. Rewrite the docs and `/privacidad` (owner approves copy). Zero-Vercel validator. GitHub secrets and vars. Supabase Auth redirect URLs                                                                                                                                                                                                                                                                                                                            | §9 Vercel sweep = 0; §10 measured                                                                                                | Unpause the project until it is deleted    | 3 d / M       |
| **F8** Optional                         | after 11-24    | Cloudflare                                          | Paid                                                                          | Service Binding for the memories retrieve Worker; retrieve without `workers_dev` (D14)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Memories canary green                                                                                                            | Revert                                     | 1 d / L       |
| **F9** Media to R2 (Cloudinary retired) | from **11-24** | `feat/media-r2`, Cloudflare                         | Paid (R2 and Images billed by usage; current volume fits the free tiers)      | See §7.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | §9 Cloudinary sweep = 0; every published image verified                                                                          | §7.1                                       | 5–7 d / M     |

**Effort:** about 37 person-days in total (F0a–F8 about 31, F9 about 6).

**Paid gate:** F0a, F1 and F2 (about 13 days) need no paid plan. Workers Paid becomes mandatory at
the first deployed SSR Worker (F0b).

**Rejected:** free "bridge" Workers for crons or images called from Vercel. They would be temporary
legacy.

### 7.1 F9: media to R2

- **Storage:** one R2 bucket per environment (Preview, Production). Object keys keep today's
  hash-versioned names, so URLs stay immutable. Public delivery through an R2 custom domain on the
  zone (for example `media.celebra-me.com`; the zone is on Cloudflare after F5), cached at the edge.
  R2 has no egress fees.
- **Writes:** `storage-provider.ts` gains an R2 provider through a Worker binding and loses the
  Cloudinary provider. Upload validation and encoding stay on the Images binding (F3).
- **Transforms:** social images (today `c_fill,g_auto,w_1200,h_630`) use the Images binding with
  `fit: cover` and automatic gravity. Verify the exact gravity option before building.
- **Data:**
  1. Copy the 911 resources to R2 and verify each SHA-256.
  2. Rewrite `res.cloudinary.com` URLs in published content and drafts through a guarded workflow:
     backup, dry run, exact expected counts, Preview first, then Production.
  3. Regenerate `release-hash-baseline.json`, because `packageHash` values change.
- **Tooling:** adapt
  `scripts/provision/{cloudinary-adapter,cloudinary-quota,dbs-media-references,invitation-import-engine}.ts`,
  `scripts/invitation/{image-namespace-remap,verify-published-images}.ts`, the delivery contract and
  `astro.config.mjs` `remotePatterns`.
- **Removals:**
  - the Cloudinary usage card (`src/lib/platform/server/cloudinary-usage.ts` and its wiring);
  - `cloudinary-assets.ts`;
  - the 5 env names `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
    `CLOUDINARY_USAGE_API_KEY`, `CLOUDINARY_USAGE_API_SECRET`.
- **Grace period:** keep the Cloudinary account read-only for 30 days, because chat link previews
  already cached in WhatsApp or Facebook point at it. The owner then deletes the account.
- **Rollback:** reverse the URL map from the backup; Cloudinary stays readable during the grace
  period.
- **Risk to watch before F9:** Cloudinary bandwidth. Check credits weekly during the freeze. If
  usage passes 85 % before F9, the owner decides between moving delivery early and a temporary
  upgrade.

## 8. Cutover (F6) and rollback

**Preconditions (T-3 days to T-1 hour):**

- The migration chain is closed: no pending migrations, no contract planned before T+7.
- The candidate SHA is live on Vercel Production and uploaded to the production Worker without
  routes. The smoke passed against the version URL behind Access.
- The zone has been active for at least 72 hours. The edge certificate covers the apex and `www`.
  SSL mode is Full (strict).
- Production secrets are verified by name. `CELEBRA_DEPLOY_ENV=production`, and health returns the
  candidate `CELEBRA_BUILD_SHA`.
- Production Cron Triggers are **disabled** on the Worker; crons keep running on Vercel until F7.
- The cutover time avoids 10:43 and 15:17 UTC. No merges to `main` during the window.

**Steps:**

1. **T-24 h:** switch the apex and `www` records to proxied, still pointing at Vercel. Run the smoke
   and check the QR apex.
2. **T0:** add Worker routes `www.celebra-me.com/*` and `celebra-me.com/*` → `celebra-me`.
3. **T+2 min:** `pnpm ops:release-status --target production --sha <sha>` must report VERIFIED.
4. **T+5 min:** manual smoke: landing, a demo, a real invitation, a fixture RSVP, login + MFA,
   editor preflight, `/vista-previa/<token>`, the QR apex, the contact form, and memories upload and
   retrieve on the canary space.
5. **Watch for 7 days.** Roll back on any of: 5xx above 1 % for 5 minutes, or any auth, QR or RSVP
   failure.

**Rollback (maximum 10 minutes):**

- **R1:** delete both routes; traffic returns to Vercel through the proxy.
- **R2:** run release-status against the Vercel SHA and repeat the smoke.
- **R3 (optional):** switch the records back to DNS-only.
- There is no data to roll back.
- Rehearse the rollback on Preview during F4.

## 9. Acceptance criteria

- [ ] **Vercel sweep.** This command returns no lines, and `pnpm validate:structure` runs
      `validateNoVercelReferences`:

  ```bash
  git grep -n -i "vercel" -- . ':!CHANGELOG.md' ':!supabase/migrations/' ':!scripts/validate-structure.mjs' ':!tests/unit/validate-structure-script.test.ts'
  ```

- [ ] **Cloudinary sweep.** This command returns no lines:

  ```bash
  git grep -n -i "cloudinary" -- . ':!CHANGELOG.md' ':!supabase/migrations/'
  ```

  Also, `pnpm invitation:media:verify` on Preview and Production reports 0 Cloudinary URLs.

- [ ] **Nothing left in dependencies or outside the repo.** No `vercel` or `cloudinary` packages in
      the lockfile. No Vercel secrets, vars or app in GitHub. The Vercel project, the Cloudinary
      account (after the grace period) and every `vercel-dns` record are gone.
- [ ] **No shims.** No dual `VERCEL_ENV`/`CELEBRA_DEPLOY_ENV` read, no dual status names, no dual
      image or storage implementations, no temporary flags.
- [ ] **Release pipeline.** Two consecutive Production releases VERIFIED through the new pipeline,
      one of them with a schema `prod:apply`.
- [ ] **Crons.** Production crons ran 3 days in a row with `source: 'scheduled_cron'` evidence.
- [ ] **Functional parity.** The memories canary and the real-phone checklist pass in Production.
      The contact email is delivered. Meta CAPI is delivered. The watermark is verified on an unpaid
      invitation.
- [ ] **Documentation.** `/privacidad` and every doc in `related_docs` describe Cloudflare only.

## 10. Reduction metrics

| Metric                         | Baseline (2026-10-10)                                                    | Target                                                                             | Command                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel matches                 | 982 lines / 177 files                                                    | 0                                                                                  | `git grep -i -c vercel -- . ':!pnpm-lock.yaml' ':!CHANGELOG.md'`                                                                     |
| Dependencies / devDependencies | 27 / 46                                                                  | 21 / 48                                                                            | `node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies).length, Object.keys(p.devDependencies).length)"` |
| Scripts                        | 137                                                                      | ≤ 137                                                                              | `node -e "console.log(Object.keys(require('./package.json').scripts).length)"`                                                       |
| Platform env names (app)       | 32                                                                       | about 18 (−10 Vercel-era, −5 Cloudinary, +`CELEBRA_DEPLOY_ENV` as a versioned var) | names per environment                                                                                                                |
| Env names read in code         | 179                                                                      | about 145                                                                          | inventory script                                                                                                                     |
| Tracked files                  | 3,295                                                                    | net decrease                                                                       | `git ls-files \| wc -l`                                                                                                              |
| TS/TSX/ASTRO/MJS/SCSS lines    | 446,181                                                                  | net decrease                                                                       | `git ls-files -z '*.ts' '*.tsx' '*.astro' '*.mjs' '*.scss' \| xargs -0 cat \| wc -l`                                                 |
| External providers             | Vercel, Cloudflare, Supabase, Cloudinary, Gmail SMTP, Zoho, Meta, Google | Cloudflare, Supabase, Zoho, Meta, Google                                           | —                                                                                                                                    |

Report lockfile package counts as measured: wrangler may add packages even though direct
dependencies go down.

## 11. Stop conditions

- Any security gate fails open in the F1 test matrix.
- F0b CPU measurements make SSR non-viable on Workers.
- Watermark parity cannot be reached (D6).
- A step would touch Production, DNS or a production Worker inside the freeze window.
- The pending migration chain is still open when F4 starts.
- Unexpected Git drift (HEAD, index or branch) in the worktree.
- An F9 dry-run count that differs from the expected number.

## 12. Current state and handoff

- **Current state (2026-10-13):**
  - **F0a done.** The spike is kept outside Git as a patch in the `cloudflare` worktree
    (`.agent/tmp/handoffs/cloudflare-spike/`, base `1715d3d6e`). It could not be committed: the
    pre-commit `test:changed` hook fails on the suites that assert the Vercel config, by design.
  - **F1 integrated** (`feat/deploy-identity` merged into `develop` as `2626d9a50` and released to
    `main`). What it changes:
    - `src/lib/server/deploy-identity.ts` is the single reader of `CELEBRA_DEPLOY_ENV`. It accepts
      exact values only, recognizes local processes positively (dev server, or a built bundle on
      Local Supabase), and throws or returns null otherwise.
    - `CELEBRA_BUILD_SHA` and `CELEBRA_BUILD_REF` come from `vite.define` and are read through
      `readBuildIdentity()` in `src/lib/environment.ts`.
    - 20 consumers migrated.
    - The dev MFA bypass now requires the Astro dev server (`import.meta.env.DEV`) and a local
      identity.
    - Storage has no local fallback for built bundles.
    - The editor classifies its database by project ref.
    - `/api/health` reports the build SHA and the hosted environment, and `ops:release-status`
      treats an environment mismatch as a mismatch.
    - `validate:structure` rejects platform identity reads, stray `CELEBRA_DEPLOY_ENV` reads and
      dynamic `getEnv('NODE_ENV')` in `src/` (`scripts/validate-deploy-identity-reads.mjs`).
  - **Correction (2026-10-11): no application decision reads `NODE_ENV`.** Vercel injects
    `NODE_ENV=development` at runtime (project env, all environments), so Production was serving
    `?debug=1` diagnostics on `/api/auth/session` and setting session and CSRF cookies without
    `Secure` (HSTS mitigated it). Cookies now carry `Secure` unless `isLocalProcess()` holds, debug
    payloads require `isLocalProcess()`, and retry logs are silenced by `isProductionDeployment()`.
    `validate:structure` rejects any `NODE_ENV === 'production'` decision in `src/`.
- **Next responsibility:**
  - `CELEBRA_DEPLOY_ENV` must stay declared in every hosted environment (`preview` for Preview,
    `production` for Production). Without it, F1 fails closed: no writes, and health reports
    `environment: null`.
  - Owner: D1 before 2026-10-15 (F0b needs Workers Paid); the remaining decisions as convenient.
  - Owner, in parallel: close the pending chain (Preview and Production migrations, PR
    fm-dev-mx/celebra-me#233) before F4.

### 12.1 F0a results

Setup:

- Packages: `@astrojs/cloudflare@14.3.4` + `wrangler@4.149.0`. `@cloudflare/vite-plugin@1.63.1`
  requires wrangler `^4.149.0`; that version also keeps a single `workerd` (1.20261006.1).
- `pnpm-workspace.yaml` needs `allowBuilds: workerd: true`.
- `pnpm add` reformats `package.json` and `pnpm-workspace.yaml`: run Prettier on both afterwards.

| Check                                                                                                                               | Result                                                                                                                                                | Consequence                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `astro build` with the adapter                                                                                                      | OK in about 25 s. Server bundle 7.4 MB uncompressed (limit 64 MiB); client 38 MB                                                                      | Size is not a risk. The Cloudinary SDK (≈870 KB chunk) and `nodemailer` (≈400 KB) inflate it until F2/F7                                                                                           |
| The adapter writes `/_astro/*` `immutable` into `_headers`                                                                          | OK                                                                                                                                                    | The `/_astro/*` cache rule needs no migration work                                                                                                                                                 |
| The adapter auto-enables a `SESSION` KV binding and an `IMAGES` binding                                                             | Observed                                                                                                                                              | Disable sessions (the app does not use `Astro.session`) so no KV namespace is provisioned                                                                                                          |
| Landing, `/privacidad`, `/login`, `/api/health`, `/api/auth/session` (401), demo SSR `/xv/demo-xv-editorial`, `robots.txt`, sitemap | OK on workerd. Warm SSR demo 9–21 ms wall time locally                                                                                                | CPU is probably above the 10 ms Free limit; F0b measures it for real                                                                                                                               |
| Dashboard pages without a session                                                                                                   | 302 to `/login`                                                                                                                                       | Middleware works on workerd                                                                                                                                                                        |
| `qrcode` SVG, `sanitize-html`, AES-256-GCM + `hkdfSync` preview token                                                               | OK                                                                                                                                                    | No change needed                                                                                                                                                                                   |
| ECDSA signing as written (`sign()` with `key: createPrivateKey(pem)`)                                                               | **FAIL**: workerd rejects a `KeyObject` in `options.key`                                                                                              | F2: pass the PEM string as `key`, or use WebCrypto `subtle.sign`. Both work on workerd and Node                                                                                                    |
| `child_process.spawn`                                                                                                               | FAIL: not implemented                                                                                                                                 | D11: delete `/dashboard/estado`                                                                                                                                                                    |
| `node:fs`                                                                                                                           | Virtual `/bundle`; `existsSync` on repo paths returns false                                                                                           | `editor-divergence` falls back to `CLEAN`; F2 makes it local-only                                                                                                                                  |
| `sharp`                                                                                                                             | **FAIL**: module missing                                                                                                                              | Every route that imports `storage-provider` (asset upload, import, list; editor publish, preflight, draft) answers **500 before auth**. F2 removes the static import; F3 replaces the runtime uses |
| `process.env`                                                                                                                       | Wrangler `vars` populate it. Literal `process.env.NODE_ENV` is fixed at build to `production`; the dynamic read via `getEnv('NODE_ENV')` is **empty** | Confirms the fail-open: `dev-mfa-bypass.ts:52` would treat Production as development. F1 is mandatory before any deployed Worker                                                                   |
| Database connectivity                                                                                                               | Not exercised. The worktree has no env files, and no database was touched on purpose                                                                  | F0b/F4 test it against Preview with a guarded `.dev.vars` and secrets                                                                                                                              |

## 13. Database strategy

### 13.1 Principle

The platform move changes **where the app runs**, not **where the data lives**.

- All four database targets stay on Supabase, under their current guards
  (`.agent/rules/database.md`).
- The server already reaches Supabase only over HTTPS `fetch` (PostgREST, Auth, Storage, RPC). No
  driver, pooler or Hyperdrive is needed.

### 13.2 Runtime-to-database mapping

| Runtime                                                | Database target                         | Identity enforcement                                                                                                                                                                 |
| ------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local `astro dev` / `astro preview` on workerd (lanes) | persistent-local (`127.0.0.1:54321`)    | `deploy-identity.ts` returns `local` only for a loopback Supabase URL. The lane bootstrap writes a gitignored `.dev.vars` from the lane env instead of mutating Node's `process.env` |
| Cloudflare Preview Worker (`env.preview`)              | Preview project                         | `CELEBRA_DEPLOY_ENV=preview` + project-ref check (`SUPABASE_PROJECT_REFS.preview`); a mismatch throws                                                                                |
| Cloudflare Production Worker                           | Production project                      | `CELEBRA_DEPLOY_ENV=production` + production project ref                                                                                                                             |
| Vercel (until F7)                                      | Same Preview and Production projects    | Same identity module, with `CELEBRA_DEPLOY_ENV` set in Vercel. No dual `VERCEL_ENV` read                                                                                             |
| Jest, pgTAP, migration CLIs, backups                   | disposable-test and the guarded targets | Run in Node; the platform move does not affect them                                                                                                                                  |

### 13.3 Operating rules during the migration

1. **Close the pending chain first.**
   - The 3 contract migrations need a Production deploy that provides
     `retired_legacy_tables_client`, and Preview `db:migrate` stays blocked until then.
   - Every later migration rides with them (engagement analytics, `invitation_access_controls`,
     `20261010180000`).
   - Finish this on Vercel, with today's evidence, before F4 changes the evidence source.
2. **No migrations from T-3 to T+7 around F6.** Both builds of the same SHA must share one schema so
   that the rollback stays a pure routing change.
3. **No contract migration between the cutover and the first trusted smoke** from `deploy.yml`.
   `prod:apply` reads the new status name only after that point.
4. **One cron runner at a time.** The crons write to the database (memories cleanup, engagement
   snapshots and anonymization).
   - Until F7, Vercel runs them in Production; Cloudflare runs them in Preview only.
   - Cloudflare takes over in Production at the moment Vercel is paused.
5. **Backups:** run `db:prod:backup:critical` before F5, before F6 and before each F9 data step. The
   daily critical backup (a local scheduled task) is not affected.
6. **External database config (Supabase Auth Site URL and Redirect URLs):** add the new Preview host
   in F4 and remove `*.vercel.app` in F7. The current list lives in the Supabase dashboard, not the
   repo; check it there.
7. **Latency.**
   - Workers run near the visitor; the database sits in one Supabase region.
   - Pages with sequential queries (publish, dashboard) may get slower than on Vercel `sfo1`.
   - F0b/F4 measure p50/p95 per route with Smart Placement off and on; enable placement only if it
     helps. The Supabase project region is unconfirmed: check it in the dashboard.
8. **Subrequests.** Workers Paid allows 10,000 per request by default (Free allows 50). In F4, count
   the Supabase and Cloudinary calls on the heaviest routes (publish, bulk import) to confirm the
   margin.
9. **Applied migrations are immutable.**
   - Three applied migrations mention Vercel in comments, and one introduces the `cloudinary`
     provider.
   - Editing them breaks the migrator's digest check (`APPLIED_VERIFICATION_FAILED`), so both sweeps
     exclude `supabase/migrations/` (§9).

### 13.4 Should the databases be redesigned during the migration?

**No schema redesign in F0–F8.** Reasons:

- The cutover and its 10-minute rollback depend on both platforms sharing one schema.
- F4 itself changes the evidence that gates contract migrations.
- The freeze window leaves no room for a second risky track.
- Changing the platform and the data model together makes any regression impossible to attribute.

**F9 holds the only required database change.** `invitation_assets.provider` only accepts
`supabase | cloudinary`
(`supabase/migrations/20260725000000_invitation_assets_cloudinary_provider.sql`). F9 runs the normal
cycle:

1. **Expand:** allow `r2` and its completeness check.
2. **Backfill:** a guarded rewrite of the asset rows and of the media URLs in published content and
   drafts. Preview first, exact counts, a backup before each step.
3. **Contract:** drop `cloudinary` from the constraint once no row and no code uses it, after a
   smoke-checked Production deploy.
4. Regenerate `release-hash-baseline.json`.

**Candidates after F9** (separate program, owner approval each):

| Candidate                                                                                                                                                      | Value                                                                                | Note                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Move the legacy `supabase`-provider assets (Supabase Storage bucket `invitation-assets`) to R2 too                                                             | One media store, one provider value, simpler Local setup (R2 local through wrangler) | Needs its own inventory of rows and objects                                                                           |
| Already-planned cleanups: engagement G7 contract (drop `/view` + `track_guest_invitation_view_public`), `valentina_*` retirement, "latest published" SQL dedup | Smaller schema                                                                       | Each keeps its own owner gate                                                                                         |
| D1, Hyperdrive or leaving Supabase                                                                                                                             | None found                                                                           | Auth, RLS, RPCs, Storage and the guarded migration tooling all depend on Supabase; a move adds risk with no reduction |

## 14. Pruning ledger

Every temporary artifact or obsolete file has an exact removal point. Each row is removed in the
named phase, after its precondition, and verified by the listed check. Nothing here is removed
earlier.

| Item                                                                                                                                                                                              | Why it exists / survives                                               | Remove in            | Precondition                                                          | Verify                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Spike branch `candidate/cloudflare-workers-spike` (adapter swap, `wrangler.jsonc`, `spike-probe.ts`)                                                                                              | Throwaway probe                                                        | After F0b            | F0b report written                                                    | `git branch --list 'candidate/cloudflare-*'` empty                    |
| `@vercel/analytics`, `@vercel/speed-insights` and their `Layout.astro` / `route-policy.ts` code                                                                                                   | Vercel-only telemetry                                                  | F2                   | Web Analytics snippet live (D5)                                       | dependency gone; Layout test                                          |
| `src/lib/platform/server/vercel-usage.ts` and the Vercel usage card                                                                                                                               | Token never configured                                                 | F2                   | —                                                                     | platform tests updated                                                |
| Upstash backend in `rate-limit-provider.ts` + 3 env names                                                                                                                                         | Never configured                                                       | F2                   | —                                                                     | rate-limit tests                                                      |
| Vercel project variable `NODE_ENV=development` (all environments)                                                                                                                                 | Injected at runtime; no app decision reads it since the F1 correction  | F2                   | D18 approved                                                          | variable absent in Vercel Preview and Production                      |
| `cloudinary` npm SDK                                                                                                                                                                              | Replaced by REST                                                       | F2                   | REST client tested                                                    | dependency gone                                                       |
| `/dashboard/estado`, `canonical-status.ts`, `observability/runtime-gate.ts`, `access.ts`                                                                                                          | Cannot run on workerd                                                  | F2                   | D11 approved                                                          | routes 404; tests removed                                             |
| `node:perf_hooks` + `X-Render-Timing*`                                                                                                                                                            | Coarse on Workers                                                      | F2                   | D19 approved                                                          | header absent                                                         |
| Static `sharp` import in `cloudinary-assets.ts`                                                                                                                                                   | Loads sharp on 7 routes                                                | F2                   | Verification moved to `scripts/`                                      | no `import "sharp"` in the server bundle                              |
| **Temporary dual build target**: `CELEBRA_BUILD_TARGET=vercel\|cloudflare` selects the adapter in `astro.config.mjs`                                                                              | `develop` deploys to Vercel and to Cloudflare Preview at the same time | F7                   | Vercel paused                                                         | `astro.config.mjs` imports only `@astrojs/cloudflare`                 |
| **Temporary dual image implementation**: `sharp` for Vercel, Images binding for Cloudflare, behind one `ImageTransformer` interface                                                               | Same reason                                                            | F7                   | Vercel paused                                                         | no `sharp` in `dependencies` (it stays in `devDependencies` for CLIs) |
| `vite.ssr.external` / `noExternal` workaround in `astro.config.mjs`                                                                                                                               | Only the Vercel build needs it                                         | F7                   | Dual build removed                                                    | config diff                                                           |
| `CELEBRA_BUILD_SHA` / `CELEBRA_BUILD_REF` fallbacks to `VERCEL_GIT_COMMIT_SHA` / `VERCEL_GIT_COMMIT_REF` in the build `define`                                                                    | Vercel builds lack `GITHUB_SHA` / `GITHUB_REF_NAME`                    | F7                   | Vercel paused                                                         | Vercel sweep                                                          |
| Vercel identity rules (`VERCEL*`, `x-vercel-id`) in `scripts/validate-deploy-identity-reads.mjs` and their fixture cases                                                                          | Guard against reading platform identity while Vercel serves            | F7                   | Vercel paused                                                         | Vercel sweep passes without excluding the guard                       |
| `vercel.json` (crons, redirect, headers, region, ignore command), `.vercelignore`                                                                                                                 | Vercel config                                                          | F7                   | Headers and redirect in middleware since F2; Cloudflare crons enabled | file absent                                                           |
| `scripts/ops/vercel-ignore-build.mjs` + test, `tests/unit/vercel-runtime-region.test.ts`                                                                                                          | Vercel build control                                                   | F7                   | Vercel paused                                                         | files absent                                                          |
| Cron HTTP routes + `CRON_SECRET` + Bearer check                                                                                                                                                   | Vercel cron calls them                                                 | F7                   | `scheduled()` active in Production (D10)                              | routes 404                                                            |
| `post-deploy-smoke.yml`, `validateVercelDispatch`, bypass headers, `*.vercel.app` allow-lists, ignored-build logic in `release-status.ts`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `VERCEL_PROJECT_ID` | Vercel evidence path                                                   | F7                   | Two Production releases VERIFIED through `deploy.yml`                 | Vercel sweep                                                          |
| `nodemailer`, `@types/nodemailer`, `GMAIL_USER`, `GMAIL_PASS`                                                                                                                                     | The Vercel runtime still sends contact mail                            | F7                   | Email Service delivering since F6 (D4)                                | dependency gone                                                       |
| Supabase Auth `*.vercel.app` redirect URLs                                                                                                                                                        | Vercel Preview logins                                                  | F7                   | Cloudflare Preview login verified                                     | dashboard check                                                       |
| `.vercel` entries in `.gitignore` and `scripts/validate-structure.mjs:97`                                                                                                                         | Guard against tracking `.vercel/`                                      | F7                   | Local `.vercel/` folders deleted in every worktree                    | `git status` clean                                                    |
| Vercel mentions in docs, `.agent/` rules and skills, `/privacidad`                                                                                                                                | Describe the old platform                                              | F7                   | —                                                                     | Vercel sweep                                                          |
| Vercel project, GitHub Vercel app, `vercel-dns` records                                                                                                                                           | External                                                               | F7 (owner)           | Soak finished                                                         | §9 external checklist                                                 |
| Cloudinary REST client, `cloudinary-assets.ts`, `cloudinary-usage.ts`, 5 `CLOUDINARY_*` names, `remotePatterns` entry, provisioning adapters                                                      | Media still on Cloudinary                                              | F9                   | R2 backfill verified; contract applied                                | Cloudinary sweep                                                      |
| Cloudinary account                                                                                                                                                                                | Cached chat previews                                                   | F9 + 30 days (owner) | —                                                                     | account closed                                                        |
| `cloudflare` worktree and its Win + F9 AutoHotkey entry                                                                                                                                           | Migration workspace                                                    | After F9             | Plan closed                                                           | owner removes them (agents never run `git worktree remove`)           |
| This plan                                                                                                                                                                                         | Operational intent                                                     | After F9             | Durable knowledge moved to `docs/`                                    | file deleted (Git history keeps it)                                   |

**Guard:** F7 adds `validateNoVercelReferences` to `scripts/validate-structure.mjs`, and F9 adds the
Cloudinary rule. From then on, CI fails if any pruned item comes back.

## 15. Sources (official, consulted 2026-10-10)

- Astro adapter: https://docs.astro.build/en/guides/integrations-guide/cloudflare/ ·
  https://www.npmjs.com/package/@astrojs/cloudflare
- Workers limits and pricing: https://developers.cloudflare.com/workers/platform/limits/ ·
  https://developers.cloudflare.com/workers/platform/pricing/
- Node.js compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Images binding and pricing: https://developers.cloudflare.com/images/optimization/binding/ ·
  https://developers.cloudflare.com/images/pricing/
- R2 pricing: https://developers.cloudflare.com/r2/pricing/ (re-check before F9)
- Email Service: https://developers.cloudflare.com/email-service/platform/pricing/
- Rate limiting: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Static assets headers: https://developers.cloudflare.com/workers/static-assets/headers/
- Rollbacks: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- Access service tokens:
  https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/
- DNS full setup: https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/
- Custom Domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Vercel Hobby terms: https://vercel.com/docs/limits/fair-use-guidelines
