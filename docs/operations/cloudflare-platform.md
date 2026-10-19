# Cloudflare Platform

Standing rules, external configuration and design decisions of the Cloudflare Workers platform that
serves Celebra-me. It keeps what is still true after the hosting migration; the dated migration
runbooks are in Git history.

Related owners: runtime and server boundaries in
[`../core/architecture.md`](../core/architecture.md), environment names in
[`../env-workflow.md`](../env-workflow.md), database rules in
[`../database-workflow.md`](../database-workflow.md), release gates in
[`../core/release-execution.md`](../core/release-execution.md).

## 1. Topology

| Piece                                       | Role                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `celebra-me` Worker (`env.production`)      | Serves `www.celebra-me.com/*` and `celebra-me.com/*` through two zone routes                           |
| `celebra-me-preview` Worker (`env.preview`) | Serves the Preview host built from `develop`, behind Cloudflare Access                                 |
| `celebra-memories-sign`                     | Public upload gateway (`workers_dev` stays on: browsers upload to its host)                            |
| `celebra-memories-retrieve`                 | Private retrieval; no `workers_dev` host, reached only through the `MEMORIES_RETRIEVE` Service Binding |
| Staging pair of the two memories Workers    | Used by the Preview Worker; the Sign staging Worker shares the `workers.dev` subdomain                 |

The memories Workers stay separate from the app Worker. Account-wide Cloudflare Access on the
Workers page must stay off: it would lock the memories Workers, which are called server to server.

Plan and cost: Workers Paid on the account ($5 per month); the zone stays on the Free plan. The Free
Workers plan fails any SSR request above 10 ms of CPU, so Paid is mandatory for SSR.

## 2. Invariants

- **Printed QR continuity.** `https://celebra-me.com/r/<slug>` keeps working at every step of any
  routing, DNS or hosting change. The apex answers `307` to `https://www.celebra-me.com` with path
  and query preserved. Keep `307`.
- **Fail-closed security gates.** Every gate (MFA bypasses, local-only observability, mutations,
  cookie `Secure`, `?debug=1` payloads, storage selection) must fail closed when the deploy identity
  is missing or invalid. `CELEBRA_DEPLOY_ENV` (`preview` or `production`) must be declared in every
  hosted environment; without it nothing writes and `/api/health` reports `environment: null`. Only
  `src/lib/server/deploy-identity.ts` reads it (`validate:structure` enforces this), and no
  application decision reads `NODE_ENV`. Prove each gate with tests before a Worker serves traffic.
- **One schema for two builds.** Whenever two builds of the same SHA can serve the same database (a
  routing change, a rollback), no migration runs around the change, and no contract migration runs
  between a change of host and the first trusted smoke from the new pipeline. This keeps a rollback
  a pure routing change.
- **One cron runner at a time.** The daily jobs write to the database; exactly one platform may run
  them.
- **Secrets by name.** Verify secrets by name (`wrangler secret list --env <name>`), never by value.

## 3. Delivery

- **Deploy through GitHub Actions and wrangler.** `deploy.yml` (Preview, every push to `develop`)
  and `deploy-production.yml` (manual, from `main`) build, run `wrangler versions upload` tagged
  with the commit SHA, smoke the version URL behind Access, and write the GitHub Deployment and
  commit status that `pnpm ops:release-status` and the contract-migration attestation read. The API
  token is a repository secret scoped to Workers Scripts and Access only. Variable names are in
  [`../env-workflow.md`](../env-workflow.md).
- **Production upload never routes traffic.** `env.production` has no routes and no `workers.dev`
  host. Activation is
  `wrangler versions deploy <version-id>@100% --config wrangler.jsonc --env production --yes` after
  the owner approves the release (steps in section 8). Never run `wrangler deploy` on Production,
  because it also applies routes and triggers. Always pass `--config wrangler.jsonc`, otherwise a
  stale `.wrangler/deploy/config.json` can select the wrong configuration.
