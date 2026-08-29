---
title: Valentina Memories QR — party capture on Cloudflare R2
status: active
created: 2026-08-05
updated: 2026-08-28
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
- Keep the QR payload and committed QR assets unchanged.
- Do not mutate Cloudflare, R2, Vercel, DNS, databases, or Production configuration from the agent
  session.

## Repository state

Branch, HEAD, and staging scope are owned by the handoff — see
[`workers/celebra-memories-sign/OWNER.md`](../../../workers/celebra-memories-sign/OWNER.md)
("Repository state" and "Release-candidate gate"). No merge, rebase, cherry-pick, branch switch,
stage, commit, push, or publication is authorized by this plan.

## Repository completion

The repository portion is complete when the implementation, documentation, changelog, and required
validation gates pass. This includes fail-closed signer configuration, exact MIME/size/window/origin
controls, UUID-based PII-free keys, direct PUT semantics, no UI object exposure, and QR integrity.

## REGRESSION_DECISION

- Defect class `shared-contract`: `extend-existing-test` — the Worker test now rejects any
  configured R2 bucket other than the contract bucket.
- Defect class `local-behavior`: `extend-existing-test` — capture tests cover signer URL
  allowlisting, query/hash rejection, and normalized MIME values for both signing and direct PUT.
- Re-verification: the exact focused suites and `validate:changed` pass after these locks.

## Current status

- Repository status: `REPOSITORY_COMPLETE`; focused tests, Playwright, QR, type-check, build,
  `validate:changed`, link checks, and diff checks pass.
- Release-candidate status: `RELEASE_CANDIDATE_BLOCKED` until the owner explicitly authorizes the
  exact nine-path Git operation and returns an immutable commit SHA. The current mixed checkout must
  not be deployed.
- Git integration status: `GIT_INTEGRATION_DEFERRED`; merge, push, publication, and cross-branch
  integration remain outside scope.
- Read-only public observation on 2026-08-28: `https://celebra-me.com/r/valentina` returned `307` to
  the `www` host, and `https://www.celebra-me.com/r/valentina` returned `200` with `noindex` and the
  capture marker. `memories.celebra-me.com` returned DNS `ENOTFOUND` from this environment; this is
  not owner proof and keeps the operational gate open.
- Operational status: `OWNER_ACTION_REQUIRED` until the owner returns sanitized Production evidence.
- Final goal status: `OPERATIONALLY_VERIFIED` only after every proof and both real-phone smoke
  checks in `OWNER.md` are independently verified.

## Non-goals

Do not generalize this pilot into `/r/[slug]`, add a gallery/listing, reuse invitation storage,
modify `/xv/valentina-hernandez`, change the apex redirect or site hosting, regenerate the QR, or
perform database/Cloudflare/R2/Vercel/Production mutations.
