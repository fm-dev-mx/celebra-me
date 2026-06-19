---
title: Domain Simplification Packages
status: completed
created: 2026-06-18
updated: 2026-06-19
related_skills:
  - supabase
related_docs:
  - docs/core/architecture.md
  - .agent/rules/intake-publishing.md
  - .agent/rules/invitation-production.md
  - .agent/plans/active/domain-simplification-packages-audit.md
supersedes: []
---

# Domain Simplification Packages

## 1. Executive Summary

Three coordinated work packages that reduce meaningful complexity across Celebra-me without becoming
a repo-wide rewrite.

| Package | Theme                           | Estimated reach | Primary risk                                        |
| ------- | ------------------------------- | --------------- | --------------------------------------------------- |
| 1       | Domain Knowledge Centralization | 8-12 files      | Compound-section discrepancy in registry            |
| 2       | Editor Architecture Tightening  | 6-8 files       | Section-card extraction may miss edge-case styling  |
| 3       | API Route Guard Consolidation   | 12-15 files     | Overlooked route reading `cookies` before the guard |

Each package is independently buildable and testable. No package requires touching the other's
files.

---

## 2. Package 1 — Domain Knowledge Centralization

### Problem

Repeated domain rules and constants across 4+ files create drift risk and make policy changes
require edits in multiple locations.

### Source Evidence

**2a. Location access policy — 5 locations for `'after-rsvp'`**

The magic string `'after-rsvp'` appears in:

| File                    | Lines       | Form                                                       |
| ----------------------- | ----------- | ---------------------------------------------------------- |
| `protected-location.ts` | 47, 85, 113 | Hardcoded string comparisons                               |
| `page-data.ts`          | 150         | `viewModel.sections.location?.visibility === 'after-rsvp'` |
| `use-gated-location.ts` | 44          | `locationVisibility !== 'after-rsvp'`                      |

The Luna-Estrella route check is duplicated:

| File                    | Lines                                        |
| ----------------------- | -------------------------------------------- |
| `protected-location.ts` | 23-25 (`isLunaEstrellaRoute()` — has helper) |
| `page-data.ts`          | 147 (inline duplicate)                       |

Envelope teaser redaction decision logic is split between `page-data.ts` (148-154) and the redaction
execution in `protected-location.ts` (11-21, 52-66). The Luna-Estrella branch has its own inline
redaction that bypasses the shared `redactEnvelopeTeaserWhenLocationLocked` helper.

**2b. Field constants duplicated across mappers**

`VENUE_URL_FIELDS` appears identically in:

- `draft-to-published.mapper.ts` line 14
- `draft-content-mapper.ts` line 16

`ENVELOPE_TEXT_FIELDS` appears identically in:

- `draft-to-published.mapper.ts` lines 19-33 (module constant)
- `draft-content-mapper.ts` lines 431-445 (inline in for-loop)

**2c. Compound-section grouping encoded in 4 places**

The concept "main = title + description + hero" appears in:

| File                             | Lines   | Format                           |
| -------------------------------- | ------- | -------------------------------- |
| `section-content-mapper.ts`      | 6-21    | `SECTION_KEY_MAP`                |
| `invitation-editor.schema.ts`    | 46-140  | `InvitationEditorSectionSchemas` |
| `labels.ts`                      | 176-193 | `EDITOR_SECTION_PRESENTATION`    |
| `invitation-section-registry.ts` | 39-172  | `PUBLIC_SECTION_DEFINITIONS`     |

There is a **real discrepancy**: `invitation-section-registry.ts` line 106 lists
`draftContentKeys: ['location']` for location, omitting `eventTiming`. But
`section-content-mapper.ts` lines 9 and 43-45 include `eventTiming` as part of location. This means
eventTiming edits could be lost when saving via the registry path.

**2d. Dead event-type filtering**

All 8 block files use `supportedEventTypes: [...EVENT_TYPES]`, making `getBlocksForEventType()`
always return all blocks. The per-field `supportedEventTypes` on 2 fields is the only effective
filter.

### Proposed Refactor Boundaries

