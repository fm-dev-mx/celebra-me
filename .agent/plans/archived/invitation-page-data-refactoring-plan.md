# Invitation Page Data — Surgical Refactoring Plan

## Scope

A low-risk refactor of src/lib/invitation/page-data.ts (417 lines) into 2–3 focused modules, keeping
page-data.ts as the public facade.

---

## What stays in page-data.ts

| Code                          | Reason                                               |
| ----------------------------- | ---------------------------------------------------- |
| buildLayoutData               | 4 consumers; simple, reused, no benefit to extract   |
| buildEnvelopeData             | Called by buildPageContextFromViewModel only; stable |
| pickHeroValue                 | Small helper, single consumer                        |
| resolveFooterVariant          | Small helper, single consumer                        |
| buildPageContextFromViewModel | Main orchestrator — must stay the entry point        |
| prepareInvitationPageContext  | Public API — must stay in the facade                 |
| Re-exports of all types       | Backward compatibility for 9 existing consumers      |

After refactor: page-data.ts shrinks from 417 lines to ~90–100 lines, functioning as the
coordinator: load → protect → render → return.

---

## File 1: src/lib/invitation/protected-location.ts

Responsibility: Decide whether location is visible, redacted, or removed, based solely on
location.visibility === after-rsvp and guest confirmation state. Luna y Estrella is kept as an
explicitly isolated legacy path.

Moves from page-data.ts (8 functions, ~218 lines moved):

| Function                               | Lines   | Role                                                   |
| -------------------------------------- | ------- | ------------------------------------------------------ |
| redactEnvelopeTeaserWhenLocationLocked | 111–121 | Redact venue from envelope teaser when location locked |
| isConfirmedGuest                       | 223–225 | Check if guest attendanceStatus === confirmed          |
| isLunaEstrellaRoute                    | 227–229 | Detect Luna y Estrella route slug                      |
| removeLocationNavigation               | 231–237 | Filter location hrefs from navigation                  |
| removeLocationFromSectionOrder         | 239–243 | Filter location from sectionOrder                      |
| applyLunaEstrellaRsvpOnlyLocation      | 245–288 | Luna y Estrella-specific handling (legacy)             |
| redactProtectedLocation                | 290–305 | Build redacted location object                         |
| applyProtectedLocationRedaction        | 307–332 | Main orchestrator: decide redact/remove/pass           |

Design rules:

- Core logic depends on location.visibility === after-rsvp, NOT on route slug
- Luna y Estrella compatibility is a separate, named function
- Only the main entry applyProtectedLocationRedaction is exported
- All other functions are module-private

---

## File 2: src/lib/invitation/render-plan.ts

Responsibility: Decide what sections get rendered and in what order, including interlude placement.

Moves from page-data.ts (4 functions + 2 types, ~76 lines moved):

| Code                        | Lines   | Role                                  |
| --------------------------- | ------- | ------------------------------------- |
| InterludeRenderItem         | 16–26   | Type — belongs with render-plan       |
| InvitationRenderPlanItem    | 28–36   | Type — belongs with render-plan       |
| hasRenderableSection        | 134–139 | Check if section exists in viewModel  |
| appendSectionWithInterludes | 141–155 | Push section + following interludes   |
| interludeToRenderItem       | 157–172 | Convert interlude data to render item |
| buildInvitationRenderPlan   | 174–210 | Main build function                   |

Also moves DEFAULT_THEME_PRESET constant (line 70) since it is only used by interludeToRenderItem.

---

## File 3: src/lib/invitation/page-data.types.ts (only if needed)

Concrete reason for extraction: Without it, both new modules would import types from page-data.ts,
creating circular dependencies.

Types to move (all currently in page-data.ts):

| Type                   | Used by                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| InvitationGuestContext | protected-location.ts, route-personalization.ts, [slug].astro                            |
| InvitationPageContext  | section-render-data.ts, draft-preview-helper.ts, InvitationSections.astro, preview.astro |

