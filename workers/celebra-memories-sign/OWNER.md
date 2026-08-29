# Valentina Memories — owner handoff

This is the authoritative operational handoff for the Valentina Memories capture pilot. Production
Cloudflare, R2, Vercel, DNS, and credential actions are owner-only. Do not execute them from an
agent session.

## Repository state

- Branch: `feat/valentina-memories-capture`
- The working tree is `feat/valentina-memories-capture`; re-read the branch and HEAD immediately
  before any release decision. This handoff does not authorize staging or committing.
- Candidate scope: the Valentina upload contract, guest media catalog/session routes, organizer
  workspace and private retrieval Worker, focused tests, migration, styles, and this handoff.
- Working-tree scope must be reconciled by the owner against the reviewed diff before deployment; no
  unrelated path may enter a release candidate.
- Git staging is manually owner-managed and intentionally excluded from agent reconciliation.
  Re-read `git status --short --branch`, `git diff HEAD --name-only`, and the combined diff before
  authorization.
- Final status must be re-read with `git status --short --branch` before this handoff is accepted.

The repository implementation is complete only when the repository gates in this handoff pass.
Operational readiness remains `OWNER_ACTION_REQUIRED` until every owner proof below is independently
verified.

## Release-candidate gate

The current checkout may contain user-owned staged and unstaged changes. It is not a deployable
release candidate. Before any Cloudflare, Vercel, DNS, database, or Production action, reconcile the
complete Valentina diff against the current HEAD, inspect the combined diff, and rerun every
repository validation command below. Do not deploy from a mixed checkout.

After explicit current-task Git authorization, create one immutable commit containing exactly the
reviewed Valentina diff. Confirm `git diff --cached --name-only` before committing, then return the
result of `git rev-parse HEAD` and the commit's `git show --name-status --format=fuller` output with
any unrelated metadata sanitized. That immutable commit SHA is required before owner deployment; the
agent must not stage or commit it.

## Locked public contract

```text
PUBLIC_VALENTINA_MEMORIES_SIGN_URL=https://memories.celebra-me.com/sign/valentina
```

The same value is defined in `src/data/valentina-memories-upload.contract.ts` as
`VALENTINA_MEMORIES_PRODUCTION_SIGN_URL`. Do not derive it from the current host, Preview, DNS, or a
Vercel API route.

| Contract                  | Required value                                                                    |
| ------------------------- | --------------------------------------------------------------------------------- |
| App route                 | `/r/valentina`, prerendered, `noindex`                                            |
| Production browser origin | `https://www.celebra-me.com`                                                      |
| Signer hostname and path  | `https://memories.celebra-me.com/sign/valentina`                                  |
| R2 bucket                 | Private `celebra-memories`                                                        |
| R2 prefix                 | `events/valentina/`                                                               |
| Image policy              | JPEG, PNG, WebP, HEIC, or HEIF; maximum 20 MiB                                    |
| Video policy              | MP4 or QuickTime; maximum 80 MiB and 60 seconds                                   |
| Upload window             | `2026-08-27T06:00:00.000Z` inclusive through `2026-09-04T06:00:00.000Z` exclusive |
| Presign                   | PUT only, `Content-Type` bound, maximum 300 seconds, one UUID-based object        |
| Rate limit                | `SIGN_RATE_LIMITER`, 10 requests per 60 seconds, coarse binding                   |
| Retention                 | `events/valentina/` objects expire after 30 days                                  |
| QR target                 | `https://celebra-me.com/r/valentina`; existing assets stay unchanged              |

File bytes go directly from the browser to R2 using the presigned PUT. They must never transit
through Vercel or the signing Worker. Guest metadata is session-scoped and object keys are omitted
from UI/API DTOs. Accepted media is previewed through an authenticated server route. Organizer
listing, moderation, and download use dashboard session authorization and the separate private
retrieval Worker; no public gallery, bucket listing, or browser R2 credentials exist.

## Owner-only apply order

Perform these actions in order and keep credentials in the provider interfaces only.

### 1. Create or confirm the private reusable bucket