1. **Location policy authority** — Extract a single module `src/lib/invitation/location-policy.ts`
   that:
   - Defines a `VISIBILITY_AFTER_RSVP` constant
   - Exports `isLunaEstrellaRoute(slug, eventType)` (moved from private)
   - Exports `shouldRedactLocation(section, isConfirmed)` as a pure function
   - Consolidates the envelope teaser decision + execution in one function
   - `page-data.ts` calls the single function instead of duplicating logic
   - `protected-location.ts` and `page-data.ts` import from the same source
   - `use-gated-location.ts` value-imports `VISIBILITY_AFTER_RSVP` instead of hardcoding
     `'after-rsvp'`

2. **Shared field constants** — Move to `src/lib/intake/constants.ts` or a new
   `src/lib/content-publication/_field-constants.ts`:
   - `VENUE_URL_FIELDS` (replace 2 copies)
   - `ENVELOPE_TEXT_FIELDS` (replace 2 copies)
   - Both mappers import from the single source

3. **Compound-section metadata single source** — Extract a single `SECTION_COMPOUND_MAP` record in
   `src/lib/intake/constants.ts` that defines:

   ```ts
   { main: ['title', 'description', 'hero'],
     messages: ['quote', 'thankYou'],
     location: ['location', 'eventTiming'] }
   ```
   - `section-content-mapper.ts` uses it directly (replaces `SECTION_KEY_MAP`)
   - `invitation-section-registry.ts` section definitions reference the compound keys instead of
     duplicating `draftContentKeys`
   - `labels.ts` `EDITOR_SECTION_PRESENTATION` derives from it
   - This fixes the `eventTiming` discrepancy in `invitation-section-registry.ts`

4. **Remove dead event-type filtering** — Remove `supportedEventTypes: [...EVENT_TYPES]` from the 8
   block definitions. Remove `getBlocksForEventType()` and `getBlockTypesForEventType()` from
   `index.ts` if no external caller uses them. Keep per-field `supportedEventTypes` where it is
   actually used (2 fields).

### Why This Reduces Complexity Materially

- Location policy changes become 1-file edits instead of 3+
- New venue URL types (e.g., `wazeUrl`) get added once
- New compound sections don't require 4 edits across 4 files
- `eventTiming` loss bug is fixed
- ~50 lines of dead code removed from block files

### Why This Is Still Safe

- All changes are extract/consolidate — no behavioral changes
- The compound-section consolidation fixes a real discrepancy (registry missing `eventTiming`)
- Location policy becomes a pure function — trivially testable
- Dead code removal has zero user-facing impact

### Files Likely Affected

- `src/lib/invitation/protected-location.ts` — refactor to use shared constants and function
- `src/lib/invitation/page-data.ts` — remove duplicate logic, call shared functions
- `src/lib/invitation/location-policy.ts` — **new file**
- `src/hooks/use-gated-location.ts` — use `VISIBILITY_AFTER_RSVP` constant
- `src/lib/intake/constants.ts` — add `VENUE_URL_FIELDS`, `ENVELOPE_TEXT_FIELDS`,
  `SECTION_COMPOUND_MAP`
- `src/lib/intake/mappers/draft-to-published.mapper.ts` — import constants
- `src/lib/intake/services/draft-content-mapper.ts` — import constants
- `src/lib/intake/services/section-content-mapper.ts` — use `SECTION_COMPOUND_MAP`
- `src/lib/intake/invitation-section-registry.ts` — reference compound keys
- `src/lib/intake/labels.ts` — derive `EDITOR_SECTION_PRESENTATION` from compound map
- `src/lib/intake/blocks/*.block.ts` (8 files) — remove `supportedEventTypes`
- `src/lib/intake/blocks/index.ts` — remove unused helpers

### Tests Likely Affected

- `tests/unit/content-publication.test.ts` — if shared constants move
- `tests/unit/build-demo-drift-report.test.ts` — if VENUE_URL_FIELDS moves
- Location policy tests (if any exist)

### Validation Commands

