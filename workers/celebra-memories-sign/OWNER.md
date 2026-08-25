# Owner apply — celebra-memories signer

Production Cloudflare mutations stay owner-only. Do not run these commands from an agent session.
This file records the Goal 1 apply sequence and the proof checklist required before Goal 2.

## Locked Goal 2 public value

```text
PUBLIC_VALENTINA_MEMORIES_SIGN_URL=https://memories.celebra-me.com/sign/valentina
```

Do not invent a second sign URL. The same value lives in
`src/data/valentina-memories-upload.contract.ts` as `VALENTINA_MEMORIES_PRODUCTION_SIGN_URL`.

## Do not change

- Existing apex → `www` 308
- `www` proxying, Vercel hosting, or site-wide DNS ownership
- Printed QR payload `https://celebra-me.com/r/valentina`
- `src/pages/r/valentina.astro`

Add only the Worker custom hostname `memories.celebra-me.com`.

## 1. Private reusable bucket

Create one private bucket named `celebra-memories`. Do not create a Valentina-specific bucket. Do
not enable public access, custom domains on the bucket, or public object ACLs.

```text
npx wrangler r2 bucket create celebra-memories
```

## 2. Narrow R2 API token

Create an R2 API token scoped to `celebra-memories` only.

Cloudflare's dashboard does not offer an Object Write-only permission. Use the narrowest
write-capable option:

- Permission: **Object Read & Write**
- Scope: bucket `celebra-memories` only
- Do not use Admin Read or Admin Read & Write

The Worker only signs PUT URLs. It never lists, reads, or deletes objects. Host retrieval uses
separate operator credentials in the R2 dashboard, not this token.

Store these as Worker secrets only:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET=celebra-memories`

## 3. Production CORS

File: `r2-cors.production.json`

- Origin: `https://www.celebra-me.com`
- Method: `PUT`
- Header: `Content-Type`

```text
npx wrangler r2 bucket cors set celebra-memories --file workers/celebra-memories-sign/r2-cors.production.json
npx wrangler r2 bucket cors list celebra-memories
```

## 4. Pilot retention

File: `r2-lifecycle.production.json`

Objects under `events/valentina/` expire 30 days after upload. Incomplete multipart uploads abort
after 1 day. This is the entire retention model for the pilot — do not add a database-backed
lifecycle.

```text
npx wrangler r2 bucket lifecycle set celebra-memories --file workers/celebra-memories-sign/r2-lifecycle.production.json
npx wrangler r2 bucket lifecycle list celebra-memories
```

## 5. Worker secrets and deploy

From the repository root, after copying `.dev.vars.example` only for local `wrangler dev`:

```text
npx wrangler secret put R2_ACCOUNT_ID --config workers/celebra-memories-sign/wrangler.json
npx wrangler secret put R2_ACCESS_KEY_ID --config workers/celebra-memories-sign/wrangler.json
npx wrangler secret put R2_SECRET_ACCESS_KEY --config workers/celebra-memories-sign/wrangler.json
npx wrangler secret put R2_BUCKET --config workers/celebra-memories-sign/wrangler.json
npx wrangler deploy --config workers/celebra-memories-sign/wrangler.json
```

`wrangler.json` binds the custom domain `memories.celebra-me.com` and disables `*.workers.dev`.
Confirm DNS for that hostname only.

Local development:

```text
pnpm worker:memories-sign:dev
```

## Upload window

Signing is rejected outside this interval (Worker-enforced):

- opens: `2026-08-27T06:00:00.000Z` (00:00 on 27 Aug, America/Mexico_City)
- closes: `2026-09-04T06:00:00.000Z` exclusive (00:00 on 4 Sep)

## 6. Production proofs

Record evidence here before Goal 2 starts. Automated tests must not use Production credentials.

Proofs that require HTTP 200 + a successful PUT are only possible **after the window opens**.
Bucket, CORS, retention, hostname, 4xx, and QR-route proofs can be recorded immediately.

| Proof                                                        | Command or check                                                                          | Result        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------- |
| Private `celebra-memories` bucket exists                     | R2 dashboard or `wrangler r2 bucket list`                                                 | pending owner |
| Production CORS applied                                      | `wrangler r2 bucket cors list celebra-memories`                                           | pending owner |
| Retention policy applied                                     | `wrangler r2 bucket lifecycle list celebra-memories`                                      | pending owner |
| Worker live at `memories.celebra-me.com`                     | DNS + `wrangler deployments list`                                                         | pending owner |
| Allowed small JPEG sign returns 200 + PUT URL                | `POST /sign/valentina` with production Origin; only after the window opens                | pending owner |
| Disallowed MIME returns 4xx                                  | `POST` with `mimeType: application/pdf`                                                   | pending owner |
| Oversized declared size returns 4xx                          | `POST` with image MIME and `sizeBytes` > 20 MB                                            | pending owner |
| Unsupported routes/methods unavailable                       | `GET /`, `GET /sign/valentina`, `DELETE /sign/valentina`                                  | pending owner |
| Manual PUT of a test JPEG succeeds under `events/valentina/` | `curl -X PUT` to the signed URL with matching `Content-Type`; only after the window opens | pending owner |
| Object is not publicly readable or listable                  | Guessed HTTPS GET / list endpoint without credentials                                     | pending owner |
| Existing QR route still resolves                             | `https://celebra-me.com/r/valentina` → current `/r/valentina` page                        | pending owner |

Example sign request (owner terminal, Production origin required):

```text
curl -sS -X POST "https://memories.celebra-me.com/sign/valentina" \
  -H "Origin: https://www.celebra-me.com" \
  -H "Content-Type: application/json" \
  --data "{\"mimeType\":\"image/jpeg\",\"sizeBytes\":1024}"
```
