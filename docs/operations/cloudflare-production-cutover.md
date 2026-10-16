# Production cutover runbook: Vercel to Cloudflare Workers

Audience: a junior operator. Prepared 2026-10-15 from
`.agent/plans/active/cloudflare-workers-migration.md`, `wrangler.jsonc`,
`.github/workflows/deploy.yml`, `.github/workflows/deploy-production.yml`, `package.json`,
`scripts/ops/*`.

Legend: **TO BUILD** = does not exist in the repo yet. Do not invent a command; build it first.
`$ACCT` = `05cb212a366549f0f93e7101c4ca3692`. `$SHA` = the 40-hex candidate commit on `main`. Owner
= project owner. Agent = coding-agent session. On Windows run `pnpm` through Git Bash. All times are
America/Mazatlan (UTC-7 all year; Sinaloa has no daylight saving time since 2022).

Links

- Cloudflare dashboard: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692
- Workers: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/workers-and-pages
- Production Worker settings:
  https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/workers/services/view/celebra-me/production/settings
- Zone DNS: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com/dns/records
- Zone Worker routes:
  https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com/workers/routes
- Zone SSL: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com/ssl-tls
- AI Crawl Control: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com/ai
- Zero Trust Access applications:
  https://one.dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/access/apps
- Vercel project: https://vercel.com/francisco-mendoza-s-projects/celebra-me
- GitHub Actions: https://github.com/fm-dev-mx/celebra-me/actions
- Cloudflare Production upload workflow:
  https://github.com/fm-dev-mx/celebra-me/actions/workflows/deploy-production.yml
- GitHub environments: https://github.com/fm-dev-mx/celebra-me/settings/environments
- Supabase Production Auth URLs:
  https://supabase.com/dashboard/project/ineitkdkyrxqyressllp/auth/url-configuration

## 1. Timing (decided by the owner on 2026-10-15)

- **Cutover T0 = Monday 2026-10-19 02:00 Mazatlan = 09:00 UTC.** The window closes at **03:40**
  (10:40 UTC), three minutes before the 10:43 UTC Vercel cron. A rollback must start by **03:30** so
  it ends inside the window.
- The next Vercel cron is 15:17 UTC (08:17 Mazatlan); no step runs within 10 minutes of 03:43 or
  08:17.
- Crons keep running on Vercel until Vercel retirement, so the cron times matter only as a rule of
  thumb; they must not collide with the routing change.
- Freeze: **no migrations from Friday 2026-10-16 02:00 to Monday 2026-10-26 02:00**. **Saturday
  2026-10-17: no Production changes at all** (read-only checks only).

## 2. Timeline