```bash
pnpm test -- tests/unit/content-publication.test.ts
pnpm test -- tests/unit/build-demo-drift-report.test.ts
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

### Risks and Rollback

| Risk                                                   | Mitigation                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Registry still has other callers of `draftContentKeys` | Audit all callers before changing; keep dual-read pattern during transition |
| `getBlocksForEventType()` called from tests or routes  | Check callers before removal; if called, deprecate instead of remove        |
| Rollback                                               | Each sub-item is a separate commit; revert per commit                       |

### Acceptance Criteria

- [ ] Location policy has one export `shouldRedactLocation()` — no duplicate logic in `page-data.ts`
- [ ] `'after-rsvp'` string appears in exactly 1 file (the constant definition)
- [ ] `VENUE_URL_FIELDS` and `ENVELOPE_TEXT_FIELDS` each defined once
- [ ] Compound-section grouping defined once, used by 4 consumers
- [ ] `eventTiming` included in location compound definition in registry
- [ ] All 8 block files no longer set `supportedEventTypes` to `EVENT_TYPES`
- [ ] `getBlocksForEventType()` removed or proven unused
- [ ] All existing tests pass
- [ ] `pnpm build` succeeds

---

## 3. Package 2 — Editor Architecture Tightening

### Problem

`InvitationEditor.tsx` is 1661 lines with ~25 boolean/union state dimensions that allow impossible
concurrent-operation states. 15 section editors are inlined. `DraftEditor.tsx` has inline validation
and a recreated render helper.

### Source Evidence

**3a. Boolean explosion in `InvitationEditor.tsx`**

The component tracks 5 explicit booleans + 3 union-type state machines + per-section
dirty/error/success matrices. This allows:

- `editor.publishing === true` & `editor.restoring === true` simultaneously (calls different API
  endpoints that could race on context)
- `confirmation === 'publish'` while `editor.restoring === true`
- `savingAll === true` with `editor.savingSection !== null` — the save-all loop calls single-section
  saves internally

The hook (`use-invitation-editor.ts`) has 4 separate loading variables:

| Variable        | Line  | Type                        |
| --------------- | ----- | --------------------------- |
| `savingSection` | 11-13 | `key \| 'metadata' \| null` |
| `publishing`    | 14    | `boolean`                   |
| `reconciling`   | 15    | `boolean`                   |
| `restoring`     | 16    | `boolean`                   |

These should be a single discriminated union.

**3b. 15+ section editors inlined in `InvitationEditor.tsx`**

Countdown (40 lines), RSVP (~120), Music (~45), Envelope (~150), Gifts (~145), Quote (~35), Sharing
(~105) are all inline JSX+logic. Each has its own field handling, error display, and save trigger.

**3c. `DraftEditor.tsx` — inline validation and recreated function**

- `validateContent` (lines 22-69) — validation embedded in component file with hardcoded Spanish
  error strings that duplicate field labels from `labels.ts`
- `renderField` (lines 162-201) — helper component recreated on every render (defined inside the
  component function body)

### Proposed Refactor Boundaries

1. **Discriminated union for operation state** — In `src/hooks/use-invitation-editor.ts`, replace:

   ```ts
   const [savingSection, setSavingSection] = useState<SectionKey | 'metadata' | null>(null);
   const [publishing, setPublishing] = useState(false);
   const [reconciling, setReconciling] = useState(false);
   const [restoring, setRestoring] = useState(false);
   ```

   with:

   ```ts
   const [operation, setOperation] = useState<
     | { type: 'idle' }
     | { type: 'saving-section'; section: SectionKey | 'metadata' }
     | { type: 'publishing' }
     | { type: 'reconciling' }
     | { type: 'restoring' }
   >({ type: 'idle' });
   ```
   - Each mutation method sets `{ type: 'operation-name' }` instead of individual booleans
   - `try/finally` always resets to `{ type: 'idle' }`
   - UI checks `operation.type === 'publishing'` etc.
   - Impossible states (publishing while restoring) become type errors

2. **Extract 3-4 largest section cards** from `InvitationEditor.tsx`:
   - `RsvpSectionEditor` (lines 855-972, ~120 lines)
   - `EnvelopeSectionEditor` (lines 1021-1169, ~150 lines)
   - `GiftsSectionEditor` (lines 1171-1315, ~145 lines)
   - `SharingSectionEditor` (lines 1452-1557, ~105 lines)
   - Each extracted component receives only its props (section data, onChange, onSave) — no
     viewModel or editor state
   - These are pure extract-and-import — no behavioral change

3. **Extract `DraftEditor` validation** to `src/lib/intake/validation/validate-draft-content.ts`:
   - Move `validateContent` function and its `Venue` type
   - Drive error messages from `labels.ts` field labels instead of hardcoded strings
   - `DraftEditor.tsx` imports and calls the function

4. **Extract `renderField`** from `DraftEditor.tsx` to a separate component file
   `src/components/dashboard/intake/FormField.tsx`

### Why This Reduces Complexity Materially

- Impossible operation states become compile-time errors instead of runtime races
- ~520 lines of inline JSX become manageable components
- DraftEditor validation is testable in isolation
- FormField is reusable and not recreated per render

### Why This Is Still Safe

- Discriminated union preserves the exact same guard conditions — just prevents impossible
  combinations
- Section card extraction is pure copy-import — no logic changes
- Validation extraction is a move — error strings are preserved
- FormField extraction is a move — same rendering

### Files Likely Affected

- `src/hooks/use-invitation-editor.ts` — discriminated union
- `src/components/dashboard/intake/editor/InvitationEditor.tsx` — use new state shape, import
  extracted components
- `src/components/dashboard/intake/editor/RsvpSectionEditor.tsx` — **new**
- `src/components/dashboard/intake/editor/EnvelopeSectionEditor.tsx` — **new**
- `src/components/dashboard/intake/editor/GiftsSectionEditor.tsx` — **new**
- `src/components/dashboard/intake/editor/SharingSectionEditor.tsx` — **new**
- `src/components/dashboard/intake/DraftEditor.tsx` — remove validation, remove inline renderField
- `src/components/dashboard/intake/FormField.tsx` — **new**
- `src/lib/intake/validation/validate-draft-content.ts` — **new**
- `src/lib/intake/labels.ts` — may need minor adjustments for validation messages

### Tests Likely Affected

- `tests/components/InvitationEditor.test.tsx` — may need mock updates for new component structure
- `tests/components/DraftEditor.test.tsx` — minor import updates

### Validation Commands

```bash
pnpm test -- tests/components/InvitationEditor.test.tsx tests/components/DraftEditor.test.tsx
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

