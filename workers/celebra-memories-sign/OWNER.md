# Valentina Memories — owner Staging handoff

This runbook covers owner-operated Staging rollout and sanitized proof. Repository readiness does
not authorize database, Cloudflare, R2, Vercel, DNS, Preview, Production, or Git mutations.

The authoritative limits, MIME rules, paths, upload window, retention, quotas, and archive bounds
live only in:

- `src/data/valentina-memories-upload.contract.ts`
- `src/data/valentina-memories-media.contract.ts`
- `src/data/valentina-memories-private-request.contract.ts`

Do not repeat or override those values in provider notes, UI code, SQL, or deployment scripts.

## Required security boundary

- The bucket remains private. Disable `r2.dev`, public custom-domain access, public listing, public
  GET, browser credentials, and object ACLs.
- Guests reach the same-origin app API. The app authenticates the opaque guest session, reserves
  quota atomically, and privately requests one short-lived PUT capability. File bytes still travel
  directly from the browser to R2.
- The browser receives the capability URL, its required headers, and expiration only. It never
  receives an object key as a separate field.
- Retrieval starts with a browser media ID. The app authenticates either the owning guest session
  for an inline accepted item or the dashboard event `owner` for organizer access, resolves the
  object key internally, and signs one private Worker request.
- The Retrieval Worker reads or deletes the exact object through its R2 binding. It never calls
  `list()`, returns a signed GET URL, or accepts an object key from the browser.
- Managers, anonymous users, other guest sessions, and superadmins without event-owner membership
  have no organizer access.

## Credential ownership

