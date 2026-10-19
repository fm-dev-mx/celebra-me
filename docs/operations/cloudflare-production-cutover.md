# Production cutover runbook: Vercel to Cloudflare Workers

Audience: a junior operator. Prepared 2026-10-15 and rescheduled 2026-10-16 from `wrangler.jsonc`,
`.github/workflows/deploy.yml`, `.github/workflows/deploy-production.yml`, `package.json`,
`scripts/ops/*`. The standing rules, external configuration and design decisions behind this runbook
live in [`cloudflare-platform.md`](cloudflare-platform.md). The cutover is done; this file stays as
the record and as the rollback procedure.

Legend: **TO BUILD** = does not exist on `develop` yet. Do not invent a command; build it first.
`$ACCT` = `05cb212a366549f0f93e7101c4ca3692`. `$SHA` = the 40-hex candidate commit on `main`
(release v0.28.1). Owner = project owner. Agent = coding-agent session. On Windows run `pnpm`
through Git Bash. All times are America/Mazatlan (UTC-7 all year; Sinaloa has no daylight saving
time since 2022).

Links

- Cloudflare dashboard: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692
- Workers: https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/workers-and-pages
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
- Vercel project: https://vercel.com/francisco-mendoza-s-projects/celebra-me
- Vercel project settings (Pause Project):
  https://vercel.com/francisco-mendoza-s-projects/celebra-me/settings
- GitHub Actions: https://github.com/fm-dev-mx/celebra-me/actions
- Cloudflare Production upload workflow:
  https://github.com/fm-dev-mx/celebra-me/actions/workflows/deploy-production.yml
- GitHub environments: https://github.com/fm-dev-mx/celebra-me/settings/environments
- Supabase Production Auth URLs:
  https://supabase.com/dashboard/project/ineitkdkyrxqyressllp/auth/url-configuration

## 1. Timing (decided by the owner on 2026-10-16)

- **Cutover T0 = Sunday 2026-10-18 02:00 Mazatlan = 09:00 UTC.** Vercel is paused the same night at
  **03:30** (10:30 UTC), and the Worker's crons are switched on in that same minute.
- Vercel crons run at 10:43 UTC (03:43 Mazatlan) and 15:17 UTC (08:17 Mazatlan). The 03:30 switch
  leaves 13 minutes before 03:43, so that night's 10:43 UTC job runs on the Worker and never on
  both.
- Freeze: **no migrations from Friday 2026-10-16 02:00 to Monday 2026-10-26 02:00**. **Saturday
  2026-10-17: no Production changes at all** (read-only checks only): `/xv/naydelin-paredes` has its
  event that day. Client freeze 2026-10-23 to 2026-11-07.
