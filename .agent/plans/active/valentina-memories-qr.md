---
title: Valentina Memories QR — party capture on Cloudflare R2
status: active
created: 2026-08-05
updated: 2026-08-29
type: implementation
related_docs:
  - docs/invitations/valentina-hernandez.md
  - src/data/valentina-memories.data.ts
  - src/data/valentina-memories-upload.contract.ts
  - workers/celebra-memories-sign/OWNER.md
---

# Valentina Memories — repository and owner-gate tracking

The authoritative operational checklist, apply order, rollback, proof table, and evidence contract
live in [`workers/celebra-memories-sign/OWNER.md`](../../../workers/celebra-memories-sign/OWNER.md).
This plan tracks scope and status only; it must not duplicate that handoff.

## Scope

- Work exclusively on `feat/valentina-memories-capture`.
- Keep `/r/valentina` prerendered and `noindex`, with Spanish guest copy and no gallery/list API.
- Keep `src/data/valentina-memories-upload.contract.ts` as the browser/Worker contract SSOT.
- Keep browser → presigned PUT → private R2 as the only byte path.
- Keep `src/data/valentina-memories-media.contract.ts` as the single lifecycle/session/retrieval
  contract; it must import upload limits instead of redefining them.
- Provide an opaque guest session/recovery-code boundary, session-scoped catalog, status/moderation
  transitions, caption editing, deletion, and private guest previews.
- Provide an organizer dashboard workspace with membership authorization, moderation, metadata
  editing, soft deletion/restoration, audit events, and organizer-only download.
- Keep R2 retrieval behind the private HMAC-authenticated retrieval Worker; never return object keys
  or signed URLs to UI/API consumers.
- Keep the QR payload and committed QR assets unchanged.
- Do not mutate Cloudflare, R2, Vercel, DNS, databases, or Production configuration from the agent
  session.

## Repository state

Branch, HEAD, and staging scope are owned by the handoff — see
[`workers/celebra-memories-sign/OWNER.md`](../../../workers/celebra-memories-sign/OWNER.md)
("Repository state" and "Release-candidate gate"). No merge, rebase, cherry-pick, branch switch,
stage, commit, push, or publication is authorized by this plan.

## Repository completion

The repository portion is complete when the upload contract, catalog migration, guest/organizer
routes and UI, retrieval Worker, documentation, changelog, and focused validation gates pass. This
includes fail-closed signer/retrieval configuration, exact MIME/size/window/origin controls,
UUID-based PII-free keys, direct PUT semantics, session/event authorization, no UI object exposure,
append-only audit events, and QR integrity.

## REGRESSION_DECISION

- Defect class `shared-contract`: `extend-existing-test` — the Worker test now rejects any
  configured R2 bucket other than the contract bucket.
- Defect class `local-behavior`: `extend-existing-test` — capture tests cover signer URL
  allowlisting, query/hash rejection, and normalized MIME values for both signing and direct PUT.
- Re-verification: the exact focused suites and `validate:changed` pass after these locks.

## Current status

- Repository status: `REPOSITORY_COMPLETE_OWNER_GATED`; focused suites, Playwright, type-check,
  build, formatting, and `validate:changed` pass after the guest/organizer additions. The catalog
  migration and retrieval Worker remain owner-applied and live proof is unavailable.
- Release-candidate status: `RELEASE_CANDIDATE_BLOCKED` until the owner explicitly authorizes a
  reviewed Git operation and returns an immutable commit SHA. The working tree must not be deployed.
- Git integration status: `GIT_INTEGRATION_DEFERRED`; merge, push, publication, and cross-branch
  integration remain outside scope.
- Existing public-route observations and signer DNS checks are not owner proof; live catalog,
  retrieval, database, Cloudflare, Vercel, and real-phone evidence remain `UNVERIFIED`.
- Operational status: `OWNER_ACTION_REQUIRED` until the owner returns sanitized Production evidence.
- Final goal status: `OPERATIONALLY_VERIFIED` only after every proof and both real-phone smoke
  checks in `OWNER.md` are independently verified.

## Non-goals

Do not generalize this pilot into `/r/[slug]`, create a public gallery/listing, reuse invitation
storage, modify `/xv/valentina-hernandez`, change the apex redirect or site hosting, regenerate the
QR, or perform database/Cloudflare/R2/Vercel/Production mutations from the agent session.