### Risks and Rollback

| Risk                                                                            | Mitigation                                                            |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Section-card extraction misses a prop that was implicitly available via closure | Audit each extracted section for all closure references before moving |
| Discriminated union changes a type consumed by tests                            | Update test mocks alongside the change                                |
| Rollback                                                                        | Each sub-item is a separate commit; revert per commit                 |

### Acceptance Criteria

- [ ] `use-invitation-editor.ts` has one `operation` state — no standalone booleans
- [ ] No section card in `InvitationEditor.tsx` exceeds 80 lines of inline JSX
- [ ] `DraftEditor.tsx` no longer contains `validateContent`
- [ ] `DraftEditor.tsx` no longer defines functions inside the component body
- [ ] All validation error messages reference labels from `labels.ts`
- [ ] All existing tests pass
- [ ] `pnpm build` succeeds

---

## 4. Package 3 — API Route Guard Consolidation

### Problem

13 admin mutation routes independently reproduce the same 5-step preamble. No shared guard helper
exists for the non-editor admin routes, even though the editor routes already have one
(`requireEditorMutationAccess` in `editor-api.ts`).

### Source Evidence

**4a. 13 routes with identical preamble**

Each of these routes has 6-8 lines of duplicated preamble:

| Route file                                                    | Method               |
| ------------------------------------------------------------- | -------------------- |
| `src/pages/api/dashboard/intake/index.ts`                     | POST                 |
| `src/pages/api/dashboard/intake/[id]/index.ts`                | PATCH                |
| `src/pages/api/dashboard/intake/[id]/draft.ts`                | POST, PATCH          |
| `src/pages/api/dashboard/intake/[id]/review.ts`               | POST, PATCH          |
| `src/pages/api/dashboard/intake/[id]/request.ts`              | POST                 |
| `src/pages/api/dashboard/intake/[id]/edit.ts`                 | PATCH, POST          |
| `src/pages/api/dashboard/intake/[id]/duplicate.ts`            | POST                 |
| `src/pages/api/dashboard/intake/[id]/delete.ts`               | POST (no body parse) |
| `src/pages/api/dashboard/admin/demo-publish/dry-run.ts`       | POST                 |
| `src/pages/api/dashboard/admin/demo-publish/confirm.ts`       | POST                 |
| `src/pages/api/dashboard/admin/users.ts`                      | POST                 |
| `src/pages/api/dashboard/admin/users/[userId]/role.ts`        | PATCH                |
| `src/pages/api/dashboard/admin/users/[userId]/memberships.ts` | PATCH                |

