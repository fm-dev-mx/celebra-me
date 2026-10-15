# Production cutover runbook: Vercel to Cloudflare Workers

Audience: a junior operator. Draft prepared 2026-10-15 from
`.agent/plans/active/cloudflare-workers-migration.md`, `wrangler.jsonc`,
`.github/workflows/deploy.yml`, `package.json`, `scripts/ops/*`.

Legend: **TO BUILD** = does not exist in the repo yet. Do not invent a command; build it first.
`$ACCT` = `05cb212a366549f0f93e7101c4ca3692`. `$SHA` = the 40-hex candidate commit on `main`. Owner
= project owner. Agent = coding-agent session. On Windows run `pnpm` through Git Bash.

Links

- Cloudflare dashboard: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692
- Workers: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/workers-and-pages
- Zone DNS: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com/dns/records
- Zone Worker routes:
  https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com/workers/routes
- Zone SSL: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com/ssl-tls
- AI Crawl Control: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com/ai
- Vercel project: https://vercel.com/francisco-mendoza-s-projects/celebra-me
- GitHub Actions: https://github.com/fm-dev-mx/celebra-me/actions
- Supabase dashboard (Auth URLs): https://supabase.com/dashboard/project/_/auth/url-configuration
  (pick the Production project)

## 1. Timing decision (read first)

Mexico City has no daylight saving time since 2022: America/Mexico_City = UTC-6 all year. The plan
says cutover "2026-11-12 08:00 America/Mazatlan" (UTC-7) = 15:00 UTC. That is 17 minutes before the
15:17 UTC cron, which breaks the plan's own rule. Proposal for owner approval:

- **Cutover T0 = 2026-11-12 06:00 America/Mexico_City = 12:00 UTC** (night traffic, 77 min after the
  10:43 UTC cron, 197 min before the 15:17 UTC cron).
- Crons keep running on Vercel until Vercel retirement, so the cron times matter only as a rule of
  thumb; they must not collide with the routing change.

## 2. Timeline

| When (Mexico City)               | UTC         | Step                                                                | Who           |
| -------------------------------- | ----------- | ------------------------------------------------------------------- | ------------- |
| Mon 2026-11-09 (T-3 d) 06:00     | 12:00       | Name server change (section 5)                                      | Owner         |
| 2026-11-09 06:00-12:00           | 12:00-18:00 | Zone becomes Active; verify records, mail, certificate              | Owner + Agent |
| Tue 2026-11-10 (T-2 d) 08:00     | 14:00       | Check preconditions (section 3)                                     | Owner + Agent |
| Wed 2026-11-11 (T-1 d) 05:00     | 11:00       | Production backup, AI crawler policy                                | Owner + Agent |
| Wed 2026-11-11 06:00             | 12:00       | Proxy apex and www (still pointing at Vercel); smoke; link previews | Owner + Agent |
| Thu 2026-11-12 (T0) 05:00        | 11:00       | Preconditions re-check, final backup, go/no-go                      | Owner + Agent |
| Thu 2026-11-12 06:00             | 12:00       | Add the two Worker routes (cutover)                                 | Owner         |
| 06:02                            | 12:02       | Release status check                                                | Agent         |
| 06:05                            | 12:05       | Manual smoke checklist                                              | Owner         |
| 06:30                            | 12:30       | Declare success or roll back                                        | Owner         |
| 2026-11-13 .. 11-19 (T+1 .. T+7) | --          | Daily watch (section 8)                                             | Owner + Agent |
| 2026-11-19 onward (T+7)          | --          | Vercel retirement decision (separate runbook)                       | Owner         |

Note on "zone active 72 h": the plan requires the zone active at least 72 hours before cutover.
Cutover is 2026-11-12 12:00 UTC, so activation must be at or before 2026-11-09 12:00 UTC. Record the
exact activation time in the evidence log. If activation is later, move the cutover (do not shorten
the 72 h). If the NS change slips past 06:00 Mexico City, start by delaying the cutover.

## 3. Preconditions checklist (T-3 days to T-1 hour)

Tick each; paste the evidence into the handoff.

- [ ] Migration chain closed: no pending migrations, no contract planned before T+7. Check:
      `pnpm release-check` (read-only; expected: no pending migration reported).
- [ ] No migrations and no merges to `main` from T-3 days to T+7 (freeze).
- [ ] Candidate `$SHA` is live on Vercel Production and its smoke is green:
      `pnpm ops:release-status --target production --sha $SHA` -> state VERIFIED.
- [ ] Production Worker `celebra-me` has the candidate version uploaded, with no routes. **TO
      BUILD**: production environment in `wrangler.jsonc` (today only `env.preview` exists, the top
      level is the never-deployed local target `celebra-me-local`). It needs `name: celebra-me`,
      `vars.CELEBRA_DEPLOY_ENV=production`, production `BASE_URL`/Supabase vars, `images` binding,
      the rate-limit bindings (namespace ids 3001-3099 are reserved for Production), and **no
      `crons`** yet.
