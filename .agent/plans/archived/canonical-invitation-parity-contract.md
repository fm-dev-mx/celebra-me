---
title: Canonical invitation parity contract
status: validated
created: 2026-08-19
updated: 2026-08-19
related_docs:
  - docs/core/content-parity-rsvp-isolation.md
  - docs/core/invitation-creation-contract.md
---

# Canonical Invitation Parity Contract — Goal 1

Conversation-scoped Goal 1 with a tracked handoff because later client migrations must consume
these invariants without repeating the semantic-parity audit.

## Task Contract

- **Objective:** Establish the executable canonical managed invitation parity contract and close
  explainable Local / Preview / Production parity for the seven current registry client invitations.
- **Authorized actions:** Read-only Local / Preview / Production inspection; repository comparator
  and documentation edits. No Git write. No hosted mutation.
- **Non-goals:** Legacy invitation audit/migration; schema/migration changes; visual composition;
  Production/Preview/Local apply.
- **Acceptance:** Zero unclassified semantic differences; comparator distinguishes semantic drift
  from representation/environment differences; authorized REAL_DRIFT resolved or explicitly blocked;
  reusable contract for Goal 2.

## Final validation state

- **Audited HEAD:** `989c66a22f522706693b595d3a7749fefe2f34d2`
- **Working tree:** uncommitted comparator + contract doc (not committed; no Git authorization)
- **Schema:** Local / Preview / Production `CURRENT`, migration head `20260812210000`
- **dbs probe:** `2026-08-19T15:48:43.690Z` (LIVE all three)
- **Identity conflicts:** 0 / 0 / 0
- **content-parity:** PASS for all seven slugs across local, preview, production

## Invitation status

| Slug | Lifecycle | content-parity | dbs Local/Preview/Production | Result |
| --- | --- | --- | --- | --- |
| `alba-rosa-quinonez` | published | PASS | match / match / match | Semantic parity. Title accent retained as ENVIRONMENT_OWNED. |
| `abril-michelle-becerra-rea` | published | PASS | match / match / match | Semantic parity. Production share-message overlay EXPECTED_PROVENANCE. |
| `daniela-y-martin` | published | PASS | match / match / match | Semantic parity. |
| `romina-rios-chaparro` | published | PASS (cross-env) | behind / behind / behind | Cross-env equal. Definition REAL_DRIFT blocked: missing `hero-mobile`, `social-og` asset rows. |
| `victoria-y-roberto` | published | PASS | match / match / match | Semantic parity. |
| `renata` | in_progress | PASS | match / match / match | Semantic parity. Unreferenced `gallery-02` / `gallery-04` leftovers on Preview/Production. |
| `leslie-perez` | in_progress | PASS | match / match / match | Semantic parity. Production sharing overlay EXPECTED_PROVENANCE. |

Do not represent Romina as definition-parity success. Cross-environment semantic equality holds;
canonical fingerprint does not.

## Retained classified differences

### REAL_DRIFT (authorization-blocked)

- **`romina-rios-chaparro` assets `hero-mobile`, `social-og`.** Definition declares distinct
  optimization-role keys. All three environments alias `backgroundImageMobile` → `hero` and
  `ogImage` → `social`. Fingerprint fail-closed. Correction:
  `pnpm invitation:release -- --slug romina-rios-chaparro --targets local|preview --apply` then
  `pnpm prod:apply -- --slug romina-rios-chaparro --apply`. Not authorized in this session.

### ENVIRONMENT_OWNED

- Storage provider (`supabase` vs `cloudinary`) per environment StorageProvider contract.
- `invitations.title` / `events.title` first-insert preservation. Alba Production
  `Quiñonez` vs definition/Local/Preview `Quiñónez`. Apply upsert does not overwrite title.
- Unreferenced leftover asset rows (Renata Preview/Production `gallery-02`/`gallery-04`; Romina
  Preview null-key supabase rows).

### EXPECTED_PROVENANCE

- Published `version` / `published_at` / receipts / package hashes.
- Host `sharing.shareMessages` / `sharing.reminderSettings` overlays (`updateShareMessages`):
  Abril Production invitation text; Leslie Production sharing object.

### NORMALIZATION_ARTIFACT (fixed)

- Uploaded UUID / Storage URL / Cloudinary `src` false positives.
- `itinerary.presentation.behavior` vs `itinerary.variant`.
- Unreferenced extra asset keys failing content-parity while fingerprint matched.
- Path lister hiding distinct managed keys.

## Comparator changes

Single owner: `canonicalizeManagedInvitationContent` + `rewriteUploadedAssetReferences` in
`scripts/provision/promotion-comparison.ts`. Consumed by content-parity and promotional fingerprint.
Does not change `hashPublicationProjection` optimistic-lock hashing.

Regression: `tests/provision/content-parity.test.ts`, `promotion-comparison.test.ts`,
`promotional-fingerprint.test.ts` — equivalent representations compare equal; material copy, variant,
and managed-key differences still fail. `pnpm validate:changed` passed (276 related tests).

## Canonical invariants for Goal 2

Consume `docs/core/content-parity-rsvp-isolation.md` § Canonical managed invitation parity. Do not
re-audit semantic parity unless HEAD, managed definitions, or hosted managed records change.

A future client invitation is canonical and in parity when: one registry definition; one active
managed identity per environment; published payload equals definition after the comparison owner;
referenced asset keys+digests match; remaining differences are classified; no IDENTITY_CONFLICT.

## Goal 2 validation gaps only

1. Whether `invitations.title` should enter managed equality (requires apply to update title).
2. Apply Romina missing canonical asset keys once Local/Preview/Production writes are authorized.
3. Optional observational provenance for host sharing overlays without failing IN_SYNC.
4. Optional prune of unreferenced leftover assets (not semantic).

## Stop / next

No hosted mutation was performed. Commit of comparator+doc requires explicit Git authorization.
