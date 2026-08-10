# P1.2 Render Parity Convergence — Gate Record

**Date:** 2026-08-10  
**Status:** `BLOCKED_AT_SAFE_RECONCILIATION_GATE`  
**Mode:** diagnostic and coverage preparation only; no database, Storage, deployment, or Git-index
mutation was performed.

## Authoritative state captured

- Worktree: `dev-local`, HEAD `4c5ff780cdaabcf93c583311f2846a1006535db4`.
- The worktree has two intentionally staged report files. `release-check` correctly refused to
  produce release evidence with `DIRTY_WORKTREE`; the staging was not changed.
- Read-only database availability passed for Local, Preview, and Production. Schema status was
  `CURRENT` for all three targets. Managed content status remained `CONTENT_UNVERIFIED`.
- The canonical registry marks `alba-rosa-quinonez`, `abril-michelle-becerra-rea`, and
  `romina-rios-chaparro` as `published`; `daniela-y-martin` and `victoria-y-roberto` remain
  `in_progress`.
- Production browser responses exposed Vercel request IDs and hashed assets, but no Git SHA or
  deployment revision. Asset hashes were not treated as a source or release identity.

## Dry-run results before any write

Every currently managed published definition was checked through the existing
`pnpm invitation:release` workflow.

| Definition                   | Target     | Result                                   | Planned writes | Safe interpretation                                                            |
| ---------------------------- | ---------- | ---------------------------------------- | -------------: | ------------------------------------------------------------------------------ |
| `alba-rosa-quinonez`         | Local      | `BLOCKED` — `publication_after_baseline` |              0 | Published version/projection differs from managed operation evidence.          |
| `abril-michelle-becerra-rea` | Local      | `BLOCKED` — `publication_after_baseline` |              0 | Same baseline mismatch; no automatic normalization is safe.                    |
| `romina-rios-chaparro`       | Local      | `BLOCKED` — `publication_after_baseline` |              0 | Same baseline mismatch; no automatic normalization is safe.                    |
| `alba-rosa-quinonez`         | Production | `BLOCKED` — `MISSING_PREVIEW_APPROVAL`   |              0 | Exact approved Preview release is required before Production comparison/apply. |
| `abril-michelle-becerra-rea` | Production | `BLOCKED` — `MISSING_PREVIEW_APPROVAL`   |              0 | Exact approved Preview release is required before Production comparison/apply. |
| `romina-rios-chaparro`       | Production | `BLOCKED` — `MISSING_PREVIEW_APPROVAL`   |              0 | Exact approved Preview release is required before Production comparison/apply. |

The corresponding Preview dry-runs also returned `PREVIEW_PLAN_BLOCKED` with the sanitized technical
reason `publication_after_baseline`; each planned write set was zero.

The Local block is not a permission to overwrite the snapshot or provenance. The workflow's baseline
resolver classifies it as a real conflict (`publication_after_baseline`) and explicitly fails
closed. The read-only semantic parity command independently reported content drift between Local,
Preview, and Production for all three definitions, including published-content and asset
semantic-key drift. Those differences are not safe to normalize without an operator-approved
reconciliation decision.

The read-only cross-database reconciliation also found one managed metadata divergence for Alba: the
canonical title is `70 años de Alba Rosa Quiñónez López`, while the environment value is
`70 años de Alba Rosa Quiñonez López` without the accent. This is an unexpected user/content
difference, not environment-generated metadata. It was not normalized and remains an operator
decision before any write set can be approved.

A recheck at `2026-08-10T17:40:26.579Z` reproduced the same cross-database result (`aligned=2`,
`missing=0`, `extra=22`, `divergent=1`). Fresh dry-runs for all three published slugs reproduced
`publication_after_baseline` for Local and the sanitized equivalent for Preview, with zero planned
writes; Production remained blocked by `MISSING_PREVIEW_APPROVAL` with zero planned writes.

## Canonical values and browser regression lock

The source definitions still carry the approved values:

- Alba Countdown: `countdown.presentationOptions.visibleUnits = ['days']`.
- Alba Location: `location.structuralVariant = 'split-map'`.
- Romina Hero: `hero.structuralVariant = 'split-cover'`.

Focused route coverage was added in `tests/e2e/canonical-managed-contracts.spec.ts`. It asserts the
route DOM contract, days-only Countdown, split-map mobile/desktop layout modes, split-cover desktop
geometry mode, and canonical mobile Hero behavior without asserting countdown numbers, client copy,
Production asset hashes, or pixel-exact output.

The focused Local run failed exactly where the stale published snapshot predicts:

- Alba route emitted `data-visible-units="days,hours,minutes,seconds"` and `data-unit-count="4"`.
- Romina route emitted `data-structural-variant="standard"`.

The failures are useful regression evidence and remain unresolved until the guarded content
reconciliation succeeds.

## Victoria lifecycle

`victoria-y-roberto` remains `in_progress` in the authoritative managed definition. Its Production
404 is therefore expected under the render-corpus policy that excludes unpublished in-progress
definitions. It must not be published merely to remove the P1.1 comparison limitation.

## Required next operator boundary

This gate cannot be completed by bypassing the existing workflow. The next safe action is an
owner-approved, guarded reconciliation of the three Local managed baselines (or an explicit operator
decision that establishes the correct managed ancestor), followed by:

1. a new zero-drift Local dry-run and effective-content verification;
2. the existing Local → Preview package/apply and Preview approval flow;
3. a clean committed release HEAD plus `pnpm release-check` evidence;
4. the owner-only Production `invitation:release` promotion;
5. deployment of that same committed renderer/CSS revision through the normal Vercel release path;
6. the focused browser assertions and bounded comparable-corpus scan.

No direct SQL, manual baseline rewrite, legacy slug-specific CSS, Production apply, deployment, or
in-progress Victoria publication was performed.
