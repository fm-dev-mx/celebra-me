---
title: Intake-Publishing Coupling Audit Plan
status: active
created: 2026-06-18
updated: 2026-06-18
related_skills:
  - graphify
related_docs:
  - .agent/rules/intake-publishing.md
  - .agent/rules/invitation-production.md
  - graphify-out/operational/domain-intake-publishing.json
supersedes: []
---

# Intake-Publishing Coupling Audit Plan

## 1. Objective

Audit accidental coupling between intake/editor and public invitation rendering in the
intake-publishing domain. Find and fix only the clearly misplaced helpers/types and type-only
imports that should use `import type`. Do not rearchitect.

## 2. Audit Method

Use:

- Current Graphify operational views (domain-intake-publishing.json)
- Real `import` checks via `rg` across identified boundary files
- `.agent/rules/intake-publishing.md` and `.agent/rules/invitation-production.md`
- Live source structure

## 3. Prioritized Findings

### P1 — Editor UI imports draft schemas (legitimate but noisy)

| Finding                                           | Classification        | Rationale                                                         |
| ------------------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| `editorUi` → `draftPublishedMapping` (schemas)    | legitimate dependency | Editor must import schema types to build forms. No change needed. |
| `editorUi` → `invitation-content-draft.schema.ts` | legitimate dependency | Editor hydrates/saves draft content, needs the type.              |
| `editorUi` → `invitation-editor.schema.ts`        | legitimate dependency | Editor uses editor-specific schema.                               |

### P2 — `draft-preview-helper.ts` crosses into public rendering types

| Finding                                                                         | Classification      | Rationale                                                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/invitation/draft-preview-helper.ts` imports from `src/lib/intake/`     | accidental coupling | Preview helper is in the `invitation/` domain but reaches into `intake/` types. Many of these are type-only.                                     |
| Preview helper uses `mergePublishedWithDraft()` from `merge-content.service.ts` | misplaced helper    | The preview helper should only need a clean view model, not internal service functions. However, this mirrors the runtime merge — safe to defer. |

Phase: Extract only type-only imports in `draft-preview-helper.ts` to `import type`.

### P3 — `publishing.service.ts` is a legitimate high-degree hub

| Finding                           | Classification | Rationale                                                                                         |
| --------------------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| `publishing.service.ts` degree 99 | legitimate hub | Central publish orchestration: repositories, schemas, validation, RSVP sync. Expected centrality. |

### P4 — `draft-to-published.mapper.ts` degree 182

| Finding                                                        | Classification        | Rationale                                                      |
| -------------------------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| Mapper imports content schemas from `src/lib/schemas/content/` | legitimate dependency | Must map between draft and published shapes.                   |
| Some `import type` opportunities inside the mapper             | type-only dependency  | Several Zod schema imports could be `import type`. Check file. |

Phase: Convert confirmed type-only Zod and interface imports to `import type`.

### P5 — `draft-content-mapper.ts` and `section-content-mapper.ts`

| Finding                                                            | Classification                | Rationale                                                                                                              |
| ------------------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Cross-community edges (44 and 8) suggest some imports span domains | accidental coupling candidate | The draft-content-mapper imports intake block types. These are legitimate (block → mapper). Review actual import list. |

Phase: Spot-check imports; if any cross into public rendering or adapters, convert to `import type`
or extract.

### P6 — Preview helper → rendering boundary

| Finding                                                                        | Classification        | Rationale                                                             |
| ------------------------------------------------------------------------------ | --------------------- | --------------------------------------------------------------------- |
| `draft-preview-helper.ts` builds context for `InvitationEditorPreviewPane.tsx` | legitimate dependency | Preview must mimic published rendering closely. No extraction needed. |

### P7 — Tests import from production code (expected)

| Finding                                           | Classification     | Rationale                                                          |
| ------------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| `tests/unit/publishing.service.test.ts` degree 63 | test/fixture noise | Tests import services/schemas. Expected. Exclude from audit scope. |

### P8 — Repository → service coupling

| Finding                                                | Classification        | Rationale                                                      |
| ------------------------------------------------------ | --------------------- | -------------------------------------------------------------- |
| `effectiveContentMerge` calls into `draftRepositories` | legitimate dependency | Services must call repositories. This is layered architecture. |

### P9 — `merge-content.service.ts` at degree 46

| Finding                                      | Classification        | Rationale                                  |
| -------------------------------------------- | --------------------- | ------------------------------------------ |
| Imports intake schemas and published schemas | legitimate dependency | Merge needs both shapes. No change needed. |

### P10 — `invitation-editor.service.ts` at degree 123 (high)

| Finding                               | Classification        | Rationale                                            |
| ------------------------------------- | --------------------- | ---------------------------------------------------- |
| Cross-boundary into draftRepositories | legitimate dependency | Service → repository is expected.                    |
| Imports from multiple intake domains  | legitimate hub        | Editor service orchestrates save, merge, validation. |

## 4. Implementation Sequence (Low-Risk Phases)

### Phase A — Type-only import conversion

Files to review for `import type` conversion:

- `src/lib/invitation/draft-preview-helper.ts` — check imports from `../../intake/`
- `src/lib/intake/mappers/draft-to-published.mapper.ts` — check imports from `../schemas/`
- `src/lib/intake/services/publishing.service.ts` — check schema imports

These are mechanical changes, zero behavioral risk.

### Phase B — Existing boundary test reinforcement

If architecture boundary tests exist for intake-publishing, add explicit import checks for the
editor → published rendering boundary. If none exist, skip.

### Phase C — Verify with Graphify after each phase

After each phase, run:

```
pnpm ops graphify-views
```

Confirm cross-boundary link counts decrease only where expected.

## 5. Validations Required

After any code change:

- `pnpm test -- tests/unit/graphify-operational-views.test.ts`
- `pnpm test` (full Jest suite)
- `pnpm type-check`
- `pnpm lint`
- `pnpm ops graphify-views` (with stale-graph guard active)

## 6. Explicit Non-Goals

- Do not touch RSVP runtime behavior or RSVP domain files
- Do not touch theme/assets architecture
- Do not modify public invitation rendering components unless a verified intake boundary rule
  requires it
- Do not change SQL/migrations/database workflows
- Do not perform broad service/repository restructuring
- Do not extract shared utilities unless proven repeated cross-domain behavior
- Do not modify Graphify domain predicates unless this plan proves them stale
- Do not merge or delete any intake directory structure

## 7. Review Check

Before marking Phase A complete, confirm:

- [ ] `import type` used for all type-only Zod/interface imports from draft schemas
- [ ] No behavioral changes
- [ ] All existing tests pass
- [ ] `pnpm ops graphify-views` succeeds with current HEAD
