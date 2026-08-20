---
title: Canonical invitation parity — Goal 1 closure (current HEAD)
status: active
created: 2026-08-20
updated: 2026-08-20
supersedes_evidence: .agent/plans/archived/canonical-invitation-parity-contract.md
related_docs:
  - docs/core/content-parity-rsvp-isolation.md
  - docs/core/invitation-creation-contract.md
---

# Goal 1 Closure Handoff — Current HEAD

## Task Contract (closed)

- **Objective:** Close Goal 1 on the current managed-invitation model: Renata/Leslie published + canonical corpus, fresh LIVE parity for 8 clients, evidence-gated Valentina/Romina ops, redundant Preview re-approval removed, Goal 2 handoff facts.
- **Authorized:** Repository contract edits; Preview/Local managed apply for confirmed Romina REAL_DRIFT; read-only Production diagnostics. No unauthorized Production writes.
- **Non-goals:** Legacy migration; comparator redesign; Goal 2 CI hardening; rewrite of archived `989c66a2` handoff.

## Final repository tip at handoff authoring

- **Working HEAD (pre-commit):** `10e6933cc4015e439901ecedd3ee70f825aed745` plus uncommitted Goal 1 closure edits listed below.
- **Branch:** `dev-local` (aligned with `origin/develop` before these edits).
- After the owner commits this worktree, replace this tip with the commit SHA that includes the closure.

### Repository changes in this closure

- Renata + Leslie: `lifecycle: 'published'`
- Local Render Corpus: both added as `canonical` / `remoteParity: required` / `canonical_definition`
- `EXPECTED_LOCAL_RENDER_CORPUS_SIZE`: 15 → **17** (8 canonical + 9 legacy)
- Wizard: `maybeCompletePreviewApproval` skips live verify/re-approve when `resolveDestinationReadiness().productionReady === true`
- Focused tests/docs updated accordingly

## Canonical clients (8)

1. `alba-rosa-quinonez`
2. `abril-michelle-becerra-rea`
3. `daniela-y-martin`
4. `romina-rios-chaparro`
5. `victoria-y-roberto`
6. `renata` — now **published** + corpus
7. `leslie-perez` — now **published** + corpus
8. `valentina-hernandez`

## Corpus integrity

```text
canonical corpus entries = 8
legacy corpus entries    = 9
total corpus entries     = 17
```

No canonical entry is fixture-backed. `validate:changed` passed (761 related tests + corpus regression).

## LIVE evidence (refresh)

Probe time: ~2026-08-20T06:05Z–06:15Z (dbs LIVE). Content-parity refresh: `.agent/tmp/goal1-content-parity-refresh.json`.

### `pnpm dbs` (registry)

| Metric | Value |
| --- | --- |
| Registry invitations | 8 |
| In sync | 7 |
| Attention | 1 (`romina-rios-chaparro` → `PROMOTE_PRODUCTION`) |

Valentina: `NONE (IN_SYNC)` — Local / Preview / Production match canonical fingerprint. **No Production mutation.**

### Semantic content-parity (cross-env)

| Slug | lifecycle | L/P/Pr loaded | cross-env OK | identity conflicts |
| --- | --- | --- | --- | --- |
| alba-rosa-quinonez | published | yes | PASS | none |
| abril-michelle-becerra-rea | published | yes | PASS | none |
| daniela-y-martin | published | yes | PASS | none |
| victoria-y-roberto | published | yes | PASS | none |
| renata | published | yes | PASS | none |
| leslie-perez | published | yes | PASS | none |
| romina-rios-chaparro | published | yes | FAIL vs Production only | none |
| valentina-hernandez | published | yes | FAIL Local vs hosted | none |

### Retained classified differences

**REAL_DRIFT (owner-blocked Production)**

- `romina-rios-chaparro`: definition keys `hero-mobile` / `social-og` still missing on **Production** only. Local + Preview now have all 13 definition keys after managed apply; Preview package `c91537f982ecbef6…` live-verified and **approved**. Owner:

```bash
pnpm prod:apply -- --slug romina-rios-chaparro --apply
```

**ENVIRONMENT_OWNED / representation**

- `valentina-hernandez`: Local inventories 16 managed `invitation_assets` rows; Preview/Production use content-only delivery with **0** managed asset rows (string/Cloudinary refs). Preview≡Production semantically. Fingerprint `IN_SYNC` — do not treat Local inventory shape as Production apply debt.
- Hosted vs Local uploaded `assetId`/`src` representation differences remain under the existing comparison owner (not new rules).

**EXPECTED_PROVENANCE** (unchanged classes from prior Goal 1; not re-audited as failures)

- Published version / receipts / package hashes.
- Host sharing overlays where previously classified (Abril/Leslie) — still not treated as fingerprint failure when dbs reports match.

## Operations performed

| Target | Action | Result |
| --- | --- | --- |
| Valentina Production | none | Already `IN_SYNC` |
| Romina Local | `invitation:release --targets local --apply --confirm-destructive` | Applied (v7); keys complete |
| Romina Preview | `invitation:release --targets preview --apply --confirm-destructive` | Applied (v20); keys complete |
| Romina Preview approve | `--package-hash c91537f9… --approve` | approved |
| Romina Production | **not applied** | Owner / HITL required |

## Wizard re-approval fix

- Authority: `resolveDestinationReadiness().productionReady` only.
- When true: no second live verification, no `runLiveApproval`, message points to `pnpm prod:apply`.
- Regression: `tests/provision/invitation-release-wizard.test.ts` (`maybeCompletePreviewApproval` / productionReady gate).
- Inverse path (not productionReady) unchanged (verify + approve + stale recovery).

## Unresolved blockers

1. **Owner:** `pnpm prod:apply -- --slug romina-rios-chaparro --apply` then re-run `pnpm dbs` + content-parity for Romina.
2. Commit this worktree (explicit Git authorization required; agent did not commit).

## Goal 2 input contract

```text
8 current canonical clients
canonical parity contract already implemented
fresh parity evidence tied to this closure (post-10e6933c working tree)
Renata + Leslie published and in canonical corpus
remaining 9 clients explicitly legacy
Romina Production REAL_DRIFT owner-gated until prod:apply
```

Goal 2 must **not** re-audit semantic parity or begin legacy migration. Scope remains validation/gate hardening before Goal 3 migrates the remaining 9.

## Explicit non-touch

- `.agent/plans/archived/canonical-invitation-parity-contract.md` (historical `989c66a2` evidence only)
- Parity comparator redesign / new normalization paths
- Legacy fixtures / Goal 3 migration