- **Access.** Preview protection is a self-hosted Access application on the Preview host with two
  policies (a service token and the owner). Production uses Access on version URLs only ("Previews
  only"), allowing account members and the smoke service token; never "All traffic", which would
  lock the zone routes. The smoke fails when a version URL answers without the token.
- **Cron Triggers are non-versioned.** `wrangler versions upload`, `versions deploy` and
  `secret bulk` never apply them. Production schedules are `17 15 * * *` (memories cleanup) and
  `43 10 * * *` (engagement maintenance), UTC, declared in `wrangler.jsonc`. Jobs run only through
  the Worker `scheduled()` handler (`src/worker.ts` → `src/lib/server/scheduled-jobs.ts`); there are
  no HTTP cron routes and no `CRON_SECRET`.
- **Rate limiting uses `ratelimits` bindings**, one `RATE_LIMIT_*` binding per
  `(namespace, maxHits, windowSec)` pair that `src/lib/rsvp/security/rate-limit-provider.ts` uses.
  The public namespaces are `auth`, `rsvp`, `rsvp-public`, `engagement`, `memories`, `tracking` and
  `dashboard`; every administration scope of `admin-rate-limit.ts` is limited through a binding as
  well. Preview uses namespace ids 2001-2099. There is no external rate-limit backend.
- **Sessions are disabled** (Astro `session: false`): the app does not use `Astro.session`, and no
  KV namespace is provisioned.
- **Memories Service Binding.** The app reaches `celebra-memories-retrieve` through
  `MEMORIES_RETRIEVE` (`src/lib/memories/server/worker-bindings.ts`), with a fallback to the origin
  only where no binding exists (local development).
- **Analytics.** Cloudflare Web Analytics (cookieless, no consent prompt) through
  `PUBLIC_CF_WEB_ANALYTICS_TOKEN`. GA4 stays behind the consent banner; first-party tracking
  (`tracking_events`, engagement) is unaffected.
- **Contact.** The landing page offers a WhatsApp button only; there is no contact form, mailer or
  outbound email service.

## 4. Code rules on workerd

| Constraint                 | Rule                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bindings                   | Read with `import { env } from 'cloudflare:workers'`; Astro 7 has no `Astro.locals.runtime.env`                                                                 |
| `process.env`              | Populated from Wrangler `vars` and secrets; read through `getEnv()` only, never at module scope                                                                 |
| `NODE_ENV`                 | Literal reads are fixed at build time and dynamic reads are empty; never decide on it                                                                           |
| `child_process`, real `fs` | Not available; local-only tooling (status CLI, editor divergence) stays out of Worker routes                                                                    |
| `sharp`                    | Not available at runtime; pixel work (re-encoding) uses the Images binding                                                                                      |
| Images binding             | The local emulator does not reproduce every transform; only a deployed check counts                                                                             |
| Post-response work         | Use `runAfterResponse()` (`waitUntil`); never fire-and-forget                                                                                                   |
| Client IP and origin       | `getClientIp()` reads `CF-Connecting-IP`; do not trust `x-forwarded-*` for security decisions                                                                   |
| Memories ECDSA signing     | Pass the PEM string (or WebCrypto) to `sign()`; workerd rejects a `KeyObject` in `options.key`                                                                  |
| Headers and redirects      | Security headers and the legacy `301` redirects live in middleware (parity with `public/_headers`); `/_astro/*` is `immutable` through the adapter's `_headers` |

Prerendered pages never invoke the Worker (Workers Assets serves them with 0 CPU), so moving a
static page to `prerender` is free of CPU.

## 5. Operating notes

- **Latency is wall time, not CPU.** Each Supabase round trip from a US colo costs about 100 ms. The
  heaviest SSR route (a demo invitation) measured 18 ms CPU p50 / 51 ms p95 warm but 206 ms wall
  p50, dominated by its two Supabase subrequests. Pages with sequential queries (publish, dashboard)
  are the ones that feel slow; fix them by removing sequential queries.
- **Cold isolates** add 30-60 ms of CPU to the first requests after a deploy. No action.
- **Smart Placement stays off.** It needs traffic history before it relocates a Worker. Re-measure
  only on the Preview Worker after at least 24 hours of traffic, judging by the wall p95 of a demo
  and of a dashboard page with a session.
- **Measure with GraphQL, attribute with logs.** Short-window Workers Logs lose 10-35 % of
  invocations; take p-quantiles from the `workersInvocationsAdaptive` dataset and use logs only for
  per-route attribution.
- **Subrequests.** Workers Paid allows 1,000 per request (Free allows 50). Measured: editor publish
  uses 14 fixed (14-19 with optional adders), bulk guest import 4 fixed (4-8 with adders), none per
  asset or per row. Recount after adding Supabase calls to those routes.
- **Bundle.** About 7 MB raw / 1.6 MB gzip at the last measurement (Paid limit 10 MiB gzip), startup
  under 30 ms. Large server chunks are the first thing to inspect if the limit ever matters.

## 6. External configuration

| Area             | Fact                                                                                                                                                                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registrar        | Namecheap; the domain is not transferred. DNS is served by the Cloudflare zone through the two nameservers shown in the zone overview                                                                                                                                                                                                  |
| Apex and `www`   | Proxied records. The apex redirect is `307` to `www` (section 2). SSL mode Full (strict); the edge certificate covers the apex and `www`                                                                                                                                                                                               |
| Mail             | Zoho: MX x3, SPF, DKIM `zmail._domainkey`, DMARC `p=none`. All mail and verification TXT records (Google, Facebook, OpenAI, Zoho) stay DNS-only (grey cloud)                                                                                                                                                                           |
| DNSSEC           | Enabled when the registrar shows a DS record to match                                                                                                                                                                                                                                                                                  |
| AI Crawl Control | Training = Allow with the per-crawler blocks active (15 crawlers), Search = Allow, Agent = Allow, Bot Preference Sync off, Bot Fight Mode off. Training = Block also blocks Googlebot, so do not use it. The origin `robots.txt` (`src/lib/seo/robots-policy.ts`) must stay the only one served: no Cloudflare-managed block prepended |
| Link previews    | WhatsApp, Facebook Messenger and Telegram crawlers must still render a real invitation card after any zone security change; a bot block breaks them silently                                                                                                                                                                           |
| Supabase Auth    | Site URL and Redirect URLs live in the Supabase dashboard, not in the repository. They list the Production host(s) and the Preview host, and no host of the previous platform                                                                                                                                                          |
| Media            | One R2 bucket per environment with hash-versioned object keys (URLs stay immutable), public delivery through an R2 custom domain on the zone, social crops through the Images binding. WhatsApp and Facebook cache link previews per URL, so never retire a media host while cached cards may point at it                              |
| Backups          | Run `pnpm db:prod:backup:critical` before any DNS or routing change and before every media data step                                                                                                                                                                                                                                   |
| Account tokens   | `MEMORIES_CLOUDFLARE_*` read-only analytics names are separate from the deploy token so Wrangler never mistakes one for the other                                                                                                                                                                                                      |

## 7. Verification practice for hosting changes

- **Visual.** Before and after any change that can alter rendering, capture full-page desktop and
  mobile views of the live route list and compare them
  ([`remote-visual-compare.md`](remote-visual-compare.md)). Acceptance: at most 0.5 % changed pixels
  outside photos and no missing or moved image; review about six grouped, cropped cases, never every
  capture.
- **Data.** Take an integrity snapshot before and after (`pnpm db:integrity:snapshot`). Counts never
  shrink, and rows created before the snapshot keep their hash unless an audited guest action
  changed them.
- **Smoke.** `pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com` after any change
  that touches routing, plus `pnpm ops:release-status --target production --sha <sha>`.
- **Manual.** On a real phone: a real invitation, a demo, the QR apex, a fixture RSVP, login with
  MFA, an editor photo upload, `/robots.txt` unchanged and one chat link preview.

## 8. Activate an uploaded version (every Production release)

The upload workflow only uploads and smokes a version; it never sends traffic to it. Activation is a
separate step, run by the agent after the owner approves the release.

1. Take the version ID from the workflow run log (`Worker Version ID: …`), or list the versions and
   pick the one tagged with the release SHA:
   `pnpm exec wrangler versions list --config wrangler.jsonc --env production`.
2. Activate it at 100 %:
   `pnpm exec wrangler versions deploy <version-id>@100% --config wrangler.jsonc --env production --yes`.
3. Confirm the active deployment shows that version at 100 %:
   `pnpm exec wrangler deployments status --config wrangler.jsonc --env production`.
4. Confirm the domain serves it: `curl -s https://www.celebra-me.com/api/health` reports
   `build.commitSha` equal to the release SHA and environment `production`.
5. Run the domain smoke on GitHub so it becomes release evidence: dispatch the upload workflow again
   from `main` with step `domain-smoke`
   (`gh workflow run deploy-production.yml --ref main -f step=domain-smoke`). It waits until the
   domain reports the release SHA, runs
   `pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com` and publishes the commit
   status `Cloudflare - celebra-me production smoke` on that SHA.
6. Confirm the release: `pnpm ops:release-status -- --sha <sha> --target production --wait` reports
   VERIFIED. It requires `Repository Policy`, `Application Suite` and `Application / static` on the
   main SHA (Repository CI runs on every `main` push), that smoke status, and the public alias
   reporting the SHA in `production`. It reads no GitHub deployment record for Production.

**Rollback:** run the same steps with the previous version ID. Never run a migration during a
rollback. There is no data to roll back: every version serves the same schema (section 2).

## 9. Applied migrations

Applied migrations are immutable: editing one breaks the migrator digest check
(`APPLIED_VERIFICATION_FAILED`). Retired-provider guards therefore exclude `supabase/migrations/`
and `supabase/tests/`. See [`../database-workflow.md`](../database-workflow.md).

## 10. Links

- Cloudflare dashboard: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692
- Production Worker settings:
  https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/workers/services/view/celebra-me/production/settings
- Memories sign Worker settings:
  https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/workers/services/view/celebra-memories-sign/production/settings
- Memories retrieve Worker settings:
  https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/workers/services/view/celebra-memories-retrieve/production/settings
- Zone DNS: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com/dns/records
- Zone Worker routes:
  https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com/workers/routes
- Zone SSL: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com/ssl-tls
- AI Crawl Control: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com/ai
- Zero Trust Access applications:
  https://one.dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/access/apps
- Cloudflare Production upload workflow:
  https://github.com/fm-dev-mx/celebra-me/actions/workflows/deploy-production.yml
- GitHub environments: https://github.com/fm-dev-mx/celebra-me/settings/environments
- Supabase Production Auth URLs:
  https://supabase.com/dashboard/project/ineitkdkyrxqyressllp/auth/url-configuration