| When (Mazatlan)                                | UTC       | Step                                                                                                                                            | Who           |
| ---------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Wed 2026-10-14 20:59 (done)                    | Thu 03:59 | Name servers changed to Cloudflare (section 5)                                                                                                  | Owner         |
| Thu 2026-10-15                                 | --        | Record the zone Active time; finish section 5 checks                                                                                            | Owner + Agent |
| Fri 2026-10-16 02:00                           | 09:00     | Migration freeze starts                                                                                                                         | --            |
| Thu 2026-10-15, after v0.27 is on `main`       | --        | Merge the Cloudflare Images change (PR #260) to `develop`; test a photo upload and `/vista-previa` on the Preview Worker                        | Owner + Agent |
| Fri 2026-10-16 morning                         | --        | Release that change to `main`; Vercel Production VERIFIED; its SHA becomes `$SHA`                                                               | Owner + Agent |
| Fri 2026-10-16, after that release is VERIFIED | --        | Production Worker setup (section 3.1) and preconditions (section 3)                                                                             | Owner + Agent |
| Sat 2026-10-17                                 | --        | No Production changes; read-only checks of records, mail, certificate                                                                           | Agent         |
| Sun 2026-10-18 (T-1 d) 10:00                   | 17:00     | Production backup, AI crawler policy                                                                                                            | Owner + Agent |
| Sun 2026-10-18 10:30                           | 17:30     | Proxy apex and www (still pointing at Vercel); smoke; link previews                                                                             | Owner + Agent |
| Mon 2026-10-19 (T0) 01:00                      | 08:00     | Preconditions re-check, go/no-go (section 4)                                                                                                    | Owner + Agent |
| Mon 2026-10-19 01:45                           | 08:45     | Final backup                                                                                                                                    | Agent         |
| Mon 2026-10-19 02:00                           | 09:00     | Add the two Worker routes (cutover)                                                                                                             | Owner         |
| 02:02                                          | 09:02     | Release status check                                                                                                                            | Agent         |
| 02:05                                          | 09:05     | Manual smoke checklist                                                                                                                          | Owner         |
| 02:30                                          | 09:30     | Declare success or roll back                                                                                                                    | Owner         |
| 03:30                                          | 10:30     | Latest rollback start                                                                                                                           | Owner         |
| 03:40                                          | 10:40     | Window closes                                                                                                                                   | --            |
| Tue 2026-10-20 .. Mon 2026-10-26 (T+1 .. T+7)  | --        | Daily watch (section 8)                                                                                                                         | Owner + Agent |
| Mon 2026-10-26 02:00                           | 09:00     | Migration freeze ends                                                                                                                           | --            |
| Mon 2026-10-26 onward (T+7)                    | --        | Vercel retirement decision (separate runbook); pausing Vercel and enabling crons not before 2026-11-08 (client freeze 2026-10-23 to 2026-11-07) | Owner         |

Note on "zone active 72 h": the plan requires the zone active at least 72 hours before cutover, so
activation must be at or before Friday 2026-10-16 02:00 (09:00 UTC). The registry shows the name
server change on 2026-10-15 03:59 UTC (Wednesday 2026-10-14 20:59 Mazatlan), and public resolvers
(1.1.1.1, 8.8.8.8) returned `elma.ns.cloudflare.com` and `finley.ns.cloudflare.com` on Thursday
2026-10-15. Record the exact Active time from the zone overview in the evidence log; any time before
Friday 02:00 meets the rule.

## 3. Preconditions checklist (Friday 2026-10-16 to T-1 hour)

Tick each; paste the evidence into the handoff.

- [ ] Migration chain closed: no pending migrations, no contract planned before Monday 2026-10-26.
      Check: `pnpm release-check` (read-only; expected: no pending migration reported).
- [ ] No migrations from Friday 2026-10-16 02:00 to Monday 2026-10-26 02:00, and no merge to `main`
      after the candidate `$SHA` is uploaded (freeze). No Production change on Saturday 2026-10-17.
- [ ] Candidate `$SHA` (the v0.27 release on `main`) is live on Vercel Production and its smoke is
      green: `pnpm ops:release-status --target production --sha $SHA` -> state VERIFIED.
- [ ] Production Worker `celebra-me` has the candidate version uploaded, with no routes:
      `env.production` in `wrangler.jsonc` (built) has no routes, no `workers.dev` host and
      `triggers.crons: []`. Evidence: a green run of the Cloudflare Production upload workflow for
      `$SHA`, and Workers > celebra-me > Settings > Domains & Routes lists no route.
- [ ] Candidate `$SHA` includes the Cloudflare Images change (PR #260). Without it the Worker has no
      image path: photo uploads (`asset-policy.ts`) and `/vista-previa` images
      (`preview-media-renderer.ts`) load native `sharp`, which does not exist on Workers, and fail.
      Evidence: a photo upload and a `/vista-previa` image work on the Preview Worker for a
      `develop` commit with that change, and on the Production version URL for `$SHA`. If the change
      is not on `main` by Sunday 2026-10-18 12:00, move the cutover.
- [ ] Commit status `Cloudflare - celebra-me production candidate smoke` is success on `$SHA`. This
      context proves the uploaded version only; no release gate reads it.
- [ ] Production secrets set by name (never values):
      `pnpm exec wrangler secret list --env production` -> every name of
      `CLOUDFLARE_WORKER_SECRET_NAMES.production` in `scripts/ops/cloudflare-worker-secrets.ts`.
- [ ] Version URL behind Access: `/api/health` returns `build.commitSha == $SHA` and environment
      `production` with the service token, and does not return 200 without it (the smoke checks
      both).
- [ ] Zone Active, edge certificate covers apex and `www`, SSL mode Full (strict) (Zone SSL link).
- [ ] Production Cron Triggers disabled on the Worker (Workers > celebra-me > Settings > Triggers
      shows none). Crons stay on Vercel.
- [ ] Supabase Auth redirect URLs include the production host(s) (Supabase link above).
- [ ] DNS records copied DNS-only: Zoho MX x3, SPF, DKIM `zmail._domainkey`, DMARC, TXT
      verifications.
- [ ] Rollback rehearsed on Preview (route add/delete takes < 2 min). **TO BUILD**: the rehearsal
      record.
- [ ] Observability on: Workers logs + alerts. **TO BUILD**: Cloudflare notification for Worker
      error rate and an external uptime alert (the repo has
      `.github/workflows/production-uptime.yml`, every 15 min,
      `pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com`; keep it running).

### 3.1 Production Worker setup (Friday 2026-10-16, after v0.27 is VERIFIED)

Order matters: the Worker exists only after the first workflow run, and the smoke passes only once
Access and the secrets are in place. None of these steps routes traffic.

| Step                                                                                                                                                                                                                                                                                                                        | Who   | Command or URL                                                                                    | Confirms with                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 3.1.1 Create the GitHub environment `Cloudflare Production` (deployment branches: `main` only) with secret `PRODUCTION_PUBLIC_SUPABASE_ANON_KEY` and variables `PRODUCTION_PUBLIC_GA_MEASUREMENT_ID`, `PRODUCTION_PUBLIC_META_PIXEL_ID`, `PRODUCTION_PUBLIC_META_PIXEL_ENABLED`, `PRODUCTION_PUBLIC_CF_WEB_ANALYTICS_TOKEN` | Owner | GitHub environments link                                                                          | names listed in the environment                                                  |
| 3.1.2 First run of the upload workflow from `main`: creates the Worker and uploads `$SHA`. Its smoke is expected to fail (no Access, no secrets yet)                                                                                                                                                                        | Owner | Upload workflow link > Run workflow > `main`                                                      | steps up to "Upload Worker version" green; Worker `celebra-me` listed in Workers |
| 3.1.3 Turn on Cloudflare Access for Preview URLs and allow the existing smoke service token (Service Auth, same token as the Preview app)                                                                                                                                                                                   | Owner | Production Worker settings > Domains & Routes > Preview URLs > Enable Cloudflare Access > Manage  | the app appears in Zero Trust Access applications; version URL asks for sign-in  |
| 3.1.4 Upload the Worker secrets from a one-off file outside the repository, then delete the file                                                                                                                                                                                                                            | Owner | `pnpm ops:cloudflare:production:secrets -- --env-file <path> --dry-run`, then without `--dry-run` | `pnpm exec wrangler secret list --env production` lists every name               |
| 3.1.5 Second run of the upload workflow from `main`                                                                                                                                                                                                                                                                         | Owner | Upload workflow link                                                                              | run green; status `Cloudflare - celebra-me production candidate smoke` = success |

If 3.1.2 fails at "Create the Worker on the first run" with an authorization error, the repository
`CLOUDFLARE_API_TOKEN` cannot create Workers: stop and ask the owner for that token permission.

## 4. Go / no-go list (T0 minus 15 minutes; any NO = stop)

| #   | Question                                                                                                                                                                                                  | Evidence                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | All section 3 boxes ticked                                                                                                                                                                                | handoff                                                   |
| 2   | `release-status` VERIFIED for `$SHA` on Vercel                                                                                                                                                            | command output                                            |
| 3   | Version URL health shows `$SHA` and `production`                                                                                                                                                          | `curl` with Access headers                                |
| 4   | Fresh critical backup done today                                                                                                                                                                          | `pnpm db:prod:backup:critical` finished OK                |
| 5   | Supabase and Cloudflare status pages green                                                                                                                                                                | status pages                                              |
| 6   | Owner awake, rollback steps open in a second window                                                                                                                                                       | owner                                                     |
| 7   | No deploy, merge, migration or DNS edit in the last 24 h except planned ones                                                                                                                              | GitHub, Vercel                                            |
| 8   | Time is not within 10 minutes of 03:43 or 08:17 Mazatlan                                                                                                                                                  | clock                                                     |
| 9   | `$SHA` includes PR #260 and the `/vista-previa` static-asset fix; on its version URL a photo upload works and an unpaid test invitation's watermarked photo answers `200` with `content-type: image/webp` | `curl -sI` with Access headers on `/vista-previa/<token>` |

## 5. Name server change (done Wednesday 2026-10-14 20:59 Mazatlan)

Name servers changed and public DNS answers from Cloudflare. Zoho MX x3, the DKIM `zmail._domainkey`
and DMARC records resolve; apex and `www` are still served by Vercel (DNS-only). Steps 5.5 to 5.9
still need their evidence.

| Step                                                                                                                                                                      | Who   | Command or URL                                                              | Confirms with                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 5.1 Lower TTL to 300 s at Namecheap as early as possible                                                                                                                  | Owner | https://ap.www.namecheap.com (Advanced DNS)                                 | `nslookup -type=A celebra-me.com pdns1.registrar-servers.com` shows TTL <= 300 |
| 5.2 Add the zone `celebra-me.com` (Free plan), copy every record, set Zoho and TXT records DNS-only (grey cloud); apex and `www` stay DNS-only pointing at Vercel for now | Owner | Zone DNS link                                                               | record list equals the Namecheap list from the plan evidence                   |
| 5.3 Backup before NS change                                                                                                                                               | Agent | `pnpm db:prod:backup:critical`                                              | backup finished OK                                                             |
| 5.4 Change NS at Namecheap to the two Cloudflare names shown in the zone overview                                                                                         | Owner | Namecheap Domain List > Manage > Nameservers > Custom DNS                   | `nslookup -type=NS celebra-me.com` shows Cloudflare names                      |
| 5.5 Wait for "Active"                                                                                                                                                     | Owner | https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com | green Active banner; note time (must be before Friday 02:00)                   |
| 5.6 Enable DNSSEC if the registrar shows no DS, then add DS at Namecheap                                                                                                  | Owner | Zone DNS > DNSSEC                                                           | DS status "active"                                                             |
| 5.7 Zoho mail in and out                                                                                                                                                  | Owner | send both ways                                                              | received both ways                                                             |
| 5.8 Apex redirect 307 (www vs apex behavior as before)                                                                                                                    | Agent | `curl -sI https://celebra-me.com/ \| head -3`                               | `307` with the same `Location` as before                                       |
| 5.9 Edge certificate Active, mode Full (strict)                                                                                                                           | Owner | Zone SSL link                                                               | "Active" for apex and `*.celebra-me.com` or `www`                              |

Rollback of this step: restore the Namecheap nameservers (Namecheap Default DNS); allow up to the
TTL.

## 6. Day before cutover (Sunday 2026-10-18)

| Step                                                                                                                | Who   | Command or URL                                                        | Confirms with                                                             |
| ------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 6.1 Backup                                                                                                          | Agent | `pnpm db:prod:backup:critical`                                        | OK, file listed                                                           |
| 6.2 AI crawler policy: Training = block, Search = allow, Agent = allow, Bot Preference Sync off, Bot Fight Mode off | Owner | AI Crawl Control link                                                 | screenshot of the settings                                                |
| 6.3 Switch `celebra-me.com` and `www` records to Proxied (orange), still pointing at Vercel                         | Owner | Zone DNS link                                                         | `curl -sI https://www.celebra-me.com/ \| grep -i cf-ray` returns a header |
| 6.4 Smoke through the proxy                                                                                         | Agent | `pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com` | all checks pass                                                           |
| 6.5 `/robots.txt` equals the build output                                                                           | Agent | `curl -s https://www.celebra-me.com/robots.txt` vs the generated file | identical, no Cloudflare-managed block prepended                          |
| 6.6 QR apex works                                                                                                   | Owner | open a real QR link on a phone                                        | invitation opens                                                          |
| 6.7 Link previews of a real invitation in WhatsApp, Facebook Messenger, Telegram                                    | Owner | share the link in each                                                | preview card with image renders in all three                              |

If 6.7 fails, stop: a bot block on the zone is the usual cause. Fix before continuing.

## 7. Cutover (T0, Monday 2026-10-19 02:00 Mazatlan = 09:00 UTC)

| Time      | Step                                                    | Who           | Command or URL                                                                    | Expected                                                                                                                                |
| --------- | ------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| T-60 min  | Re-run section 3 checks and section 4                   | Owner + Agent | see sections                                                                      | all YES                                                                                                                                 |
| T-15 min  | Final backup                                            | Agent         | `pnpm db:prod:backup:critical`                                                    | OK                                                                                                                                      |
| T0        | Add route `www.celebra-me.com/*` -> Worker `celebra-me` | Owner         | Zone Worker routes link (or Workers > celebra-me > Settings > Domains and Routes) | route listed                                                                                                                            |
| T0 + 30 s | Add route `celebra-me.com/*` -> Worker `celebra-me`     | Owner         | same                                                                              | route listed                                                                                                                            |
| T+1 min   | Check the stable host serves the new build              | Agent         | `curl -s https://www.celebra-me.com/api/health`                                   | JSON `build.commitSha == $SHA`, environment `production`, and no `x-vercel-id` header                                                   |
| T+2 min   | Release status                                          | Agent         | `pnpm ops:release-status --target production --sha $SHA`                          | VERIFIED. The Vercel deployment of the same `$SHA` carries the deployment evidence; live health on the domain now comes from the Worker |
| T+5 min   | Manual smoke                                            | Owner         | see checklist below                                                               | all pass                                                                                                                                |
| T+30 min  | Decision                                                | Owner         | --                                                                                | success, or roll back (start no later than 03:30)                                                                                       |

Manual smoke checklist (production, real phone for items 4, 6, 8):

1. Landing page loads.
2. A demo invitation loads.
3. A real invitation loads (and the paid watermark is absent; an unpaid invitation shows it).
4. RSVP with a fixture guest.
5. Login plus MFA.
6. Editor preflight.
7. `/vista-previa/<token>` opens and its photos and social card image load.
8. QR apex.
9. Contact form email arrives.
10. Memories upload and retrieve on the canary space.
11. `/robots.txt` unchanged.
12. One chat link preview of a real invitation.
13. A photo upload in the editor succeeds.

## 8. Watch period (Tuesday 2026-10-20 to Monday 2026-10-26)

| Day                  | Who   | Check                                                          | Pass                                                 |
| -------------------- | ----- | -------------------------------------------------------------- | ---------------------------------------------------- |
| Daily 09:00 Mazatlan | Agent | Cloudflare Workers > celebra-me > Metrics: error rate, CPU p95 | 5xx below 1 %, CPU within the measured Preview range |
| Daily                | Agent | GitHub Actions > Production Uptime                             | no alert issue open                                  |
| Daily                | Owner | RSVP and login on a real phone                                 | works                                                |
| T+1                  | Agent | `curl -s https://www.celebra-me.com/api/health`                | still `$SHA`                                         |
| T+7 (Mon 10-26)      | Owner | Go decision for Vercel retirement                              | all clean for 7 days                                 |

Crons: remain on Vercel during this whole period (one cron runner at a time). Production Cron
Triggers are enabled only at the moment Vercel is paused. The client freeze from 2026-10-23 to
2026-11-07 (event on 2026-10-30) allows no planned Production, DNS or Worker change; a rollback
under section 9 is the only exception.

## 9. Rollback (maximum 10 minutes)

Trigger (any one): 5xx above 1 % for 5 minutes (Workers > celebra-me > Metrics, or Production Uptime
alert), or any failure of login, QR or RSVP, or `/api/health` not reporting `$SHA` and `production`.
Owner decides; the agent only prepares commands. Never run a migration during rollback; the schema
is shared by both builds by design. On cutover night, start no later than 03:30.

| #            | Step                                                       | Budget                         | Command or URL                                                        | Confirms with                                      |
| ------------ | ---------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------- |
| 1            | Announce rollback in the log with the time and the symptom | 0:30                           | --                                                                    | note                                               |
| 2            | Delete route `www.celebra-me.com/*`                        | 1:30                           | Zone Worker routes link > Delete                                      | route gone                                         |
| 3            | Delete route `celebra-me.com/*`                            | 1:30                           | same                                                                  | route gone                                         |
| 4            | Check Vercel serves again                                  | 1:00                           | `curl -sI https://www.celebra-me.com/ \| grep -i x-vercel-id`         | header present; `/api/health` shows the Vercel SHA |
| 5            | Release status on the Vercel SHA                           | 2:00                           | `pnpm ops:release-status --target production --sha <vercel_sha>`      | VERIFIED                                           |
| 6            | Smoke again                                                | 3:00                           | `pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com` | all pass                                           |
| 7 (optional) | Records back to DNS-only (grey) if the proxy is suspected  | 0:30 + propagation (TTL 300 s) | Zone DNS link                                                         | `cf-ray` header absent                             |
| 8            | Log evidence and open a post-mortem note                   | 0:30                           | --                                                                    | note                                               |

Total budget: 10:30 worst case with step 7, 10:00 without it (steps 2 and 3 take under 3 minutes
when rehearsed; steps 5 and 6 can run in parallel with step 4). If Vercel is not serving after step
4, go to step 7 immediately and, as a last resort, restore the Namecheap nameservers (section 5
rollback). There is no data to roll back. Vercel Production must stay deployed and unpaused until
Vercel retirement.

## 10. Gaps summary

Built (PR #262, merged to `develop` as 7a3ecce54): Production environment in `wrangler.jsonc`, the
Cloudflare Production upload workflow, the Production secrets option
(`pnpm ops:cloudflare:production:secrets`) and the Production version URL smoke
(`pnpm ops:cloudflare:production:smoke`). The timing question is settled (section 1).

Still open:

1. Production Access application and service token policy for the version URL (owner, step 3.1.3).
2. Rollback rehearsal record on Preview.
3. Worker error-rate notification and external uptime alert beyond the 15-minute GitHub workflow.
4. Production cron enablement step (used only after Vercel is paused).
5. After Vercel is deleted (2026-11-09): set `workers_dev: false` on `celebra-memories-retrieve` and
   redeploy it. Until then Vercel, the rollback host, still calls its `workers.dev` origin; the
   Cloudflare Worker already uses the `MEMORIES_RETRIEVE` Service Binding.