Use the canonical
[Valentina Memories environment cheatsheet](../../docs/env-workflow.md#valentina-memories-environment-cheatsheet)
for every variable name, owner, environment, and value source. Do not reproduce that inventory in
this runbook. Generate two independent ECDSA P-256 pairs per hosted environment; private keys stay
in Vercel, Cloudflare receives only the public keys, and R2 credentials stay bucket-scoped in the
Sign Worker.

Wrangler deployment authentication is an operator boundary, not Worker runtime configuration.
Interactive owner runs use `wrangler login`. This rollout does not create deployment tokens or use
Cloudflare Secrets Store.

Rotate both request-signing pairs and the R2 credentials every 90 days, or immediately after
suspected exposure. For a request-signing pair, publish the replacement public key and private key
in a coordinated fail-closed window, verify it, then remove the previous key. For R2 exposure,
disable signing first, rotate the bucket-scoped credentials, deploy, verify, and revoke the previous
credentials. Never paste keys, tokens, signed URLs, recovery codes, provider identifiers, or object
names into evidence.

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
5. Configure the five Vercel Preview server-only values from the canonical cheatsheet, deploy the
   app/backend, and enable the daily cleanup cron. Its endpoint must accept only
   `Authorization: Bearer <CRON_SECRET>`.
6. Configure the bucket-scoped Staging Sign Worker values, deploy it last with `--env staging`, and
   confirm the configured Staging rate-limiter namespace is available. Block rollout if Cloudflare
   rejects it. Then verify requests require a fresh ECDSA envelope and rate-limit by authenticated
   session ID.
7. Verify R2 CORS permits only the stable Vercel Preview origin, `PUT`, and the headers present in
   `r2-cors.production.json`. Verify lifecycle matches `r2-lifecycle.production.json`.
8. Run the sanitized Staging matrix below with synthetic, non-PII media only. Run phone checks only
   after the canonical upload window opens.

Cloudflare Free-account capacity is a budget gate, not an application quota. Before rollout, the
owner must confirm account-wide R2 storage and operations plus Workers daily requests and CPU remain
below the then-current provider limits. The Cloudflare rate-limiter binding is eventual abuse
protection; Supabase RPCs remain the authoritative quota and concurrency boundary.

If the account security scanner reports TAC `unknown` or omits grants, reconnect or reauthorize the
scanner for read access and rerun it. Until grants and protected results are visible, security
coverage is `UNVERIFIED`; `.env` changes cannot repair that account-level state.

## Organizer retrieval procedure

1. The organizer signs in through the existing dashboard session.
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
headers, or media. The daily job must delete physically scheduled objects in small reclaimable
batches, anonymize inactive guest profiles after their last object is gone, and purge audit rows
after the canonical audit retention period. R2 lifecycle is the final bound, not immediate cleanup.

## Failure, revocation, and rollback

- Missing configuration, invalid signatures, unavailable R2 checksum metadata, and transient
  inspection failures remain fail-closed. Transient inspection keeps the item `validating`; it does
  not accept it.
- A compromised retrieval key pair is replaced on both sides; old requests then fail immediately. A
  compromised signer/R2 credential disables new signing first. Already issued PUT capabilities
  expire within the canonical TTL.
- To suspend uploads, disable only the Sign Worker route or its verification configuration. To
  suspend retrieval, disable only the Retrieval Worker route or its verification configuration.
  Preserve the private bucket and cleanup lifecycle unless a separately authorized incident action
  says otherwise.
- Do not change the printed QR, apex redirect, `www` hosting, unrelated DNS, or other event data
  during rollback.

## Sanitized Staging proof table

Every live result starts `UNVERIFIED`. Use only `VERIFIED`, `FAILED`, or `UNVERIFIED`; never infer
success from repository files or local tests.

| Boundary        | Required proof                                                                                        | Initial state |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------- |
| Database        | Migration versions, RLS enabled, grants denied to browser roles, RPCs callable only by service role   | UNVERIFIED    |
| Private R2      | Private bucket, public endpoints disabled, no listing/guessed read, exact CORS and lifecycle          | UNVERIFIED    |
| Worker auth     | Missing/stale/wrong-audience/tampered envelopes fail without object metadata                          | UNVERIFIED    |
| Upload          | Synthetic photo/video, checksum persistence, one accepted copy, duplicate cleanup, interruption/retry | UNVERIFIED    |
| Guest isolation | Recovery, own accepted preview, edit, delete, quota, revocation, cross-session media ID denied        | UNVERIFIED    |
| Owner isolation | Owner list/preview/download succeeds; manager, non-member, superadmin-only, anonymous denied          | UNVERIFIED    |
| Retrieval       | Range seeking, attachment, deleted/rejected/duplicate denied, no signed GET or key exposure           | UNVERIFIED    |
| Cleanup         | Expired reservation, duplicate, rejected and deleted objects physically removed; lease retry works    | UNVERIFIED    |
| Export          | All accepted objects emitted in bounded encrypted batches; Web Crypto absence fails closed            | UNVERIFIED    |
| Phones          | Current iOS Safari and Android Chrome over mobile and shared Wi-Fi                                    | UNVERIFIED    |
| Operations      | Aggregate request/storage budget, sampled PII-free logs, audit retention, key revocation              | UNVERIFIED    |
| Scanner         | TAC status known and protected read grants/results present                                            | UNVERIFIED    |

Allowed evidence: command name and status, migration version, redacted deployment revision,
aggregate metrics, browser/device version, HTTP status/code, and audit action name. Prohibited
evidence: guest media, PII, object keys, signed URLs, recovery codes, request bodies, tokens,
secrets, and provider account or project IDs.

## Repository validation

Run and record exact results separately from Staging proof:

```text
pnpm test:memories-sign
pnpm exec playwright test tests/e2e/valentina-memories-route.spec.ts
pnpm qr:valentina-memories -- --check
pnpm type-check
pnpm build:app
pnpm validate:changed
pnpm ops check-links
pnpm db:disposable:reset
pnpm db:disposable:test
pnpm db:disposable:memories-concurrency
pnpm worker:memories:types
pnpm worker:memories:dry-run
git diff --check
```

A successful repository handoff may be `REPOSITORY_READY`; only owner-operated Staging proof may be
`STAGING_VERIFIED`. Production requires independent P-256 pairs and R2 credentials, explicit human
authorization, and a separate validation handoff.