Use one private bucket named `celebra-memories`. Do not enable public access, a bucket custom
domain, or public object ACLs.

```text
npx wrangler r2 bucket create celebra-memories
```

If the bucket already exists, treat the command's already-exists response as confirmation only after
the dashboard also shows it is private.

### 2. Create the narrow Worker token

Create an R2 API token scoped only to bucket `celebra-memories` with **Object Read & Write**,
because Cloudflare does not offer Object Write-only. Do not use Admin Read or Admin Read & Write.
Store only these values as Worker secrets:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET=celebra-memories`

The Worker only signs PUT URLs. Host retrieval uses separate operator credentials in the R2
dashboard; the Worker token must not be used for host retrieval.

### 3. Apply exact R2 CORS

Apply `r2-cors.production.json` to `celebra-memories` and confirm the result contains only the
production browser origin, `PUT`, and `Content-Type`.

```text
npx wrangler r2 bucket cors set celebra-memories --file workers/celebra-memories-sign/r2-cors.production.json
npx wrangler r2 bucket cors list celebra-memories
```

### 4. Apply the 30-day lifecycle

Apply `r2-lifecycle.production.json` and confirm that only the `events/valentina/` prefix is covered
by the 30-day expiration rule. Incomplete multipart uploads abort after one day. Do not add a
database-backed lifecycle.

```text
npx wrangler r2 bucket lifecycle set celebra-memories --file workers/celebra-memories-sign/r2-lifecycle.production.json
npx wrangler r2 bucket lifecycle list celebra-memories
```

### 5. Configure and deploy the signer

From the repository root, set the four Worker secrets and deploy the configuration in
`workers/celebra-memories-sign/wrangler.json`. It must use the custom hostname
`memories.celebra-me.com`, disable `*.workers.dev`, and serve `/sign/valentina`.

```text
npx wrangler secret put R2_ACCOUNT_ID --config workers/celebra-memories-sign/wrangler.json
npx wrangler secret put R2_ACCESS_KEY_ID --config workers/celebra-memories-sign/wrangler.json
npx wrangler secret put R2_SECRET_ACCESS_KEY --config workers/celebra-memories-sign/wrangler.json
npx wrangler secret put R2_BUCKET --config workers/celebra-memories-sign/wrangler.json
npx wrangler deploy --config workers/celebra-memories-sign/wrangler.json
```

Confirm DNS and deployment status for this hostname only. Do not change the existing apex → `www`
308, `www` proxying, Vercel hosting, or site-wide DNS ownership.

### 6. Configure the Vercel public signer value

In the Production Vercel environment, set the browser-safe variable to the exact locked value above
and redeploy through the normal owner release procedure. Do not add `PUBLIC_R2_*`, Worker secrets,
or a Vercel upload proxy.

### 7. Apply the catalog and private retrieval boundary

Apply `supabase/migrations/20260828000000_valentina_memories_catalog.sql` through the guarded
database workflow. It creates opaque guest sessions, the media catalog, and an append-only audit
table (audit expiry is set by the canonical media contract); it does not create a public Storage
bucket or an R2 listing surface. The owner must verify that the scheduled database retention job
purges expired audit rows without touching active media metadata.

Deploy `workers/celebra-memories-retrieve/wrangler.json` with a private R2 binding to the existing
`celebra-memories` bucket and one Worker secret named `RETRIEVAL_SHARED_SECRET`. Configure
`VALENTINA_MEMORIES_RETRIEVAL_URL` in Vercel Production to the exact HTTPS retrieval path and
`VALENTINA_MEMORIES_RETRIEVAL_SHARED_SECRET` to the same value. Keep both values out of the
repository, browser, logs, and evidence.

The retrieval Worker accepts only short-lived HMAC-authenticated `POST` requests from the server.
The app first authenticates the dashboard session (organizer or super-admin), verifies membership
for `valentina-hernandez`, loads the media row by opaque ID, requires `accepted`, and then sends the
object key server-to-Worker. The browser receives only the streamed bytes. Guest previews use the
same Worker through a session-scoped app route and never bypass the session-to-media ownership
check.

#### Organizer download procedure

1. The organizer signs in to the existing dashboard. The app rejects missing/expired sessions and
   accepts only the event owner membership (super-admin is the explicit break-glass role).
2. The dashboard requests the Valentina catalog by the fixed event route. The API returns media ID,
   status, MIME, size, caption, and timestamps only; it never returns `object_key`.
3. For preview/download, the browser requests the media ID route. The server rechecks the owner
   session, requires `accepted` and not `deleted`, loads the object key server-side, and signs a
   one-request HMAC envelope to the retrieval Worker. Preview uses `inline`; download uses
   `attachment`.
4. The retrieval Worker accepts only `POST /retrieve/valentina`, a fresh timestamp, a valid HMAC, an
   allowlisted MIME/object-key pair under the Valentina prefix, and `inline`/`attachment` mode. It
   performs `R2.get` through its private bucket binding and streams bytes with `no-store` and
   `nosniff`; it never lists the bucket or emits a signed URL.
5. The app records a sanitized `preview_requested` or `download_requested` audit event only after
   the Worker returns success. A missing object, revoked session, non-owner, non-accepted item,
   expired HMAC, or disabled Worker returns a non-success response with no metadata or bytes.

### 8. Run owner proofs and real-phone smoke

Run the checks below only after the window opens. Record only the sanitized status values
`VERIFIED`, `FAILED`, or `UNVERIFIED` in this file or the returned handoff. Missing, stale,
contradictory, or redacted-beyond-verification evidence remains `UNVERIFIED`.

## Rollback / disable

These are owner-only actions. Preserve the bucket and lifecycle policy unless a separate incident
decision authorizes their removal.

1. Remove the Production `PUBLIC_VALENTINA_MEMORIES_SIGN_URL` value in Vercel and redeploy. The
   prerendered page then fails closed and does not render an active file input.
2. If the signer itself must be disabled, detach or disable only the Worker custom hostname
   `memories.celebra-me.com`. Do not alter the apex redirect or `www` hosting.
3. If downloads/previews must be disabled, detach or disable only `memories-access.celebra-me.com`
   and remove the retrieval URL/secret from Vercel. Existing dashboard sessions then fail closed
   with no object bytes returned.
4. If credentials may have been exposed, revoke or rotate the scoped R2 token or retrieval HMAC
   secret through the provider interfaces. Never place credentials in repository evidence.
5. Existing presigned URLs can remain valid only until their maximum 300-second TTL. Do not publish
   them during rollback.
6. To restore service, redeploy the signer/retrieval Worker, restore the exact Vercel values, and
   repeat the required proofs. Do not regenerate the printed QR.

## Credential ownership and audit

- Cloudflare owns the scoped signer R2 token and the R2 bucket binding. The Vercel owner owns only
  the browser-safe signer URL and the server-side retrieval HMAC secret; neither is a browser
  credential.
- Rotate the signer token by creating a replacement with the same bucket-only scope, updating the
  four signer Worker secrets, deploying, verifying a fresh sign/PUT, then revoking the old token.
  Existing presigned PUTs may remain valid only until their five-minute maximum TTL.
- Rotate the retrieval HMAC by updating the Worker secret and the Vercel secret together, deploying
  both, and immediately repeating unauthorized/authorized retrieval proofs. Requests signed with the
  previous value fail closed after the change.
- Record only actor, media ID (redacted in external evidence), action, status, and timestamp in the
  audit table. Never log object keys, signed URLs, request bodies, guest recovery codes, or media.
- Keep audit rows through the canonical audit expiry and verify the owner-controlled retention job;
  object lifecycle remains the separate 30-day R2 rule.

## Sanitized production proof table

All results start as `PENDING_OWNER`. Do not paste credentials, signed URLs, object keys, private
identifiers, guest media, request bodies, PII, or raw provider output into returned evidence.

| Proof                                 | Owner check                                                                                              | Sanitized evidence                                                              | Result        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------- |
| Private bucket                        | Dashboard or `wrangler r2 bucket list`; confirm private `celebra-memories`                               | Bucket name and privacy state only                                              | PENDING_OWNER |
| Exact CORS                            | `wrangler r2 bucket cors list celebra-memories`                                                          | Origin/method/header contract matches; no raw account data                      | PENDING_OWNER |
| Exact lifecycle                       | `wrangler r2 bucket lifecycle list celebra-memories`                                                     | Prefix and 30-day policy match                                                  | PENDING_OWNER |
| Worker deployment                     | DNS/deployment check for `memories.celebra-me.com` and `/sign/valentina`                                 | Host/path reachable; no deployment ID or private identifier                     | PENDING_OWNER |
| Retrieval Worker deployment           | DNS/deployment check for `memories-access.celebra-me.com` and `/retrieve/valentina`                      | Host/path reachable; no deployment ID or private identifier                     | PENDING_OWNER |
| Catalog migration                     | Guarded database migration and table/RLS inspection                                                      | Tables exist, RLS is enabled, service-role-only policies match                  | PENDING_OWNER |
| Vercel public signer                  | Production env inspection                                                                                | Value matches the locked contract; do not repeat the value in evidence          | PENDING_OWNER |
| Allowed JPEG sign and direct PUT      | Production Origin, allowed JPEG, canonical window; sign returns 200 and matching direct PUT succeeds     | Status codes and contract match only; never return the signed URL or object key | PENDING_OWNER |
| Invalid origin rejected               | Sign request with an origin other than `https://www.celebra-me.com`                                      | Rejection status/code only                                                      | PENDING_OWNER |
| Invalid MIME rejected                 | Sign request with `application/pdf`                                                                      | Rejection status/code only                                                      | PENDING_OWNER |
| Oversized declaration rejected        | Sign request with image MIME and size above 20 MiB                                                       | Rejection status/code only                                                      | PENDING_OWNER |
| Unsupported routes/methods rejected   | `GET /`, `GET /sign/valentina`, and `DELETE /sign/valentina`                                             | 4xx status/code only                                                            | PENDING_OWNER |
| Unauthenticated object access blocked | Unauthenticated guessed read and list attempts                                                           | Not readable/listable; no URL or object name                                    | PENDING_OWNER |
| QR route resolution                   | Scan existing QR or open `https://celebra-me.com/r/valentina`; follow apex redirect and confirm page 200 | Route resolves to the noindex capture page                                      | PENDING_OWNER |
| Real-phone photo smoke                | One supported photo from a real phone during the window                                                  | UI confirmation and successful direct upload; no media or key                   | PENDING_OWNER |
| Real-phone video smoke                | One under-limit MP4 or QuickTime video from a real phone during the window                               | UI confirmation and successful direct upload; no media or key                   | PENDING_OWNER |
| Organizer authorization               | Owner session with event membership; manager, non-member, and unauthenticated requests                   | 401/403; no catalog metadata or bytes                                           | PENDING_OWNER |
| Organizer preview/download            | Authorized dashboard request for an accepted item; rejected/deleted item                                 | Inline/attachment bytes only for accepted item; no signed URL or key            | PENDING_OWNER |
| Guest ownership boundary              | Session A attempts Session B item ID and preview                                                         | 404/403; no metadata or bytes                                                   | PENDING_OWNER |
| Host retrieval                        | Authorized dashboard retrieval through the private Worker under `events/valentina/`                      | Prefix retrieval confirmed; no object name, URL, or media                       | PENDING_OWNER |

The owner must return this table with each result changed only to `VERIFIED`, `FAILED`, or
`UNVERIFIED`, plus concise sanitized evidence. Never report `VERIFIED` from a plan, local test, or
provider configuration file alone when the proof requires a live request or real phone.

## Repository validation

The agent must report exact commands and results separately from the owner proofs. The required
repository checks are:

```text
pnpm test:memories-sign
pnpm exec playwright test tests/e2e/valentina-memories-route.spec.ts
pnpm qr:valentina-memories -- --check
pnpm type-check
pnpm build:app
pnpm validate:changed
pnpm ops check-links
git diff --check
```

`pnpm run ci` is the broader repository gate when the environment permits it. It does not replace
the owner proofs. No merge, publication, or Production authorization is implied by repository
validation.