The pattern is:

```ts
try {
  await requireAdminRateLimit(request, 'some:key');
  if (!shouldSkipCsrfValidation(pathname)) validateCsrfToken(request, cookies);
  const session = await requireAdminStrongSession(request);
  const parsed = await validateBodyOrRespond(request, schema);
  if (parsed instanceof Response) return parsed;
  // ... business logic ...
  return jsonResponse(result);
} catch (error) {
  return errorResponse(error);
}
```

**4b. Existing precedent in `editor-api.ts`**

The editor routes already have a consolidated guard:

```ts
export async function requireEditorMutationAccess(
  request: Request,
  cookies: AstroCookies,
): Promise<Session> {
  await requireAdminRateLimit(request, 'admin:editor-mutation');
  if (!shouldSkipCsrfValidation(requestUrl.pathname)) validateCsrfToken(request, cookies);
  return requireAdminStrongSession(request);
}
```

This is proven in production code. The non-editor routes simply lack the same treatment.

### Proposed Refactor Boundaries

1. **Add `requireAdminMutationAccess`** to `src/lib/rsvp/auth/authorization.ts`:

   ```ts
   export async function requireAdminMutationAccess(
     request: Request,
     cookies: AstroCookies,
     rateLimitKey: string,
   ): Promise<Session> {
     await requireAdminRateLimit(request, rateLimitKey);
     if (!shouldSkipCsrfValidation(new URL(request.url).pathname))
       validateCsrfToken(request, cookies);
     return requireAdminStrongSession(request);
   }
   ```

2. **Update the 13 route handlers** to replace the 6-8 line preamble with:

   ```ts
   const session = await requireAdminMutationAccess(request, cookies, 'admin:my-operation');
   ```

3. Leave `validateBodyOrRespond` call in the route — the guard helper does not absorb body parsing.
   This keeps the body-schema declaration visible in the route handler where the business logic
   lives.

4. Do **not** touch the existing editor routes — they already use their own
   `requireEditorMutationAccess`. Do **not** replace it with the new helper unless the editor guard
   is proven identical (it is, but changing it adds unnecessary diff noise).

### Why This Reduces Complexity Materially

- ~100 lines of identical preamble removed across 13 route files
- One canonical security ordering for all non-editor admin mutations
- Follows the same pattern already accepted in the editor domain
- Makes adding a new mutation route a 1-line guard + business logic

### Why This Is Still Safe

- Mirrors an existing, proven pattern in `editor-api.ts`
- No behavioral change — same functions called in same order
- Rate-limit key stays visible at the call site (not hidden)
- CSRF skip logic still evaluated at call time

### Files Likely Affected

- `src/lib/rsvp/auth/authorization.ts` — add `requireAdminMutationAccess`
- 13 route handler files (listed above)

### Tests Likely Affected

- `tests/api/dashboard.content-sync.test.ts` — uses mock of `requireAdminStrongSession`, not
  affected by new wrapper
- `tests/api/dashboard.intake.test.ts` — same, mocks are at the `requireAdminStrongSession` level
- If tests mock individual guards but not the wrapper, they need a mock update for the new function
  name

### Validation Commands

