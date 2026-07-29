# Graphify pilot audit 02 — Blast radius of `draft-preview-helper`

**Audit date:** 2026-07-28  
**Status:** point-in-time evidence; not architecture authority  
**Scope:** read-only usefulness test of Graphify NL query / path vs `rg` for one fixed hub  
**Hub:** `src/lib/invitation/draft-preview-helper.ts`  
**Code changes:** none

## Scope and method

| Field             | Value                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| HEAD              | `f71ddafa4695c3e481ad581de0077914f0416aab`                                                                  |
| Graph sourceHead  | same (fresh snapshot from pilot baseline)                                                                   |
| Graphify commands | `graphify query` (dependents + outbound intake), `graphify path` (hub → merge-content / draft-to-published) |
| Corroboration     | exact neighbor extraction from `graph.json` + `rg` for importers/imports                                    |
| Time budget       | ~45 minutes after shared refresh                                                                            |

## Graphify leads

### NL query results (noisy / weak)

1. Query for dependents of `draft-preview-helper` / `buildDraftPreviewPageContext` returned a BFS of
   **77 nodes** that mixed unrelated preview scripts (`preview-environment.ts`), publishing, guests
   API, and mapper section helpers. Start-node matching was heuristic and over-broad.
2. Query for “what does draft-preview-helper depend on under intake?” returned **748 nodes** —
   effectively unusable without heavy filtering.
3. `graphify path "draft-preview-helper" "merge-content.service"` resolved the **test file**
   `draft-preview-helper.test.ts` and reported a 2-hop path through `@/lib/intake/types` — **not** a
   real dependency between the helper and merge-content.
4. `graphify path` to `draft-to-published.mapper` similarly anchored on the test file (ambiguous
   target warning).

### Exact EXTRACTED neighbors from `graph.json` (useful)

**Importers (files linking TO hub):**

| File                                                  | Relations                 |
| ----------------------------------------------------- | ------------------------- |
| `src/pages/dashboard/invitaciones/[id]/preview.astro` | `imports`, `imports_from` |
| `tests/unit/draft-preview-helper.test.ts`             | `imports`, `imports_from` |

**Outbound (hub links TO), intake-relevant:**

| Target                                                      | Relations                               |
| ----------------------------------------------------------- | --------------------------------------- |
| `src/lib/intake/mappers/draft-to-published.mapper.ts`       | `imports`, `imports_from`, `calls`      |
| `src/lib/intake/repositories/asset.repository.ts`           | `imports`, `imports_from`, `calls`      |
| `src/lib/intake/services/asset-delivery.ts`                 | `imports`, `imports_from`, `calls`      |
| `src/lib/intake/constants.ts`                               | `imports`, `imports_from`, `references` |
| `src/lib/intake/schemas/invitation-content-draft.schema.ts` | `imports`, `imports_from`               |
| `src/lib/intake/types.ts`                                   | `imports`, `imports_from`               |

Also outbound to invitation/adapters/assets: `page-data.ts`, `db-event-adapter.ts`, `asset-slug.ts`.

## Corroboration (`rg` / live file)

| Claim                              | Evidence                                                                                                               | Result                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Direct production importer         | Only `preview.astro` imports `buildDraftPreviewPageContext`                                                            | **Keep**                               |
| Test importer                      | `tests/unit/draft-preview-helper.test.ts`                                                                              | **Keep**                               |
| Runtime intake reach               | Live file imports mapper, asset repository, asset-delivery, `ALL_EDITOR_KEYS`; type-only `Invitation` / `DraftContent` | **Keep** (matches audit 01 F1)         |
| Depends on `merge-content.service` | No import in helper; path query was a false path via shared types                                                      | **Discard** Graphify path lead         |
| Broad “748 dependents”             | No evidence of transitive production importers beyond preview route                                                    | **Discard** NL BFS as blast-radius map |

## Blast-radius table (corroborated)

| Layer                        | Files                                                                           | Runtime vs type |
| ---------------------------- | ------------------------------------------------------------------------------- | --------------- |
| Direct importers             | `preview.astro`, unit test                                                      | runtime         |
| Outbound intake runtime      | draft-to-published mapper, asset.repository, asset-delivery, constants          | runtime         |
| Outbound intake type-only    | invitation-content-draft.schema (`DraftContent`), intake `types` (`Invitation`) | type-only       |
| Outbound invitation/adapters | page-data, db-event-adapter, asset-slug                                         | runtime         |

**Production blast radius if this file changes:** one dashboard preview page + its unit test, plus
any breakage in the intake modules it calls (mapper/assets). It is **not** on the public guest
invitation render path.

## Findings

| ID  | Severity | Finding                                                                                                               |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| F1  | P2       | Hub is a narrow preview adapter with wide intake runtime reach (same as audit 01).                                    |
| F2  | meta     | Graphify **NL query/path** failed this experiment: wrong anchors, false paths, unusable BFS.                          |
| F3  | meta     | Exact `graph.json` neighbor extraction matched `rg` and was fast — but that is graph-file analysis, not the query UX. |

## Usefulness score

**Not useful** for the planned Graphify query/path workflow.

Success criterion (≥1 dependent/outbound edge Graphify surfaces that `rg` would likely miss, or a
clearer ranked map faster than `rg`): **not met**.  
`rg` alone found the two importers and the outbound intake imports in less time and with less noise.
Graphify NL tools added false confidence (test-file path to merge-content).

Operational domain risk ranking still correctly flagged the file as a hub (degree 49) — that value
was already captured in audit 01.

## Explicit non-goals completed

- No code changes
- No relocation of the helper
- No predicate updates
