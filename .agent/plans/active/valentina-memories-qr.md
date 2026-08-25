---
title: Valentina Memories QR — party capture on Cloudflare R2
status: active
created: 2026-08-05
updated: 2026-08-25
type: implementation
related_docs:
  - docs/invitations/valentina-hernandez.md
  - src/data/valentina-memories.data.ts
  - src/data/valentina-memories-upload.contract.ts
  - workers/celebra-memories-sign/OWNER.md
---

# Valentina Memories — party capture

**Expected result on 2026-08-29:** a guest scans the existing QR, lands on `/r/valentina`, uploads a
photo or a capped video from the phone, sees “se guardó”, and the object appears in Cloudflare R2.
The host retrieves files from R2. The page never lists the bucket.

The printed QR, the Astro route, and the invitation Cloudinary pipeline are already done. Do not
re-audit them. Do not regenerate the QR.

## Closed decisions (owner)

| Decision       | Close                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QR payload     | Keep `https://celebra-me.com/r/valentina`. Do not regenerate assets.                                                                                        |
| App origin     | `/r/valentina` stays on the current Vercel deploy. Do not migrate Astro to Pages/Workers.                                                                   |
| Host rule      | Existing site-wide Cloudflare 308 `celebra-me.com/*` → `https://www.celebra-me.com/$1` stays as-is. Goal 1 must not change apex/`www`/Vercel/DNS ownership. |
| Storage        | One reusable private R2 bucket: `celebra-memories`. Not Cloudinary, not Supabase Storage, not `invitation-assets`.                                          |
| Upload path    | Phone → presigned PUT to R2. Worker `celebra-memories-sign` only signs. File bytes never enter Vercel or the Worker.                                        |
| Media          | JPEG/PNG/WebP/HEIC/HEIF ≤ 20 MB. MP4/QuickTime ≤ 80 MB. Declared-size check is a pilot safeguard; the Worker never receives the uploaded body.              |
| Access         | Anyone who opens the route. No PIN, no RSVP. Coarse Workers Rate Limiting binding: 10 requests / 60 s. Not an exact per-user quota.                         |
| Guest UI       | Confirmation + “subir otra”. No public gallery, no live wall, no object listing API.                                                                        |
| Host retrieval | R2 dashboard / operator credentials. No host UI in these goals.                                                                                             |
| Object keys    | `events/valentina/<uuid>.<ext>`. No guest name, phone, or RSVP id in the key or metadata.                                                                   |
| Presign TTL    | ≤ 5 minutes, one object, PUT only. Bind `Content-Type` into the signature.                                                                                  |
| CORS           | Production origin `https://www.celebra-me.com` only. R2 CORS: `PUT` + `Content-Type`.                                                                       |
| Sign URL       | `PUBLIC_VALENTINA_MEMORIES_SIGN_URL=https://memories.celebra-me.com/sign/valentina`. Goal 2 must not rediscover or invent this value.                       |
| Retention      | Owner-applied R2 lifecycle: expire `events/valentina/` objects after 30 days. No database-backed lifecycle.                                                 |
| Page metadata  | Stay `noindex`. Spanish “usted”. SCSS only.                                                                                                                 |

## Non-goals

- Guest capture UI or edits to `src/pages/r/valentina.astro`
- QR regeneration
- Cloudflare Stream, image resizing, or a second transcoding pipeline
- Generalized `/r/[slug]` memories platform
- Changes to `/xv/valentina-hernandez` or invitation `prod:apply`
- Cloudinary unsigned presets or `PUBLIC_CLOUDINARY_*`
- An Astro `/api` that receives the file
- Public list/get of R2 objects
- Site hosting migration, apex redirect migration, or orange-clouding `www`
- Production database operations

## Two goals (do not expand)

### Goal 1 — Cloudflare upload contract

Repository contract is implemented:

- SSOT: `src/data/valentina-memories-upload.contract.ts`
- Sign-only Worker: `workers/celebra-memories-sign/`
- Owner apply + proofs: `workers/celebra-memories-sign/OWNER.md`

Do not edit the Astro page. Production Cloudflare mutations remain owner-only.

**Handoff to Goal 2 (required artifact, not a search task):**

```text
PUBLIC_VALENTINA_MEMORIES_SIGN_URL=https://memories.celebra-me.com/sign/valentina
```

- Allowed MIME list and max bytes: import the upload contract
- Object-key prefix: `events/valentina/`
- CORS origin: `https://www.celebra-me.com`
- Owner proofs in `OWNER.md` must be filled before Goal 2 starts

Goal 2 must consume this artifact. It must not invent a second upload URL or a Vercel proxy.

### Goal 2 — Replace the placeholder with capture

Repository capture is implemented and locally validated. Production event readiness is not.

## Handoff — Goal 2 repository complete, owner gates open

### Current state