- [ ] Production deploy workflow. **TO BUILD**: `.github/workflows/deploy.yml` is Preview only (push
      to `develop`, `environment: Preview`, `CLOUDFLARE_ENV: preview`). A production workflow must
      upload a version tagged with the SHA, smoke it, record GitHub Deployment `Production` and the
      commit status for `CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE` (name already known to
      `release-status.ts`), and must NOT route traffic (routing is the manual cutover).
- [ ] Production secrets set by name. **TO BUILD**: only `ops:cloudflare:preview:secrets` exists; a
      production equivalent (or a `--env production` option) is needed. Verify names (never values):
      `pnpm exec wrangler secret list --env production` -> every required name present.
- [ ] Smoke of the version URL behind Access passes. **TO BUILD**: `ops:cloudflare:preview:smoke`
      checks `/api/health` for the `preview` environment only; a production variant is needed. Then:
      `pnpm ops:release-status --target production --sha $SHA` -> VERIFIED, and `/api/health` on the
      version URL returns `build.commitSha == $SHA` and environment `production`.
- [ ] Zone Active, edge certificate covers apex and `www`, SSL mode Full (strict) (Zone SSL link).
- [ ] Production Cron Triggers disabled on the Worker (dashboard: Workers > celebra-me > Settings >
      Triggers shows none). Crons stay on Vercel.
- [ ] GitHub secrets exist: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; Access service token
      pair for the version URL smoke.
- [ ] Supabase Auth redirect URLs include the new production host(s) (Supabase link above).
- [ ] DNS records copied DNS-only: Zoho MX x3, SPF, DKIM `zmail._domainkey`, DMARC, TXT
      verifications.
- [ ] Rollback rehearsed on Preview (route add/delete takes < 2 min). **TO BUILD**: the rehearsal
      record.
- [ ] Observability on: Workers logs + alerts. **TO BUILD**: Cloudflare notification for Worker
      error rate and an external uptime alert (the repo has
      `.github/workflows/production-uptime.yml`, every 15 min,
      `pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com`; keep it running).

## 4. Go / no-go list (T0 minus 15 minutes; any NO = stop)

| #   | Question                                                                     | Evidence                                   |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | All section 3 boxes ticked                                                   | handoff                                    |
| 2   | `release-status` VERIFIED for `$SHA` on Vercel                               | command output                             |
| 3   | Version URL health shows `$SHA` and `production`                             | `curl` with Access headers                 |
| 4   | Fresh critical backup done today                                             | `pnpm db:prod:backup:critical` finished OK |
| 5   | Supabase and Cloudflare status pages green                                   | status pages                               |
| 6   | Owner awake, rollback steps open in a second window                          | owner                                      |
| 7   | No deploy, merge, migration or DNS edit in the last 24 h except planned ones | GitHub, Vercel                             |
| 8   | Time is not within 10 minutes of 10:43 or 15:17 UTC                          | clock                                      |

## 5. Name server change (2026-11-09)

| Step                                                                                                                                                                      | Who   | Command or URL                                            | Confirms with                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 5.1 On 2026-11-07 lower TTL to 300 s at Namecheap                                                                                                                         | Owner | https://ap.www.namecheap.com (Advanced DNS)               | `nslookup -type=A celebra-me.com pdns1.registrar-servers.com` shows TTL <= 300 |
| 5.2 Add the zone `celebra-me.com` (Free plan), copy every record, set Zoho and TXT records DNS-only (grey cloud); apex and `www` stay DNS-only pointing at Vercel for now | Owner | Zone DNS link                                             | record list equals the Namecheap list from the plan evidence                   |
| 5.3 Backup before NS change                                                                                                                                               | Agent | `pnpm db:prod:backup:critical`                            | backup finished OK                                                             |
| 5.4 Change NS at Namecheap to the two Cloudflare names shown in the zone overview                                                                                         | Owner | Namecheap Domain List > Manage > Nameservers > Custom DNS | `nslookup -type=NS celebra-me.com` shows Cloudflare names                      |
| 5.5 Wait for "Active"                                                                                                                                                     | Owner | Zone overview                                             | green Active banner; note time                                                 |
| 5.6 Enable DNSSEC if the registrar shows no DS, then add DS at Namecheap                                                                                                  | Owner | Zone DNS > DNSSEC                                         | DS status "active"                                                             |
| 5.7 Zoho mail in and out                                                                                                                                                  | Owner | send both ways                                            | received both ways                                                             |
| 5.8 Apex redirect 307 (www vs apex behavior as before)                                                                                                                    | Agent | `curl -sI https://celebra-me.com/ \| head -3`             | `307` with the same `Location` as before                                       |
| 5.9 Edge certificate Active, mode Full (strict)                                                                                                                           | Owner | Zone SSL link                                             | "Active" for apex and `*.celebra-me.com` or `www`                              |

