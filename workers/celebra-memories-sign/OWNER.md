# Event memories — owner handoff

This runbook covers the owner-operated Staging rollout, the separately authorized Production canary,
per-event activation, and sanitized proof for the guest photo/video QR feature. Repository readiness
does not authorize database, Cloudflare, R2, Vercel, DNS, Preview, Production, or Git mutations.

The authoritative global limits, MIME rules, Worker paths, retention bound, and archive bounds live
only in `src/lib/memories/contract/`. Per-event values (public slug, upload window, retention, event
and session quotas, entitlement) live in the `event_memory_settings` table and are managed from
`/dashboard/admin/recuerdos`. Do not repeat or override either source in provider notes, UI code,
SQL, or deployment scripts.

## Required security boundary

- The bucket remains private. Disable `r2.dev`, public custom-domain access, public listing, public
  GET, browser credentials, and object ACLs.
- Guests reach the same-origin app API. The app authenticates the opaque guest session, decides the
  upload window, availability and every quota inside one database transaction, and privately
  requests one short-lived PUT capability. File bytes travel through the Sign Worker into the
  private R2 binding under `events/<event uuid>/<object uuid>.<ext>`.
- The browser receives an opaque, AES-GCM-sealed capability, its required headers, and expiration
  only. It can neither read nor forge the object key or the session identifier.
- Retrieval starts with a browser media ID. The app authenticates either the owning guest session
  for an inline accepted item or the dashboard event `owner` for organizer access, resolves the
  object key internally, and signs one private Worker request.
- The Retrieval Worker reads or deletes the exact object through its R2 binding. It never calls
  `list()`, returns a signed GET URL, or accepts an object key from the browser.
- Managers, anonymous users, other guest sessions, and super admins without event-owner membership
  have no organizer access. Super admins manage spaces (activation, window, retention, limits) but
  never see guest media through that surface.
- The Workers know nothing about events. Adding an event never requires a Worker deployment.

## Credential ownership

