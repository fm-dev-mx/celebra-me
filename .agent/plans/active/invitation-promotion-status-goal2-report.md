---
title: Invitation Promotion Status — Goal 2 Implementation
status: implemented
created: 2026-08-12
updated: 2026-08-12
related_docs:
  - .agent/plans/active/invitation-promotion-status-goal1-audit.md
---

# Goal 2 — Canonical invitation promotion status in `pnpm dbs`

Goal 1 contract: `.agent/plans/active/invitation-promotion-status-goal1-audit.md`.
No architectural deviation. Clarifications below are output/column details, not a redesign.

## Files changed

| File | Change |
| --- | --- |
| `scripts/provision/normalized-invitation-release.ts` | Added `loadSourceAssetDigests` (local normalize + sha256 only; never Storage) |
| `scripts/provision/promotional-fingerprint.ts` | **Added.** Canonical/live fingerprint, UUID→key rewrite, env classification |
| `scripts/provision/promotion-decision.ts` | **Added.** Pure `decidePromotionAction` |
| `scripts/status-core/promotional-evidence.ts` | **Added.** One grouped SQL reader per environment |
| `scripts/status-core/index.ts` | Export grouped reader |
| `scripts/provision/managed-promotion-status.ts` | **Added.** Orchestration + text formatters |
| `scripts/provision/dbs-cli.ts` | Default/`--json` PROMOTIONS; slug view drops UUID/hash; `--compact` unchanged (dynamic import) |
| `tests/provision/promotional-fingerprint.test.ts` | **Added** |
| `tests/provision/promotion-decision.test.ts` | **Added** |
| `tests/provision/managed-promotion-status.test.ts` | **Added** |

## Functions added / reused / simplified

**Added:** `loadSourceAssetDigests`, `computePromotionalFingerprint`,
`rewriteUploadedAssetReferences`, `buildLivePromotionalFingerprint`,
`buildCanonicalPromotionalFingerprint`, `classifyLiveInvitation`,
`decidePromotionAction`, `buildGroupedPromotionalEvidenceSql`,
`readGroupedPromotionalEvidence`, `evaluateManagedPromotionStatus`,
`formatPromotionsSection`, `formatSlugPromotionLine`.

**Reused:** `listInvitationDefinitions`, `hashPublicationProjection`,
`canonicalizeValue`, `buildSemanticAssetMap`, `semanticAssetRef`,
`canonicalize`, `StatusProbeSession`, `mapPool`, `resolveDbUrlForEnv`,
`evaluateGeneralStatus`, `normalizeInvitationImage`.

**Not extended:** `classifyPackageHashContent`, `evaluateInvitationStatus`,
`managed-status.ts`, promotion-candidates, observability nextStep, provenance
`packageHash`.

## Final data flow

```text
listInvitationDefinitions()
  → buildCanonicalPromotionalFingerprint (local files only)
  → per env: probeConnectivity + one grouped SQL
  → classifyLiveInvitation (fingerprint compare + draft digest)
  → decidePromotionAction
  → formatPromotionsSection (omit IN_SYNC)
```

CLI rendering does not decide. The reader has no promotion policy.

## Query / call count (steady state, N managed invitations)

- 3 connectivity probes (shared `StatusProbeSession` with the schema header)
- 1 grouped SQL read per environment (3 total), slug list = all registry slugs
- 0 per-slug SQL in the promotion path
- 0 `fetch`, Vercel, Storage HTTP, `loadPersistedAssets`

`--compact` does not enter this path (dynamic import only from default/slug views).

## Decision-matrix test evidence

`tests/provision/promotion-decision.test.ts`:

- match/match/match → `NONE` / `IN_SYNC`
- Preview behind/absent → `PROMOTE_PREVIEW`
- Preview match + Production behind/absent → `PROMOTE_PRODUCTION`
- Production match + Preview behind/absent → `BLOCKED` / `PRODUCTION_AHEAD_OF_PREVIEW`
- Local behind/absent + Preview+Production match → `BLOCKED` / `LOCAL_BEHIND_PREVIEW_ALIGNED`
- conflict → `IDENTITY_CONFLICT`; diverged → `MANAGED_DIVERGENCE`
- incomplete evidence / canonical unavailable → `UNKNOWN`
- exhaustive loop: `PROMOTE_PRODUCTION` only when Preview is `match`

## UUID → semantic-key evidence

`tests/provision/promotional-fingerprint.test.ts`: live uploaded `assetId` UUIDs
rewrite to `__INVITATION_ASSET_KEY__:<key>` and match canonical semantic refs.
Unmapped UUIDs → `unknown`. Asset sha256 change → fingerprints differ.

## Timestamps do not affect equality

Live classification rows have no `updated_at` / `published_at` inputs.
Draft divergence is `draftDigest !== publishedDigest` after rewrite.
`classifyPackageHashContent` clock rule was not used.

## `fetch` / Vercel / `loadPersistedAssets` absent

Source isolation test on the new modules + `dbs-cli.ts`. Canonical assets use
`loadSourceAssetDigests` only. Compact/`managed-status.ts` does not import the
promotion orchestrator.

## Safe-output review

Text PROMOTIONS: `slug`, `eventType`, `action`, `reasonCode` only for
`BLOCKED`/`UNKNOWN`. Empty list prints `PROMOTIONS` / `CURRENT`.
Slug text no longer prints invitation UUID or package-hash prefix.
JSON promotions: `{ slug, eventType, action, reasonCode }` only.

## `--compact` regression

`tests/provision/managed-status.test.ts` and `managed-status-git-hook.test.ts`
passed. Compact formatter source has no `evaluateManagedPromotionStatus`.
Git hook still spawns `dbs-cli.ts --compact`.

## Test commands and results

```text
pnpm exec tsc --noEmit -p tsconfig.json
  exit 0

pnpm exec jest tests/provision/promotional-fingerprint.test.ts \
  tests/provision/promotion-decision.test.ts \
  tests/provision/managed-promotion-status.test.ts \
  tests/provision/managed-status.test.ts \
  tests/unit/status-core.test.ts \
  tests/provision/managed-status-git-hook.test.ts --no-coverage
  Test Suites: 6 passed
  Tests: 40 passed
```

## Goal 1 assumptions

None found false.

Clarifications (not redesigns):

1. Grouped SQL selects `invitation_assets.id` solely to rewrite live `assetId`
   UUIDs. It is never printed.
2. Empty PROMOTIONS text is `CURRENT` (Goal 2 UX), not Goal 1’s
   `PROMOTIONS (none)`.
3. Draft-divergence reason code is Goal 1 `MANAGED_DIVERGENCE` (not the Goal 2
   example label `DRAFT_DIVERGED`).
4. `dbs-cli` loads promotion modules via dynamic `import()` so `--compact` does
   not pay fingerprint/normalize cost.

## Follow-up debt (Goal 3 / later — not required for correctness)

- `classifyPackageHashContent` timestamp `DIVERGED` on `--compact <slug>`
- dbs header “Managed” count is all active rows, not registry-only
- Observability `applyNextStep` still lacks Preview-first
- `invitation-promotion-candidates.ts` still Production-only + approval
- `evaluateInvitationStatus` still uses `packageHash` for the legacy slug probe