```bash
pnpm test -- tests/api/dashboard.content-sync.test.ts tests/api/dashboard.intake.test.ts
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

### Risks and Rollback

| Risk                                                                                | Mitigation                                                                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A route reads `cookies` or `request.url` before the guard, changing guard semantics | Audit each route before change; if any route reads these before the guard, keep it as-is    |
| Test mocks target individual guards and break with new wrapper                      | Update test mocks: mock `requireAdminMutationAccess` instead of `requireAdminStrongSession` |
| Rollback                                                                            | Each route is a separate commit; revert per commit or revert the helper addition            |

### Acceptance Criteria

- [ ] `requireAdminMutationAccess` exported from `authorization.ts`
- [ ] 13 route handlers use the new helper
- [ ] No route handler changed behavior (same guard ordering)
- [ ] All existing tests pass
- [ ] `pnpm build` succeeds

---

## 5. Implementation Strategy

### Phase 1 — Foundation (Package 1 + 3)

Commit strategy:

1. `refactor(location): centralize location access policy constants and functions`
   - New `location-policy.ts`
   - Update `protected-location.ts`, `page-data.ts`, `use-gated-location.ts`

2. `refactor(intake): consolidate duplicated field constants`
   - `VENUE_URL_FIELDS`, `ENVELOPE_TEXT_FIELDS` into `constants.ts`
   - Update both mappers

3. `refactor(intake): unify compound-section metadata in single source`
   - `SECTION_COMPOUND_MAP` in `constants.ts`
   - Update all 4 consumers, fix `eventTiming` registry gap

4. `chore(intake): remove dead event-type filtering from block definitions`
   - Remove `supportedEventTypes: [...EVENT_TYPES]` from 8 files
   - Remove unused helpers from `index.ts`

5. `refactor(api): add requireAdminMutationAccess helper`
   - New function in `authorization.ts`
   - Update 13 route handlers

Validation after Phase 1:

```bash
pnpm type-check && pnpm lint && pnpm test && pnpm build
```

### Phase 2 — Editor (Package 2)

Commit strategy:

6. `refactor(editor): consolidate operation states into discriminated union`
   - `use-invitation-editor.ts` change
   - Update `InvitationEditor.tsx` guards

7. `refactor(editor): extract largest section cards to separate components`
   - Rsvp, Envelope, Gifts, Sharing section editors
   - Update `InvitationEditor.tsx` imports

8. `refactor(editor): extract DraftEditor validation and FormField`
   - `validate-draft-content.ts`
   - `FormField.tsx`
   - Update `DraftEditor.tsx`

Validation after Phase 2:

```bash
pnpm type-check && pnpm lint && pnpm test && pnpm build
```

### Phase 3 — Tests and Cleanup

9. Add targeted tests for:
   - `shouldRedactLocation()` in location-policy
   - `validateDraftContent()` in validate-draft-content
   - Discriminated union invariants in use-invitation-editor

10. Verify no dead imports remain (run lint with unused-import check)

Final validation:

```bash
pnpm type-check && pnpm lint && pnpm test && pnpm build && pnpm agent:git-safety:check
```

---

## 6. Explicit Non-Goals

- Do not touch RSVP runtime behavior or RSVP domain files
- Do not touch theme/assets architecture or section SCSS
- Do not modify public invitation rendering components
- Do not change SQL/migrations/database workflows
- Do not extract a generic permissions framework
- Do not introduce classes, facades, or state machine libraries
- Do not perform broad folder reorganization
- Do not touch the existing `requireEditorMutationAccess` in editor-api.ts
- Do not absorb `validateBodyOrRespond` into the route guard helper

---

## 7. Graphify Usage

If Graphify is available, use it for:

- Before Phase 1: Confirm the `page-data.ts` → `protected-location.ts` import is the canonical path
- Before Phase 2: Verify `InvitationEditor.tsx` import footprint to ensure no other component
  depends on the inlined section cards
- After each phase: Run `pnpm ops graphify-views` to verify that cross-boundary link counts decrease
  where expected

Do not let Graphify visualization become the success metric. The acceptance criteria above are the
ground truth.

---

## 8. Post-Implementation Audit

See [domain-simplification-packages-audit.md](./domain-simplification-packages-audit.md) for the
complete post-implementation gap analysis, including pending route updates, test coverage gaps,
intentional deviations from the original plan, and a prioritized action summary.
