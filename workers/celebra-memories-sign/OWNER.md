# Valentina Memories — owner handoff

This is the authoritative operational handoff for the Valentina Memories capture pilot. Production
Cloudflare, R2, Vercel, DNS, and credential actions are owner-only. Do not execute them from an
agent session.

## Repository state

- Branch: `feat/valentina-memories-capture`
- HEAD: `df75a853943ef49fccfeab757277e91867f73d07` — point-in-time snapshot of the reviewed
  checkout; superseded by the immutable SHA returned after the nine-path commit
- Candidate scope: this handoff uses only the current HEAD and the nine approved release-candidate
  paths below; no other branch is required or included.
- Working-tree scope: the current task changes only the Valentina signer contract/client tests and
  this handoff, the active plan, and `CHANGELOG.md`.
- Git staging is manually owner-managed and intentionally excluded from agent reconciliation. At the
  latest status read, `git diff --cached --name-status` reported all nine approved paths, while
  `git diff --name-status` reported only the active plan and this handoff as having additional
  working-tree edits. Re-read `git status --short --branch` immediately before authorization.
- Final status must be re-read with `git status --short --branch` before this handoff is accepted.

The repository implementation is complete only when the repository gates in this handoff pass.
Operational readiness remains `OWNER_ACTION_REQUIRED` until every owner proof below is independently
verified.

## Release-candidate gate

The current checkout may contain user-owned staged and unstaged changes. It is not a deployable
release candidate. Before any Cloudflare, Vercel, DNS, or Production action, reconcile only these
nine paths against the current HEAD:

- `.agent/plans/active/valentina-memories-qr.md`
- `CHANGELOG.md`
- `src/components/memories/ValentinaMemoriesCapture.tsx`
- `src/lib/memories/valentina-memories-client.ts`
- `tests/unit/celebra-memories-sign-config.test.ts`
- `tests/unit/celebra-memories-sign.test.ts`
- `tests/unit/valentina-memories-capture.test.tsx`
- `workers/celebra-memories-sign/OWNER.md`
- `workers/celebra-memories-sign/src/env.ts`

Confirm `git diff HEAD --name-only` contains exactly those nine paths, inspect the combined diff,
and rerun every repository validation command below. No other path may enter the release candidate.
Do not deploy from the mixed checkout.

After explicit current-task Git authorization, create one immutable commit containing exactly that
approved nine-path diff. Confirm `git diff --cached --name-only` before committing, then return the
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
through Vercel or the signing Worker. The page has no gallery, list, read, or host-retrieval API.

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

### 7. Run owner proofs and real-phone smoke

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
3. If credentials may have been exposed, revoke or rotate the scoped R2 token and update Worker
   secrets through the provider interface. Never place credentials in repository evidence.
4. Existing presigned URLs can remain valid only until their maximum 300-second TTL. Do not publish
   them during rollback.
5. To restore service, redeploy the signer, restore the exact Vercel public value, and repeat the
   required proofs. Do not regenerate the printed QR.

## Sanitized production proof table

All results start as `PENDING_OWNER`. Do not paste credentials, signed URLs, object keys, private
identifiers, guest media, request bodies, PII, or raw provider output into returned evidence.

| Proof                                 | Owner check                                                                                              | Sanitized evidence                                                              | Result        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------- |
| Private bucket                        | Dashboard or `wrangler r2 bucket list`; confirm private `celebra-memories`                               | Bucket name and privacy state only                                              | PENDING_OWNER |
| Exact CORS                            | `wrangler r2 bucket cors list celebra-memories`                                                          | Origin/method/header contract matches; no raw account data                      | PENDING_OWNER |
| Exact lifecycle                       | `wrangler r2 bucket lifecycle list celebra-memories`                                                     | Prefix and 30-day policy match                                                  | PENDING_OWNER |
| Worker deployment                     | DNS/deployment check for `memories.celebra-me.com` and `/sign/valentina`                                 | Host/path reachable; no deployment ID or private identifier                     | PENDING_OWNER |
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
| Host retrieval                        | R2 dashboard operator retrieval under `events/valentina/`                                                | Prefix retrieval confirmed; no object name, URL, or media                       | PENDING_OWNER |

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