Use the canonical
[event memories environment cheatsheet](../../docs/env-workflow.md#event-memories-environment-cheatsheet)
for every variable name, owner, environment, and value source. Do not reproduce that inventory in
this runbook. Generate two independent ECDSA P-256 pairs per hosted environment; private keys stay
in Vercel, Cloudflare receives only the public keys and the capability secret, while the R2 binding
stays inside the Sign Worker. Browser origins allowed to PUT are the Worker variable
`MEMORIES_ALLOWED_ORIGINS` in `wrangler.json`; a Staging branch preview origin may be passed at
deploy time with `--var` and must never be committed.

Wrangler deployment authentication is an operator boundary, not Worker runtime configuration.
Interactive owner runs use `wrangler login`. This rollout does not create deployment tokens or use
Cloudflare Secrets Store.

Rotate both request-signing pairs and the capability secret every 90 days, or immediately after
suspected exposure. For a request-signing pair, publish the replacement public key and private key
in a coordinated fail-closed window, verify it, then remove the previous key. For R2 exposure,
disable signing first, rotate the capability secret, deploy, verify, and revoke the previous secret.
Never paste keys, tokens, capabilities, recovery codes, provider identifiers, or object names into
evidence.

## Per-event activation

1. Publish the invitation through the normal release flow so the `events` row exists.
2. In `/dashboard/admin/recuerdos`, activate the event: public slug (defaults to the event slug and
   never changes once printed), time zone, upload window, retention end, limits profile, and
   entitlement (`package`, `addon`, `courtesy`).
3. Generate the printable QR with `pnpm memories:qr -- --slug <public-slug>`; files land under
   `.tmp/memories-qr/`. The payload is `https://celebra-me.com/r/<public-slug>` and depends on the
   apex-to-`www` redirect configured outside the repository.
4. Run the Production canary (below) once the window is open, then the real-phone smoke checks.
5. Disable a space from the same admin surface to stop uploads immediately; retention and cleanup
   continue unchanged.

## Owner-run Production canary

This is a manual, single-use Production transaction. Repository readiness, a passing test, or a
previous canary does not authorize it. Before running, review the exact working diff and checkout
and obtain explicit current authorization for one synthetic Production lifecycle. Do not schedule
this command or place it in CI.

Run only from the repository root with the repository-managed `tsx` and Playwright dependencies:

```text
pnpm canary:memories -- --slug=<public-slug> --destination=https://www.celebra-me.com/r/<public-slug> --confirm-production=I_AUTHORIZE_ONE_MEMORIES_PRODUCTION_CANARY
```

The command rejects CI markers, a non-interactive terminal, missing or altered confirmation, unknown
arguments, invalid slugs, and every destination except the exact canonical `www` route for that
slug. Do not substitute global `npx`, install tools, follow a redirect destination, or weaken these
checks.

One fresh browser context creates one synthetic guest session and uploads one tiny in-memory,
non-PII PNG. The request guard permits at most one session creation, reservation, direct Worker PUT,
and logical DELETE. It permits only the application's existing maximum of three idempotent
completion attempts against the same media item. It waits for Astro hydration, requires an accepted
catalog record, decodes the private preview, verifies `private, no-store` and `nosniff`, deletes the
item, and confirms its absence from the authenticated catalog and UI.

If the normal flow has not attempted DELETE, `finally` may attempt exactly one authenticated DELETE
and confirm catalog absence. It never begins a second lifecycle. If a session or reservation was
created, do not rerun the command after any failure. Unconfirmed cleanup is `BLOCKED / FAILED` and
requires owner investigation; never invoke the scheduled cleanup endpoint manually.

The canary writes JSON lines containing only UTC timestamp, stage, sanitized status, and severity.
It never creates screenshots, traces, HAR files, or media files and never prints identifiers,
cookies, capabilities, signed URLs, object keys, checksums, request bodies, recovery codes, tokens,
or secrets.

Scheduled physical cleanup remains a separate read-only Vercel evidence gate and stays `UNVERIFIED`
until invocation metadata proves its completion. The cron runs daily at 15:17 UTC (Hobby fires it
anywhere within that hour, 08:17–09:16 in Mazatlán) and delivery is best effort. Hobby keeps runtime
logs for one hour: capture the `memories_cleanup_summary` line within that hour, or check the next
day when it is absent. `cleanup_in_flight_backlog` means storage could not prove the state of some
in-flight items; they are kept, never deleted blindly.

## Owner Staging apply order

1. Reconcile the complete branch diff against the reviewed HEAD and obtain separate authorization
   for any future Git integration. Deploy only an immutable reviewed revision.
2. Validate all migrations against `disposable-test`. Apply the forward migration to Preview only
   through the guarded workflow and its explicit human authorization boundary.
3. Confirm the Staging R2 Standard bucket is private and account-wide projected storage remains
   within the approved budget. Apply the repository CORS and lifecycle files exactly; confirm no
   public access.
4. Run `wrangler login`, configure the Staging public verification keys and private bucket binding,
   then deploy the Retrieval Worker with `--env staging`. Verify unsigned, stale, wrong-audience,
   and guessed-key requests fail closed.
5. Configure the Vercel Preview server-only values from the canonical cheatsheet and deploy the
   app/backend. Vercel schedules crons only on Production, so prove Staging cleanup with one
   authorized `GET` carrying `Authorization: Bearer <CRON_SECRET>`; the endpoint must accept nothing
   else.
6. Configure the capability secret and Staging Sign Worker values, deploy it last with
   `--env staging`, and confirm the configured Staging rate-limiter namespace is available. Block
   rollout if Cloudflare rejects it. Then verify requests require a fresh ECDSA envelope and
   rate-limit by authenticated session ID.
7. Run `pnpm worker:memories:config:generate` and verify the working tree remains unchanged. Apply
   `r2-cors.staging.json` only to Staging and `r2-cors.production.json` plus
   `r2-lifecycle.production.json` only to Production. These files are projections of
   `src/lib/memories/contract/`; never edit origins, headers, prefixes, or ages directly in
   Cloudflare or in the JSON files.
8. Activate a synthetic space from the admin surface and run the sanitized Staging matrix below with
   synthetic, non-PII media only. Run phone checks only after that space's upload window opens.

Cloudflare Free-account capacity is a budget gate, not an application quota. Before rollout, the
owner must confirm account-wide R2 storage and operations plus Workers daily requests and CPU remain
below the then-current provider limits. The Cloudflare rate-limiter binding is eventual abuse
protection; the reservation RPC remains the authoritative quota, window, and concurrency boundary.

## Organizer retrieval procedure

1. The organizer signs in through the existing dashboard session and selects an event with an active
   space.
2. The same-origin catalog endpoint revalidates the session and exact event `owner` membership, then
   returns a bounded page of public media DTOs and uploader display name/alias. It returns no
   session ID, checksum, duplicate link, object key, URL, recovery code, or provider identifier.
3. For preview or download, the browser requests a media ID. The app repeats authorization, requires
   `accepted` and not deleted, resolves the private key internally, and signs a short-lived ECDSA
   request to the Retrieval Worker. Preview uses `inline`; organizer download uses `attachment`.
4. The Worker verifies audience, timestamp, request ID, body hash, signature, route, MIME/key
   pairing, and optional byte range. It streams the R2 body with `private, no-store`, `nosniff`, and
   Range/206 support. It exposes neither listing nor a reusable URL.
5. Selected export fetches accepted media sequentially through the same authorized route, partitions
   it by the canonical archive contract, and creates AES-256 encrypted ZIP batches in the
   organizer's browser. The one-time passphrase is generated with Web Crypto and is never sent to
   the server.
6. Revocation blocks new guest operations immediately. Deletion makes the item unavailable
   immediately, schedules private physical deletion, and is not reversible in the UI. Failed
   deletion retains quota, releases its lease for a later cron attempt, and remains protected by the
   final R2 lifecycle rule.

## Audit and retention

Audit only actor type/opaque actor ID, action, media ID, status transition, and timestamp. Never log
names, captions, request bodies, IP addresses, recovery codes, checksums, keys, capabilities,
headers, or media. The daily job settles stale in-flight items from storage evidence (it rejects a
validation or releases a reservation only when the Retrieval Worker answers that the object is
absent, and validates uploads whose browser never confirmed them), schedules every resident object
of a space whose retention ended, deletes scheduled objects in reclaimable batches within its time
budget, anonymizes inactive guest profiles after their last object is gone, and purges audit rows
after the canonical audit retention period. The bucket lifecycle rule (`events/`, maximum object
lifetime) is the final bound, not immediate cleanup.

## Failure, revocation, and rollback

- Missing configuration, invalid signatures, unavailable R2 checksum metadata, and transient
  inspection failures remain fail-closed. Transient inspection keeps the item `validating`; it does
  not accept it.
- A compromised retrieval key pair is replaced on both sides; old requests then fail immediately. A
  compromised signer/R2 credential disables new signing first. Already issued capabilities expire
  within the canonical TTL.
- To suspend one event, disable its space from the admin surface. To suspend all uploads, disable
  only the Sign Worker route or its verification configuration. To suspend retrieval, disable only
  the Retrieval Worker route or its verification configuration. Preserve the private bucket and
  cleanup lifecycle unless a separately authorized incident action says otherwise.
- Do not change a printed QR, the apex redirect, `www` hosting, unrelated DNS, or other event data
  during rollback. A public slug is immutable by design.

## Sanitized Staging proof table

Every live result starts `UNVERIFIED`. Use only `VERIFIED`, `FAILED`, or `UNVERIFIED`; never infer
success from repository files or local tests.

| Boundary        | Required proof                                                                                        | Initial state |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------- |
| Database        | Migration versions, RLS enabled, grants denied to browser roles, RPCs callable only by service role   | UNVERIFIED    |
| Private R2      | Private bucket, Worker-only upload/retrieval, no listing/guessed read, exact lifecycle                | UNVERIFIED    |
| Worker auth     | Missing/stale/wrong-audience/tampered envelopes fail without object metadata                          | UNVERIFIED    |
| Space isolation | A session of one space cannot read, upload, or recover in another space                               | UNVERIFIED    |
| Window          | Reservations rejected before opening, after closing, and for a disabled space                         | UNVERIFIED    |
| Upload          | Synthetic photo/video, checksum persistence, one accepted copy, duplicate cleanup, interruption/retry | UNVERIFIED    |
| Guest isolation | Recovery, own accepted preview, edit, delete, quota, revocation, cross-session media ID denied        | UNVERIFIED    |
| Owner isolation | Owner list/preview/download succeeds; manager, non-member, super-admin-only, anonymous denied         | UNVERIFIED    |
| Retrieval       | Range seeking, attachment, deleted/rejected/duplicate denied, no signed GET or key exposure           | UNVERIFIED    |
| Cleanup         | Abandoned reservation, duplicate, rejected, deleted and retention-expired objects physically removed  | UNVERIFIED    |
| Export          | All accepted objects emitted in bounded encrypted batches; Web Crypto absence fails closed            | UNVERIFIED    |
| Phones          | Current iOS Safari and Android Chrome over mobile and shared Wi-Fi, including a 60-second video       | UNVERIFIED    |
| Operations      | Aggregate request/storage budget, sampled PII-free logs, audit retention, key revocation              | UNVERIFIED    |

Allowed evidence: command name and status, migration version, redacted deployment revision,
aggregate metrics, browser/device version, HTTP status/code, and audit action name. Prohibited
evidence: guest media, PII, object keys, signed URLs, recovery codes, request bodies, tokens,
secrets, and provider account or project IDs.

## Repository validation

Run and record exact results separately from Staging proof:

```text
pnpm test:memories
pnpm type-check
pnpm build:app
pnpm validate:changed
pnpm db:disposable:reset
pnpm db:disposable:test
pnpm db:disposable:memories-concurrency
pnpm worker:memories:types
pnpm worker:memories:dry-run
git diff --check
```

A successful repository handoff may be `REPOSITORY_READY`; only owner-operated Staging proof may be
`STAGING_VERIFIED`. Production requires independent P-256 pairs and capability secret, explicit
human authorization, and a separate validation handoff.