InterludeRenderItem and InvitationRenderPlanItem move to render-plan.ts instead (they belong to that
domain).

page-data.ts re-exports all four types for backward compat.

---

## Dependency graph (after refactor)

page-data.ts → protected-location.ts (applyProtectedLocationRedaction) page-data.types.ts
(InvitationGuestContext) → render-plan.ts (buildInvitationRenderPlan) page-data.types.ts
(InvitationPageContext) adapters/types (InvitationViewModel)

protected-location.ts → page-data.types.ts (InvitationGuestContext) adapters/types
(InvitationViewModel, LocationSection)

render-plan.ts → page-data.types.ts (InvitationPageContext) adapters/types (InvitationViewModel)
theme/theme-contract (CONTENT_SECTION_KEYS, THEME_PRESETS)

No circular dependencies.

---

## Existing tests — impacted

| Test file                                               | What it tests                                               | Risk                              |
| ------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------- |
| tests/unit/page-data.test.ts                            | buildLayoutData                                             | No impact — stays in page-data.ts |
| tests/unit/invitation.render-plan.test.ts               | buildInvitationRenderPlan                                   | Import path changes only          |
| tests/unit/invitation.presenter.test.ts                 | buildPageContextFromViewModel, prepareInvitationPageContext | No import changes                 |
| tests/content/luna-y-estrella-published-content.test.ts | buildPageContextFromViewModel                               | No import changes                 |
| tests/unit/invitation.section-render-data.test.ts       | buildInvitationSectionRenderDescriptors                     | No import changes                 |
| tests/unit/shortid-metadata.test.ts                     | buildLayoutData                                             | No impact                         |
| tests/unit/draft-preview-helper.test.ts                 | buildPageContextFromViewModel                               | No impact                         |
| tests/integration/theme-delivery.integration.test.ts    | prepareInvitationPageContext                                | No impact                         |

Only invitation.render-plan.test.ts needs an import path update.

Protected location tests are all integration tests that test through buildPageContextFromViewModel,
so they are unaffected by the extraction.

---

## Validation

After changes: pnpm type-check pnpm lint pnpm test pnpm build

All four must pass except documented pre-existing failures.

---

## Success criteria

1. page-data.ts preserves all current public exports via re-exports
2. Protected location is NOT leaked to anonymous visitors
3. Protected location is NOT leaked to unconfirmed/declined guests
4. Protected location IS shown to confirmed guests when visibility === after-rsvp
5. Navigation does NOT include event-location when location is locked
6. sectionOrder does NOT include location when location is locked
7. Envelope teaser does NOT leak venue/address when location is locked
8. Luna y Estrella preserves all current behavior
9. Render plan preserves section order, interlude placement, personalized-access
10. pnpm type-check, pnpm lint, pnpm test, pnpm build pass

---

## What is NOT done

Originally proposed in v1:

| File                    | Status  | Reason                                                                                           |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| helpers.ts              | Skipped | No clear domain — would become a dumping ground                                                  |
| layout-builder.ts       | Skipped | buildLayoutData/buildEnvelopeData are simple, stable, only used by buildPageContextFromViewModel |
| page-context-builder.ts | Skipped | Would turn page-data.ts into an empty proxy — violates the facade principle                      |
| section-renderer.ts     | Skipped | Render plan extraction covers same concern; section-render-data.ts already exists                |
| redaction-utils.ts      | Renamed | Named protected-location.ts — domain-driven name, not generic utils                              |

---

## Remaining technical debt

- pickHeroValue, resolveFooterVariant, buildEnvelopeData remain in page-data.ts as private helpers.
  Extract only if another module needs them.
- section-render-data.ts still imports types from page-data.ts. Fine since page-data.ts re-exports.
  Can import directly from page-data.types.ts later.
- InvitationGuestContext derived type still depends on getInvitationContextByInviteId from RSVP
  service. True decoupling is out of scope for this refactor.

