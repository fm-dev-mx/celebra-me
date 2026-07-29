# Graphify pilot audit 01 — Intake ↔ publishing coupling

**Audit date:** 2026-07-28  
**Status:** point-in-time evidence; not architecture authority  
**Scope:** read-only usefulness test of Graphify operational views for intake ↔ public/preview
coupling  
**Code changes:** none

## Scope and method

| Field            | Value                                                                                |
| ---------------- | ------------------------------------------------------------------------------------ |
| HEAD             | `f71ddafa4695c3e481ad581de0077914f0416aab`                                           |
| Graph sourceHead | `f71ddafa4695c3e481ad581de0077914f0416aab` (fresh after `pnpm ops graphify-refresh`) |
| Graph size       | 6651 nodes, 17821 edges, 328 communities                                             |
| Primary inputs   | `graphify-out/operational/domain-intake-publishing.md` / `.json`                     |
| Corroboration    | `rg` + live reads of imports                                                         |
| Context only     | `.agent/plans/active/intake-publishing-coupling-audit.md` (not implemented)          |

## Graphify leads

### Risk hubs (EXTRACTED metrics)

Top domain risk files that matter for this experiment:

| File                                                   | Group                 | degree | crossCommunityEdgeCount |
| ------------------------------------------------------ | --------------------- | ------ | ----------------------- |
| `src/lib/intake/mappers/draft-to-published.mapper.ts`  | draftPublishedMapping | 223    | 37                      |
| `src/lib/intake/services/publishing.service.ts`        | publishService        | 173    | 99                      |
| `src/lib/intake/services/invitation-editor.service.ts` | effectiveContentMerge | 135    | 68                      |
| `src/pages/dashboard/invitaciones/[id]/preview.astro`  | preview               | 49     | 26                      |
| `src/lib/invitation/draft-preview-helper.ts`           | preview               | 49     | 24                      |

### `topCrossBoundaryLinks` (truncated, noisy)

The operational report’s top-20 cross-boundary links are only:

- `editorUi` → `draftPublishedMapping` (editor components importing draft/editor schemas)
- `effectiveContentMerge` → `draftRepositories` (`invitation-editor.service` → draft repository)

**No preview ↔ intake edges appear in that truncated list**, even though preview hubs sit inside the
same domain report.

### Raw-graph follow-up on preview hubs (EXTRACTED)

Edges involving `draft-preview-helper.ts` / `preview.astro` / `content-resolver.ts` include runtime
intake imports such as:

- `draft-preview-helper` → `intake/mappers/draft-to-published.mapper.ts` (`imports` / `calls`)
- `draft-preview-helper` → `intake/repositories/asset.repository.ts`
- `draft-preview-helper` → `intake/constants.ts`
- `preview.astro` → `intake/services/invitation-preset-resolver.ts` (and related intake repos via
  live code)

## Corroboration

| Lead                                                                         | Evidence                                                                                                                                            | Classification                                                                                                  |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Editor UI → draft/editor schemas                                             | `InvitationEditor.tsx`, `GalleryEditor.tsx`, etc. import draft/editor schemas                                                                       | **Legitimate** — editor needs form/schema types                                                                 |
| Editor service → draft repository                                            | `invitation-editor.service.ts` calls draft repository                                                                                               | **Legitimate** — expected service→repo                                                                          |
| `draft-preview-helper.ts` under `src/lib/invitation/` imports intake runtime | Live imports: `mapDraftToPublished`, `findAssetsByInvitationId`, `preferUploadedDeliverySrc`, `ALL_EDITOR_KEYS`; types `Invitation`, `DraftContent` | **Accidental / misplaced helper (P2)** — preview glue lives in invitation package but depends on intake runtime |
| `preview.astro` imports intake repos + `computeEffectiveContent`             | Live imports from intake repositories and `merge-content.service`                                                                                   | **Legitimate for a dashboard preview route** — expected orchestration, not a public-component leak              |
| `content-resolver.ts` imports intake repositories                            | Live imports `findPublishedBySlugAndEventType`, `findInvitationBySlug`                                                                              | **Legitimate / intentional** — public content resolution needs published DB lookup                              |
| Intake schemas → `presentation-options`                                      | `invitation-editor.schema.ts`, draft schemas import `LOCATION_PRESENTATIONS` / seal colors                                                          | **Shared vocabulary coupling (P3)** — intake schema depends on invitation presentation constants                |
| `draft-content-mapper.ts` → `family-contract`                                | Runtime `formatFamilyMembersAsLines` from `@/lib/invitation/family-contract`                                                                        | **Reverse coupling (P2)** — intake service depends on invitation formatting helper                              |
| Editor UI → invitation presentation                                          | Mostly `import type`; `InvitationEditor` imports runtime `supportsXareniPresentationOptions`                                                        | **Mostly legitimate**; one small runtime pull                                                                   |

## Findings

| ID  | Severity | Finding                                                                                                                                                                                 |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | P2       | `src/lib/invitation/draft-preview-helper.ts` is a preview/intake adapter misplaced under invitation; runtime intake imports are real, not type-only.                                    |
| F2  | P2       | `src/lib/intake/services/draft-content-mapper.ts` pulls invitation `family-contract` at runtime (intake → invitation reverse edge).                                                     |
| F3  | P3       | Intake draft/editor schemas depend on invitation `presentation-options` constants.                                                                                                      |
| F4  | —        | Public Astro invitation components do **not** import `@/lib/intake` (clean boundary on that surface).                                                                                   |
| F5  | meta     | Operational `topCrossBoundaryLinks` alone would have failed this audit (only legitimate editor→schema noise). Usefulness came from **risk hubs + targeted raw-graph / `rg` follow-up**. |

## Usefulness score

**Partial (leaning Useful).**

Graphify correctly elevated `draft-preview-helper` and `preview.astro` as domain risk hubs and the
fresh operational snapshot was enough to start. The default top cross-boundary table was misleading
for the question we cared about (accidental intake ↔ invitation coupling). Without `rg`
corroboration, the truncated link list would have suggested “only legitimate editor schema imports.”

Success criterion (≥1 corroborated accidental / misplaced coupling): **met** (F1, F2).

## Explicit non-goals completed

- No code changes
- No Graphify predicate updates
- No remediation of F1–F3
