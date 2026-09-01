---
title: Canonical invitation parity — Goal 1 closure (current HEAD)
status: superseded
created: 2026-08-20
updated: 2026-08-31
supersedes_evidence: .agent/plans/archived/canonical-invitation-parity-contract.md
superseded_by: docs/domains/theme/corpus-bundle-inventory.md
related_docs:
  - docs/core/content-parity-rsvp-isolation.md
  - docs/core/invitation-creation-contract.md
---

# Goal 1 Closure Handoff — Current HEAD

## Task Contract

- **Objective:** Close Goal 1 on the current managed-invitation model (Subgoal 1.1 finalize).
- **Authorized:** Repository comparison-owner fixes; Valentina Local apply for OG alignment;
  read-only Production diagnostics. No unauthorized Production writes.
- **Non-goals:** Legacy migration; comparator redesign; Goal 2 CI hardening; rewrite of archived
  `989c66a2` handoff.

## Repository tip

- **Committed HEAD:** `ba408ebc92060074ee18cd5791636ab76d4d8711` contains the Subgoal 1.1
  implementation.
- **Branch:** `dev-local`
- Commits: `9fd6824b` (comparison/fingerprint parity) and `ba408ebc` (Valentina OG asset alignment).

## Canonical clients (8)

1. `alba-rosa-quinonez`
2. `abril-michelle-becerra-rea`
3. `daniela-y-martin`
4. `romina-rios-chaparro`
5. `victoria-y-roberto`
6. `renata` — `published` + corpus
7. `leslie-perez` — `published` + corpus
8. `valentina-hernandez`

## Corpus integrity

```text
canonical corpus entries = 8
legacy corpus entries    = 9
total corpus entries     = 17
```

No canonical entry is fixture-backed. Focused validation passed at committed HEAD: 24 related suites
/ 294 tests for the parity commit, 56 related suites / 642 tests for the Valentina commit; Astro
check and TypeScript check passed.

## Final LIVE status (Subgoal 1.1)

### `pnpm dbs` (registry)

| Metric               | Value                                                 |
| -------------------- | ----------------------------------------------------- |
| Registry invitations | 8                                                     |
| In sync              | **7**                                                 |
| Attention            | **1** (`romina-rios-chaparro` → `PROMOTE_PRODUCTION`) |

`valentina-hernandez`: **NONE (IN_SYNC)** — Local / Preview / Production match canonical after
content-only fingerprint alignment.

### Semantic content-parity

| Slug                       | content-parity           | identity conflicts |
| -------------------------- | ------------------------ | ------------------ |
| alba-rosa-quinonez         | PASS                     | none               |
| abril-michelle-becerra-rea | PASS                     | none               |
| daniela-y-martin           | PASS                     | none               |
| victoria-y-roberto         | PASS                     | none               |
| renata                     | PASS                     | none               |
| leslie-perez               | PASS                     | none               |
| valentina-hernandez        | **PASS**                 | none               |
| romina-rios-chaparro       | **FAIL** (vs Production) | none               |

## Valentina representation fix (shared comparison owner)

- Managed uploaded refs vs content-only hosted representations (bare semantic key strings or
  external URL strings) compare equal under `semanticInvitationContentEqual` /
  `areEquivalentAssetRepresentations`.
- Empty managed inventory + external content-only refs is representation-compatible with a managed
  uploaded inventory (`compareAssets`).
- Promotional fingerprint: content-only envs with incomplete `invitation_assets` reuse canonical
  digests and align hosted asset slots to canonical uploaded refs via
  `alignExternalAssetsToCanonical` (does not rewrite section-name strings like `family`).
- Definition `sharing.ogImage` aligned to `portrait` to match content-only hosted key (Local
  applied). Path-budget test skips `sharing.ogImage` as intentional reuse.
- Regression: `tests/provision/content-parity.test.ts`, `promotion-comparison.test.ts`,
  `promotional-fingerprint.test.ts`.
- **No Preview/Production Valentina mutation.**

## Romina Production drift

- Local + Preview corrected earlier; Preview package approved.
- Production still missing canonical `hero-mobile` / `social-og` → **REAL_DRIFT** /
  `PROMOTE_PRODUCTION`.
- Owner apply **not performed in this session**: Production still misses canonical `hero-mobile` /
  `social-og`. Agent must not claim Goal 1 complete until:

```bash
# after owner authorization for the Production apply
pnpm prod:apply -- --slug romina-rios-chaparro --apply
pnpm dbs
pnpm invitation:content-parity -- --slug romina-rios-chaparro --event-type xv
```

## Unresolved blockers (Goal 1 not closed)

1. **Owner Production:** `pnpm prod:apply -- --slug romina-rios-chaparro --apply` on clean HEAD;
   re-verify `dbs` + content-parity.

Until both complete:

```text
8/8 IN_SYNC          = NO (7/8)
8/8 content-parity   = NO (7/8)
0 REAL_DRIFT         = NO (Romina Production)
```

## Goal 2 input contract (when blockers clear)

```text
8 current canonical clients
canonical parity contract already implemented
fresh parity evidence tied to committed final HEAD
Renata + Leslie published and in canonical corpus
remaining 9 clients explicitly legacy
Valentina content-only representation handled by shared comparison owner
```

Goal 2 must **not** re-audit semantic parity or begin legacy migration.

## Explicit non-touch

- `.agent/plans/archived/canonical-invitation-parity-contract.md`
- Legacy fixtures / Goal 3 migration
- Unauthorized Production writes