Goal 1 Worker/contract and Goal 2 guest capture are in the `dev-local` working tree, uncommitted
on `dev-local` (HEAD `00a2cf06`). `/r/valentina` is a prerendered noindex capture page. Gate A
owner proofs in `workers/celebra-memories-sign/OWNER.md` remain `pending owner`. Gate B and the
real-phone Production smoke cannot start until `2026-08-27T06:00:00.000Z`.

### Completed work

- Shared upload contract: `src/data/valentina-memories-upload.contract.ts`
- Sign-only Worker: `workers/celebra-memories-sign/`
- Capture island: `src/components/memories/ValentinaMemoriesCapture.tsx` (`client:load`)
- Browser helpers: `src/lib/memories/valentina-memories-client.ts`
- Page + copy: `src/pages/r/valentina.astro`, `src/data/valentina-memories.data.ts`
- Env contract: `.env.example`, `src/env.d.ts`, `docs/env-workflow.md`
- Status-page styles only; invitation theme untouched
- Tests updated in place (route, capture, QR copy, focused Playwright)

Consume, do not invent:

```text
PUBLIC_VALENTINA_MEMORIES_SIGN_URL=https://memories.celebra-me.com/sign/valentina
```

### Evidence

- Page stays `export const prerender = true`, robots `noindex`, route `/r/valentina`
- Missing/invalid sign URL fails closed (no file input)
- Client validates MIME/size from the contract and rejects video > 60 s before `POST /sign`
- Sign payload is `{ mimeType, sizeBytes }`; PUT uses the signed `Content-Type`
- File bytes never enter Vercel or the Worker
- UI does not render `objectKey`, bucket names, R2 URLs, PII, or object lists
- QR assets unchanged: `public/qr/valentina-memories.{svg,png}`
- Local browser: capture UI, unsupported-PDF error + retry, invitation and home still load
- Prerendered HTML hydrates the island with the production sign URL when that env is present

### Validation passed

- Focused Jest (route, capture, upload contract, env, QR): 40 passed
- `pnpm exec playwright test tests/e2e/valentina-memories-route.spec.ts`: 2 passed
- `pnpm qr:valentina-memories -- --check`
- `pnpm type-check`
- `pnpm build:app` prerenders `/r/valentina/index.html`
- `pnpm validate:changed`
- `git diff --check` (CRLF warnings only)

### Validation failed

None in the repository gates above.

### Validation intentionally not run

- Production `200 + PUT` (Gate B) — window closed until 2026-08-27 00:00 America/Mexico_City
- Real-phone Production smoke
- Unrelated invitation publication, database mutation, screenshot corpus, hosted CI e2e
- `pnpm agent:git-safety:finish` — no session baseline existed

### Unresolved uncertainty

- Whether Gate A owner proofs (bucket, CORS, lifecycle, hostname, 4xx, `upload_window_closed`)
  were recorded in `OWNER.md` in a separate owner terminal
- Whether Production Vercel already has `PUBLIC_VALENTINA_MEMORIES_SIGN_URL`

### Residual risks

- Local/CI build without the public sign URL prerenders the unavailable state
- Origin allowlist is `https://www.celebra-me.com` only; localhost cannot complete a real sign
- Declared-size check is a pilot safeguard; the Worker never sees the uploaded body
- Uncommitted working-tree changes can drift before deploy

### Applicable authorization

- No Git write (no commit/push)
- No Production Cloudflare or database mutation
- No QR regeneration

### Branch / commit reference

- Worktree lane: `dev-local`
- Branch: `dev-local`
- HEAD: `00a2cf06` (no Goal 2 commit)
- Changes remain staged/unstaged/untracked in the working tree

### Next responsibility (owner)

1. Review and commit Goal 2 when authorized (do not put Goal identifiers in the commit message).
2. Confirm Gate A rows in `workers/celebra-memories-sign/OWNER.md`.
3. Deploy the app with
   `PUBLIC_VALENTINA_MEMORIES_SIGN_URL=https://memories.celebra-me.com/sign/valentina`.
4. After the window opens: Gate B — valid sign `200`, JPEG PUT, object under `events/valentina/`,
   not publicly listable/readable.
5. Party smoke: scan the committed PNG → apex/`www` → `/r/valentina` 200 → one photo and one
   under-cap video from a real phone → both keys in R2 → page has no object list.
6. Host retrieval: R2 dashboard, bucket `celebra-memories`, prefix `events/valentina/`.
7. Print only after that smoke. Do not regenerate the QR.

## Agent constraints

- Implement only the closed table. Do not reopen storage, host, gallery, or QR payload.
- Do not change the existing apex→`www` redirect or site-wide Cloudflare routing.
- Do not reuse dashboard intake or invitation storage adapters.
- No Production database mutation. Git only if the owner authorizes the exact operation.
- Verification: Goal 1 Worker unit tests + `pnpm validate:changed`; owner proofs in
  `workers/celebra-memories-sign/OWNER.md`. Goal 2 focused Jest/Playwright on the page + a
  signed-upload happy path against a stub Worker; `pnpm qr:valentina-memories -- --check` still
  passes.