---

## After-refactor file sizes (estimated)

| File                  | Before    | After                                            |
| --------------------- | --------- | ------------------------------------------------ |
| page-data.ts          | 417 lines | ~100 lines (orchestrator + helpers + re-exports) |
| protected-location.ts | —         | ~220 lines (new)                                 |
| render-plan.ts        | —         | ~80 lines (new)                                  |
| page-data.types.ts    | —         | ~40 lines (new, if needed)                       |

---

## Execution Results

### Files created

- **src/lib/invitation/render-plan.ts** — 105 lines (render plan logic + types)
- **src/lib/invitation/protected-location.ts** — 127 lines (protected location rules)

### Files modified

- **src/lib/invitation/page-data.ts** — 417 lines → 197 lines (—220 lines)

### Files intentionally not created

- **page-data.types.ts** — Not needed. Both new modules avoid importing types from page-data.ts:
  - render-plan.ts defines InterludeRenderItem and InvitationRenderPlanItem internally and exports
    them
  - protected-location.ts accepts only isConfirmedGuest: boolean, no guest context type needed
  - page-data.ts imports from both modules, but neither imports back. No circular dependency.

### Before/After summary for page-data.ts

| Metric            | Before | After                                             |
| ----------------- | ------ | ------------------------------------------------- |
| Total lines       | 417    | 197                                               |
| Exports           | 8      | 8 (all preserved via re-exports)                  |
| Private functions | 12     | 4                                                 |
| Imports           | 11     | 12 (+2 from new modules, —1 CONTENT_SECTION_KEYS) |

### Protected location separation

- Module protected-location.ts owns: after-rsvp visibility, confirmed/declined guest state, location
  redaction, envelope teaser redaction, navigation filtering, Luna y Estrella legacy path
- The module depends only on InvitationViewModel from adapters/types
- Guest state enters as a simple isConfirmedGuest: boolean — the full InvitationGuestContext stays
  in page-data.ts
- Luna y Estrella is an explicit, isolated legacy path inside the module

### Render plan separation

- Module ender-plan.ts owns: section ordering, interlude placement, section renderability checks
- Types InterludeRenderItem and InvitationRenderPlanItem now live in render-plan.ts and are
  re-exported from page-data.ts

### Validation results

| Command         | Result                                           |
| --------------- | ------------------------------------------------ |
| pnpm type-check | ✅ 0 errors, 0 warnings                          |
| pnpm lint       | ✅ Passed                                        |
| pnpm test       | ✅ 187 passed, 1 skipped, 1 pre-existing failure |
| pnpm build      | ✅ 0 errors, complete                            |

### Pre-existing test failure

tests/unit/event-assets-audit.test.ts — checks image files in asset directories have corresponding
index imports. Failure shows 10 image files on disk not imported in their event index modules.
**Unrelated** to this refactor (no asset files or event index modules were touched).

### Success criteria check

1. ✅ page-data.ts preserves all 8 current public exports (via re-exports)
2. ✅ Protected location not leaked to anonymous visitors
3. ✅ Protected location not leaked to unconfirmed/declined guests
4. ✅ Protected location shown to confirmed guests when visibility === after-rsvp
5. ✅ Navigation filtered when location is locked
6. ✅ sectionOrder filtered when location is locked
7. ✅ Envelope teaser redacted when location is locked
8. ✅ Luna y Estrella preserves all current behavior
9. ✅ Render plan preserves section order, interlude placement, personalized-access
10. ✅ pnpm type-check, pnpm lint, pnpm test, pnpm build pass

### Remaining debt

- pickHeroValue, resolveFooterVariant, buildEnvelopeData remain as private helpers in page-data.ts.
  Fine — extract only if another consumer needs them.
- section-render-data.ts still imports InvitationPageContext and InvitationRenderPlanItem from
  page-data.ts. This works because page-data.ts re-exports them.