- The contact form no longer exists: the landing page offers WhatsApp only (PR #271). There is no
  contact mail to test.

## 2. Timeline

| When (Mazatlan)                  | UTC       | Step                                                                                             | Who           |
| -------------------------------- | --------- | ------------------------------------------------------------------------------------------------ | ------------- |
| Wed 2026-10-14 20:59 (done)      | Thu 03:59 | Name servers changed to Cloudflare (section 5)                                                   | Owner         |
| Thu 2026-10-15 (done)            | --        | Production Worker created, Access on version URLs, 22 secrets set (section 3.1)                  | Owner + Agent |
| Fri 2026-10-16 02:00             | 09:00     | Migration freeze starts                                                                          | --            |
| Fri 2026-10-16                   | --        | Release v0.28.1 to `main`; Vercel Production VERIFIED; its SHA becomes `$SHA`                    | Owner + Agent |
| Fri 2026-10-16, after v0.28.1    | --        | Final upload run of the Production Worker for `$SHA` (step 3.1.5); rollback rehearsal on Preview | Owner + Agent |
| Fri 2026-10-16, before 23:59     | --        | Day-before steps: backup, AI crawler policy, proxy apex and `www`, link previews (section 6)     | Owner + Agent |
| Sat 2026-10-17                   | --        | No Production changes; read-only checks of records, mail, certificate                            | Agent         |
| Sun 2026-10-18 (T0) 01:00        | 08:00     | Integrity snapshot "before", remote visual capture "before", go/no-go (section 4), backup        | Owner + Agent |
| Sun 2026-10-18 02:00             | 09:00     | Add the two Worker routes; memories public keys (section 7)                                      | Owner         |
| 02:15                            | 09:15     | Smoke, remote visual compare, manual review (section 7)                                          | Owner + Agent |
| 03:00                            | 10:00     | Decision: continue, or roll back without pause (section 9.1, about 10 minutes)                   | Owner         |
| 03:30                            | 10:30     | Pause Vercel and switch on the Worker crons in the same minute (section 8.1)                     | Owner         |
| 03:43                            | 10:43     | First cron job on the Worker (engagement maintenance)                                            | --            |
| 08:17                            | 15:17     | Second cron job on the Worker (memories cleanup); integrity snapshot "after"                     | Agent         |
| Mon 2026-10-19 .. Sun 2026-10-25 | --        | Daily watch (section 8)                                                                          | Owner + Agent |
| Mon 2026-10-26 02:00             | 09:00     | Migration freeze ends                                                                            | --            |
| Mon 2026-10-26 onward            | --        | Vercel retirement decision (separate runbook); Vercel stays paused, not deleted, until then      | Owner         |

Note on "zone active 72 h": the plan requires the zone active at least 72 hours before cutover. The
registry shows the name server change on 2026-10-15 03:59 UTC (Wednesday 2026-10-14 20:59 Mazatlan);
public resolvers returned `elma.ns.cloudflare.com` and `finley.ns.cloudflare.com` on Thursday
2026-10-15. Any Active time before Thursday 2026-10-15 02:00 meets the rule for Sunday 02:00. Record
the exact Active time from the zone overview in the evidence log.

## 3. Preconditions checklist (Friday 2026-10-16 to T-1 hour)

Tick each; paste the evidence into the handoff.

- [ ] Migration chain closed: no pending migrations, no contract planned before Monday 2026-10-26.
      Check: `pnpm release-check` (read-only; expected: no pending migration reported).
- [ ] No migrations from Friday 2026-10-16 02:00 to Monday 2026-10-26 02:00, and no merge to `main`
      after the candidate `$SHA` is uploaded (freeze). No Production change on Saturday 2026-10-17.
- [ ] Candidate `$SHA` (the v0.28.1 release on `main`, which contains PR #260, #269 and #272) is
      live on Vercel Production and its smoke is green:
      `pnpm ops:release-status --target production --sha $SHA` -> state VERIFIED.
- [ ] Production Worker `celebra-me` has `$SHA` uploaded, with no routes: `env.production` in
      `wrangler.jsonc` (built) has no routes and no `workers.dev` host. Evidence: a green run of the
      Cloudflare Production upload workflow for `$SHA`, and Workers > celebra-me > Settings >
      Domains & Routes lists no route.
- [ ] Commit status `Cloudflare - celebra-me production candidate smoke` is success on `$SHA`. This
      context proves the uploaded version only; no release gate reads it.
- [ ] Production secrets set by name (never values):
      `pnpm exec wrangler secret list --env production` -> every name of
      `CLOUDFLARE_WORKER_SECRET_NAMES.production` in `scripts/ops/cloudflare-worker-secrets.ts` (22
      names, set 2026-10-15).
- [ ] Version URL behind Access ("Previews only"): `/api/health` returns `build.commitSha == $SHA`
      and environment `production` with the service token, and does not return 200 without it (the
      smoke checks both).
- [ ] Zone Active, edge certificate covers apex and `www`, SSL mode Full (strict) (Zone SSL link).
- [ ] Production Cron Triggers not applied on the Worker (Workers > celebra-me > Settings > Trigger
      Events lists none), although `wrangler.jsonc` declares them. They are switched on only at
      03:30 (section 8.1).
- [ ] Supabase Auth redirect URLs include the production host(s) (Supabase link above).
- [ ] DNS records copied DNS-only: Zoho MX x3, SPF, DKIM `zmail._domainkey`, DMARC, TXT
      verifications.
- [x] Rollback rehearsed on Preview (route add/delete takes < 2 min), before Saturday 00:00. Record
      (2026-10-16, owner): added and then deleted the zone route
      `ensayo-vuelta-atras.celebra-me.com/*` -> Worker `celebra-me-preview`, with no DNS record and
      no traffic. `www`, apex, DNS, Vercel and the Production Worker were not touched. Owner
      estimate (not measured): ~30 s per route, ~1 min for the two Production routes, within the
      2-minute limit of section 3. The route no longer appears in the route list.
- [ ] Memories keys ready: the two public keys for `celebra-memories-sign` and
      `celebra-memories-retrieve` are in the owner's password manager, together with the current
      (Vercel) public keys those Workers hold today, which a rollback needs back.
- [ ] Remote visual compare ready (PR #273, on `develop`): run it from an up-to-date `develop`
      checkout; `pnpm visual:remote:routes --origin=https://www.celebra-me.com` lists the routes.
- [ ] Observability on: Workers logs + alerts. **TO BUILD**: Cloudflare notification for Worker
      error rate and an external uptime alert (the repo has
      `.github/workflows/production-uptime.yml`, every 15 min,
      `pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com`; keep it running).

### 3.1 Production Worker setup

Order matters: the Worker exists only after the first workflow run, and the smoke passes only once
Access and the secrets are in place. None of these steps routes traffic.

| Step                                                                                                                                   | Who   | Command or URL                                                                                    | Confirms with                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 3.1.1 (done 2026-10-15) GitHub environment `Cloudflare Production` (deployment branches: `main` only) with its secret and variables    | Owner | GitHub environments link                                                                          | names listed in the environment                                                  |
| 3.1.2 (done 2026-10-15) First run of the upload workflow from `main` 3dcaa38f7: created the Worker                                     | Owner | Upload workflow link > Run workflow > `main`                                                      | Worker `celebra-me` listed in Workers                                            |
| 3.1.3 (done 2026-10-15) Cloudflare Access on version URLs only ("Previews only"), allowing account members and the smoke service token | Owner | Production Worker settings > Domains & Routes > Preview URLs                                      | the app appears in Zero Trust Access applications; version URL asks for sign-in  |
| 3.1.4 (done 2026-10-15) Worker secrets uploaded from a one-off file outside the repository; file deleted                               | Agent | `pnpm ops:cloudflare:production:secrets -- --env-file <path> --dry-run`, then without `--dry-run` | `pnpm exec wrangler secret list --env production` lists every name               |
| 3.1.5 Final run of the upload workflow from `main` at `$SHA` (v0.28.1)                                                                 | Owner | Upload workflow link                                                                              | run green; status `Cloudflare - celebra-me production candidate smoke` = success |

Never set Access to "All traffic" on this Worker: it would also lock the routes added on Sunday.

### 3.2 Activate an uploaded version (every Production release)

The upload workflow only uploads and smokes a version; it never sends traffic to it. Activation is a
separate step, run by the agent after the owner approves the release.

1. Take the version ID from the workflow run log (`Worker Version ID: …`), or list the versions and
   pick the one tagged with `$SHA`:
   `pnpm exec wrangler versions list --config wrangler.jsonc --env production`.
2. Activate it at 100 %:
   `pnpm exec wrangler versions deploy <version-id>@100% --config wrangler.jsonc --env production --yes`.
   Never use `wrangler deploy`: it uploads a new build and also applies routes, triggers and
   anything else in the config.
3. Confirm the active deployment shows that version at 100 %:
   `pnpm exec wrangler deployments status --config wrangler.jsonc --env production`.
4. Confirm the domain serves it: `curl -s https://www.celebra-me.com/api/health` reports
   `build.commitSha == $SHA` and environment `production`.
5. Run the domain smoke: `pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com`.

Always pass `--config wrangler.jsonc`. Without it, Wrangler may pick up a stale
`.wrangler/deploy/config.json` left by an earlier local build and act on the wrong configuration.

## 4. Go / no-go list (Sunday 01:45; any NO = stop)

| #   | Question                                                                                                                                | Evidence                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | All section 3 boxes ticked                                                                                                              | handoff                                                   |
| 2   | `release-status` VERIFIED for `$SHA` on Vercel                                                                                          | command output                                            |
| 3   | Version URL health shows `$SHA` and `production`                                                                                        | `curl` with Access headers                                |
| 4   | Integrity snapshot "before" saved at 01:00 and a fresh critical backup done                                                             | snapshot file; `pnpm db:prod:backup:critical` OK          |
| 5   | Supabase and Cloudflare status pages green                                                                                              | status pages                                              |
| 6   | Owner awake, rollback steps (section 9) open in a second window                                                                         | owner                                                     |
| 7   | No deploy, merge, migration or DNS edit in the last 24 h except planned ones                                                            | GitHub, Vercel                                            |
| 8   | On the version URL a photo upload works and an unpaid test invitation's watermarked photo answers `200` with `content-type: image/webp` | `curl -sI` with Access headers on `/vista-previa/<token>` |
| 9   | Remote visual capture "before" finished at 01:00                                                                                        | capture folder `antes`                                    |

## 5. Name server change (done Wednesday 2026-10-14 20:59 Mazatlan)

Name servers changed and public DNS answers from Cloudflare. Zoho MX x3, the DKIM `zmail._domainkey`
and DMARC records resolve; apex and `www` are still served by Vercel. Steps 5.5 to 5.9 still need
their evidence.

| Step                                                                                                                                                                      | Who   | Command or URL                                                              | Confirms with                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 5.1 Lower TTL to 300 s at Namecheap as early as possible                                                                                                                  | Owner | https://ap.www.namecheap.com (Advanced DNS)                                 | `nslookup -type=A celebra-me.com pdns1.registrar-servers.com` shows TTL <= 300 |
| 5.2 Add the zone `celebra-me.com` (Free plan), copy every record, set Zoho and TXT records DNS-only (grey cloud); apex and `www` stay DNS-only pointing at Vercel for now | Owner | Zone DNS link                                                               | record list equals the Namecheap list from the plan evidence                   |
| 5.3 Backup before NS change                                                                                                                                               | Agent | `pnpm db:prod:backup:critical`                                              | backup finished OK                                                             |
| 5.4 Change NS at Namecheap to the two Cloudflare names shown in the zone overview                                                                                         | Owner | Namecheap Domain List > Manage > Nameservers > Custom DNS                   | `nslookup -type=NS celebra-me.com` shows Cloudflare names                      |
| 5.5 Wait for "Active"                                                                                                                                                     | Owner | https://dash.cloudflare.com/05cb212a366549f0f93e7101c4ca3692/celebra-me.com | green Active banner; note time                                                 |
| 5.6 Enable DNSSEC if the registrar shows no DS, then add DS at Namecheap                                                                                                  | Owner | Zone DNS > DNSSEC                                                           | DS status "active"                                                             |
| 5.7 Zoho mail in and out                                                                                                                                                  | Owner | send both ways                                                              | received both ways                                                             |
| 5.8 Apex redirect 307 (www vs apex behavior as before)                                                                                                                    | Agent | `curl -sI https://celebra-me.com/ \| head -3`                               | `307` with the same `Location` as before                                       |
| 5.9 Edge certificate Active, mode Full (strict)                                                                                                                           | Owner | Zone SSL link                                                               | "Active" for apex and `*.celebra-me.com` or `www`                              |

Rollback of this step: restore the Namecheap nameservers (Namecheap Default DNS); allow up to the
TTL.

## 6. Day before cutover (Friday 2026-10-16, before 23:59)

Saturday allows no Production change, so these steps happen on Friday.

| Step                                                                                                                | Who   | Command or URL                                                        | Confirms with                                                             |
| ------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 6.1 Backup                                                                                                          | Agent | `pnpm db:prod:backup:critical`                                        | OK, file listed                                                           |
| 6.2 AI crawler policy: Training = block, Search = allow, Agent = allow, Bot Preference Sync off, Bot Fight Mode off | Owner | AI Crawl Control link                                                 | screenshot of the settings                                                |
| 6.3 Switch `celebra-me.com` and `www` records to Proxied (orange), still pointing at Vercel                         | Owner | Zone DNS link                                                         | `curl -sI https://www.celebra-me.com/ \| grep -i cf-ray` returns a header |
| 6.4 Smoke through the proxy                                                                                         | Agent | `pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com` | all checks pass                                                           |
| 6.5 `/robots.txt` equals the build output                                                                           | Agent | `curl -s https://www.celebra-me.com/robots.txt` vs the generated file | identical, no Cloudflare-managed block prepended                          |
| 6.6 QR apex works                                                                                                   | Owner | open a real QR link on a phone                                        | invitation opens                                                          |
| 6.7 Link previews of a real invitation in WhatsApp, Facebook Messenger, Telegram                                    | Owner | share the link in each                                                | preview card with image renders in all three                              |

If 6.7 fails, stop: a bot block on the zone is the usual cause. Fix before Saturday, or set the
records back to DNS-only (grey) for the event day.

## 7. Cutover night (T0, Sunday 2026-10-18 02:00 Mazatlan = 09:00 UTC)

| Time  | Step                                                                                                                                                                                                                                                   | Who           | Command or URL                                                                                                                                     | Expected                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 01:00 | Integrity snapshot "before" (fingerprints and counts, read-only)                                                                                                                                                                                       | Agent         | `pnpm db:integrity:snapshot --target=production --out=<evidence>/integrity-antes.json`                                                             | file written; it is never overwritten                                                        |
| 01:00 | Remote visual capture "before" (still Vercel)                                                                                                                                                                                                          | Agent         | `pnpm visual:remote:capture --origin=https://www.celebra-me.com --label=antes`                                                                     | capture set `antes` complete                                                                 |
| 01:30 | Re-run section 3 checks; final backup                                                                                                                                                                                                                  | Owner + Agent | section 3; `pnpm db:prod:backup:critical`                                                                                                          | all YES; backup OK                                                                           |
| 01:45 | Go / no-go (section 4)                                                                                                                                                                                                                                 | Owner         | section 4                                                                                                                                          | all YES                                                                                      |
| 02:00 | Add route `www.celebra-me.com/*` -> Worker `celebra-me`                                                                                                                                                                                                | Owner         | Zone Worker routes link (or Workers > celebra-me > Settings > Domains & Routes)                                                                    | route listed                                                                                 |
| 02:00 | Add route `celebra-me.com/*` -> Worker `celebra-me`                                                                                                                                                                                                    | Owner         | same                                                                                                                                               | route listed                                                                                 |
| 02:02 | Memories public keys: `MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY` on `celebra-memories-sign`, `MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY` on `celebra-memories-retrieve` (only those two names; leave every other secret of those Workers as it is) | Owner         | Memories sign and retrieve Worker settings links > Variables and Secrets                                                                           | both saved; gallery share links made before tonight stop working (new share secret)          |
| 02:03 | Check the stable host serves the new build                                                                                                                                                                                                             | Agent         | `curl -s https://www.celebra-me.com/api/health`                                                                                                    | JSON `build.commitSha == $SHA`, environment `production`, and no `x-vercel-id` header        |
| 02:05 | Release status                                                                                                                                                                                                                                         | Agent         | `pnpm ops:release-status --target production --sha $SHA`                                                                                           | VERIFIED                                                                                     |
| 02:15 | Smoke                                                                                                                                                                                                                                                  | Agent         | `pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com`                                                                              | all checks pass                                                                              |
| 02:15 | Remote visual capture "after" and compare                                                                                                                                                                                                              | Agent         | `pnpm visual:remote:capture --origin=https://www.celebra-me.com --label=despues`, then `pnpm visual:remote:compare --before=antes --after=despues` | no unexplained difference; the expected image re-encoding differences are listed, not hidden |
| 02:15 | Manual review (checklist below)                                                                                                                                                                                                                        | Owner         | real phone                                                                                                                                         | all pass                                                                                     |
| 03:00 | Decision                                                                                                                                                                                                                                               | Owner         | --                                                                                                                                                 | continue to 03:30, or roll back with section 9.1                                             |
| 03:30 | Pause Vercel and switch on the Worker crons in the same minute                                                                                                                                                                                         | Owner         | section 8.1                                                                                                                                        | Vercel paused; Trigger Events lists exactly the two schedules                                |

Manual review checklist (production, real phone):

1. `/xv/naydelin-paredes` opens complete: photos, music, RSVP section.
2. `/r/victoria-y-roberto` opens (memories QR page) and a test photo upload and the gallery work on
   the canary space.
3. One unpaid invitation's photo under `/vista-previa/<token>` answers `200` with
   `content-type: image/webp` and shows the watermark:
   `curl -sI https://www.celebra-me.com/vista-previa/<token>`.
4. Landing page loads; the contact card opens WhatsApp (there is no contact form or mail any more).
5. A demo invitation loads.
6. RSVP with a fixture guest.
7. Login plus MFA.
8. A photo upload in the editor succeeds.
9. QR apex (`celebra-me.com` link) opens the invitation.
10. `/robots.txt` unchanged.
11. One chat link preview of a real invitation.

## 8. Watch period (Monday 2026-10-19 to Sunday 2026-10-25)

| Day                  | Who   | Check                                                                                                                                                                      | Pass                                                 |
| -------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Sun 18 08:30         | Agent | Integrity snapshot "after" and compare: `pnpm db:integrity:snapshot --target=production --out=<evidence>/integrity-despues.json --compare=<evidence>/integrity-antes.json` | no table or per-event count shrinks; no row lost     |
| Sun 18               | Agent | Workers > celebra-me > Logs: one `scheduled` event at 10:43 UTC and one at 15:17 UTC, outcome `completed`                                                                  | both present                                         |
| Daily 09:00 Mazatlan | Agent | Cloudflare Workers > celebra-me > Metrics: error rate, CPU p95                                                                                                             | 5xx below 1 %, CPU within the measured Preview range |
| Daily                | Agent | GitHub Actions > Production Uptime                                                                                                                                         | no alert issue open                                  |
| Daily                | Owner | RSVP and login on a real phone                                                                                                                                             | works                                                |
| Mon 19               | Agent | `curl -s https://www.celebra-me.com/api/health`                                                                                                                            | still `$SHA`                                         |
| Mon 26               | Owner | Go decision for Vercel retirement                                                                                                                                          | all clean for 7 days                                 |

The client freeze from 2026-10-23 to 2026-11-07 (event on 2026-10-30) allows no planned Production,
DNS or Worker change; a rollback under section 9 is the only exception.

### 8.1 Pause Vercel and switch on the Worker crons (03:30, same minute)

`env.production` in `wrangler.jsonc` declares the two Vercel schedules, `17 15 * * *` (memories
cleanup) and `43 10 * * *` (engagement maintenance), and the Worker's `scheduled` handler runs the
same jobs as `/api/cron/*` (`src/lib/server/scheduled-jobs.ts`). Cron triggers are non-versioned:
`wrangler versions upload`, `wrangler versions deploy` and `wrangler secret bulk` never apply them,
so they stay off until this step. The "switch" is adding the two Cron Triggers in the dashboard;
there is no code flag. Never run `wrangler deploy --env production` instead: it would also apply
anything else in the config.

1. Vercel project settings link > Pause Project > confirm. Vercel stops serving and its crons stop
   firing. The domain keeps working because the Worker routes already serve it.
2. In the same minute: Workers > celebra-me > Settings > Trigger Events > Add > Cron Triggers: add
   `43 10 * * *` and `17 15 * * *` (UTC), exactly as declared. The dashboard touches the schedules
   only; zone routes stay as they are.
3. Confirm: Trigger Events lists exactly those two. Changes take up to 15 minutes to propagate;
   03:30 leaves 13 minutes before 03:43, so if the 10:43 UTC job does not appear in the logs, run it
   by hand on Monday, not twice.
4. `curl -sI https://www.celebra-me.com/` still answers `200` with a `cf-ray` header and no
   `x-vercel-id`.

## 9. Rollback

Trigger (any one): 5xx above 1 % for 5 minutes (Workers > celebra-me > Metrics, or Production Uptime
alert), or any failure of login, QR, RSVP, `/xv/naydelin-paredes` or `/r/victoria-y-roberto`, or
`/api/health` not reporting `$SHA` and `production`. Owner decides; the agent only prepares
commands. Never run a migration during rollback; the schema is shared by both builds by design.
There is no data to roll back.

### 9.1 Before the Vercel pause (until 03:30): about 10 minutes

| #   | Step                                                                                                  | Budget | Command or URL                                                        | Confirms with                                      |
| --- | ----------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Announce rollback in the log with the time and the symptom                                            | 0:30   | --                                                                    | note                                               |
| 2   | Delete route `www.celebra-me.com/*`                                                                   | 1:30   | Zone Worker routes link > Delete                                      | route gone                                         |
| 3   | Delete route `celebra-me.com/*`                                                                       | 1:30   | same                                                                  | route gone                                         |
| 4   | Put the previous (Vercel) public keys back on `celebra-memories-sign` and `celebra-memories-retrieve` | 2:00   | Memories sign and retrieve Worker settings links                      | both saved                                         |
| 5   | Check Vercel serves again                                                                             | 1:00   | `curl -sI https://www.celebra-me.com/ \| grep -i x-vercel-id`         | header present; `/api/health` shows the Vercel SHA |
| 6   | Smoke again                                                                                           | 3:00   | `pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com` | all pass                                           |
| 7   | Log evidence and open a post-mortem note                                                              | 0:30   | --                                                                    | note                                               |

Crons were never switched on, so there is nothing else to undo.

### 9.2 After the Vercel pause (from 03:30): about 20 minutes

Order: Vercel first, so the domain has a host to fall back to; crons last, so one runner is active
at a time.

| #   | Step                                                                                                  | Budget | Command or URL                                                                                                                          | Confirms with                                      |
| --- | ----------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Announce rollback in the log with the time and the symptom                                            | 0:30   | --                                                                                                                                      | note                                               |
| 2   | Resume Vercel                                                                                         | 3:00   | Vercel project settings link > Resume Project                                                                                           | Vercel deployment URL answers again                |
| 3   | Delete route `www.celebra-me.com/*`                                                                   | 1:30   | Zone Worker routes link > Delete                                                                                                        | route gone                                         |
| 4   | Delete route `celebra-me.com/*`                                                                       | 1:30   | same                                                                                                                                    | route gone                                         |
| 5   | Switch off the Worker crons: delete both Cron Triggers                                                | 2:00   | Workers > celebra-me > Settings > Trigger Events                                                                                        | Trigger Events lists none                          |
| 6   | Put the previous (Vercel) public keys back on `celebra-memories-sign` and `celebra-memories-retrieve` | 2:00   | Memories sign and retrieve Worker settings links                                                                                        | both saved                                         |
| 7   | Check Vercel serves again                                                                             | 1:00   | `curl -sI https://www.celebra-me.com/ \| grep -i x-vercel-id`                                                                           | header present; `/api/health` shows the Vercel SHA |
| 8   | Release status on the Vercel SHA, and smoke again                                                     | 5:00   | `pnpm ops:release-status --target production --sha <vercel_sha>`; `pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com` | VERIFIED; all pass                                 |
| 9   | Log evidence and open a post-mortem note                                                              | 0:30   | --                                                                                                                                      | note                                               |

If a cron job already ran on the Worker, do not repeat it on Vercel that day.

If Vercel is not serving after either rollback, set the apex and `www` records to DNS-only (grey,
Zone DNS link, TTL 300 s) and, as a last resort, restore the Namecheap nameservers (section 5
rollback).

## 10. Gaps summary

Built: Production environment in `wrangler.jsonc` with its Cron Triggers declared (PR #262, #272),
the Cloudflare Production upload workflow, the Production secrets option
(`pnpm ops:cloudflare:production:secrets`), the Production version URL smoke
(`pnpm ops:cloudflare:production:smoke`), the read-only integrity snapshot
(`pnpm db:integrity:snapshot`, PR #274), the remote visual compare (`pnpm visual:remote:*`, PR #273)
and the WhatsApp-only contact card (PR #271). Access on version URLs and the 22 secrets are in place
since 2026-10-15.

Still open:

1. Final upload run for v0.28.1 (step 3.1.5).
2. Worker error-rate notification and external uptime alert beyond the 15-minute GitHub workflow.
3. Done 2026-10-19 (owner decision, ahead of the Vercel deletion): `workers_dev: false` on
   `celebra-memories-retrieve` and its staging Worker, and `MEMORIES_PRIVATE_RETRIEVAL_ORIGIN`
   removed from `celebra-me` and `celebra-me-preview`. Vercel, the rollback host, can no longer
   serve memories media. The sign Worker keeps `workers_dev`: browsers upload to its public host.

Done 2026-10-17 (owner):

- The current (Vercel) memories public keys available for a rollback (section 3): in the password
  manager.
- `celebra-me-memories-prod-keys.txt` and `generar-llaves-recuerdos.mjs` deleted outside the
  repository, after the keys were in the password manager.