Rollback of this step: restore the Namecheap nameservers (Namecheap Default DNS); allow up to the
TTL.

## 6. Day before cutover (T-1 day)

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

## 7. Cutover (T0, 2026-11-12 06:00 Mexico City = 12:00 UTC)

| Time      | Step                                                    | Who           | Command or URL                                                                    | Expected                                                                                                                                                             |
| --------- | ------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-60 min  | Re-run section 3 checks and section 4                   | Owner + Agent | see sections                                                                      | all YES                                                                                                                                                              |
| T-15 min  | Final backup                                            | Agent         | `pnpm db:prod:backup:critical`                                                    | OK                                                                                                                                                                   |
| T0        | Add route `www.celebra-me.com/*` -> Worker `celebra-me` | Owner         | Zone Worker routes link (or Workers > celebra-me > Settings > Domains and Routes) | route listed                                                                                                                                                         |
| T0 + 30 s | Add route `celebra-me.com/*` -> Worker `celebra-me`     | Owner         | same                                                                              | route listed                                                                                                                                                         |
| T+1 min   | Check the stable host serves the new build              | Agent         | `curl -s https://www.celebra-me.com/api/health`                                   | JSON `build.commitSha == $SHA`, environment `production`, and header `server: cloudflare` with no `x-vercel-id`                                                      |
| T+2 min   | Release status                                          | Agent         | `pnpm ops:release-status --target production --sha $SHA`                          | VERIFIED. Note: today it reads provider evidence from GitHub; the Cloudflare production Deployment and smoke status come from the production workflow (**TO BUILD**) |
| T+5 min   | Manual smoke                                            | Owner         | see checklist below                                                               | all pass                                                                                                                                                             |
| T+30 min  | Decision                                                | Owner         | --                                                                                | success, or roll back                                                                                                                                                |

Manual smoke checklist (production, real phone for items 4, 6, 8):

1. Landing page loads.
2. A demo invitation loads.
3. A real invitation loads (and the paid watermark is absent; an unpaid invitation shows it).
4. RSVP with a fixture guest.
5. Login plus MFA.
6. Editor preflight.
7. `/vista-previa/<token>` opens.
8. QR apex.
9. Contact form email arrives.
10. Memories upload and retrieve on the canary space.
11. `/robots.txt` unchanged.
12. One chat link preview of a real invitation.

## 8. Watch period (T+1 to T+7)

| Day                     | Who   | Check                                                          | Pass                                                 |
| ----------------------- | ----- | -------------------------------------------------------------- | ---------------------------------------------------- |
| Daily 09:00 Mexico City | Agent | Cloudflare Workers > celebra-me > Metrics: error rate, CPU p95 | 5xx below 1 %, CPU within the measured Preview range |
| Daily                   | Agent | GitHub Actions > Production Uptime                             | no alert issue open                                  |
| Daily                   | Owner | RSVP and login on a real phone                                 | works                                                |
| T+1                     | Agent | `curl -s https://www.celebra-me.com/api/health`                | still `$SHA`                                         |
| T+7                     | Owner | Go decision for Vercel retirement                              | all clean for 7 days                                 |

Crons: remain on Vercel during this whole period (one cron runner at a time). Production Cron
Triggers are enabled only at the moment Vercel is paused.

## 9. Rollback (maximum 10 minutes)

Trigger (any one): 5xx above 1 % for 5 minutes (Workers > celebra-me > Metrics, or Production Uptime
alert), or any failure of login, QR or RSVP, or `/api/health` not reporting `$SHA` and `production`.
Owner decides; the agent only prepares commands. Never run a migration during rollback; the schema
is shared by both builds by design.

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

## 10. Gaps summary (TO BUILD)

1. Production environment in `wrangler.jsonc` (name `celebra-me`, vars, bindings, ratelimit
   namespaces 3001+, no crons).
2. Production deploy workflow (upload tagged version, smoke, GitHub Deployment, status; no routing).
3. Production secrets script or `--env production` option next to `ops:cloudflare:preview:secrets`.
4. Production smoke for the Cloudflare version URL (`cloudflare-preview-smoke.ts` is preview-only).
5. Production Access policy and service token for the version URL (the Preview Access app exists
   only).
6. Rollback rehearsal record on Preview.
7. Worker error-rate notification and external uptime alert beyond the 15-minute GitHub workflow.
8. Production cron enablement step (used only after Vercel is paused).
9. Owner decision on the timing conflict: 08:00 Mazatlan (15:00 UTC) vs the 15:17 UTC cron.
