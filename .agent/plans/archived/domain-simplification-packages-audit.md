---
title: Domain Simplification Packages — Post-Implementation Audit
status: archived
archived_date: 2026-06-25
unresolved_gaps:
  - Gap A:
      2 route handlers missing requireAdminMutationAccess
      (src/pages/api/dashboard/intake/[id]/request/revoke.ts POST,
      src/pages/api/dashboard/intake/[id]/request/unrevoke.ts POST)
created: 2026-06-19
supersedes: []
---

# Post-Implementation Audit — Identified Gaps

After implementing the three packages, a detailed comparison against the original plan revealed the
following gaps and deviations.

## Gap A — 2 routes not updated (HIGH)

The original plan listed 13 route handlers for `requireAdminMutationAccess`, but these 2 additional
routes share the same preamble pattern (rate-limit + CSRF + strong-session) and were overlooked:

| Route file                                                        | Method |
| ----------------------------------------------------------------- | ------ |
| `src/pages/api/dashboard/intake/[id]/request/revoke.ts`           | POST   |
| `src/pages/api/dashboard/intake/[id]/request/regenerate-token.ts` | POST   |

**Action**: Update both to use `requireAdminMutationAccess`. No behavioral change.

## Gap B — RESOLVED: CSRF intentionally added

`src/pages/api/dashboard/admin/events/[eventId].ts` PATCH was migrated to
`requireAdminMutationAccess`, which added CSRF validation. This was a deliberate behavioral change
(strict security posture).

| File                              | Guard after migration        | CSRF status |
| --------------------------------- | ---------------------------- | ----------- |
| `admin/events/[eventId].ts` PATCH | `requireAdminMutationAccess` | Added       |

**Action**: No further action needed.

## Gap C — Missing targeted unit tests (MEDIUM)

The plan's Phase 3 specified targeted tests that were not implemented:

| Test target                                        | Status     | Location                                                   |
| -------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| `validateDraftContent()`                           | ❌ Missing | No test file exists                                        |
| Discriminated union invariants (`EditorOperation`) | ❌ Missing | No test references `editor.operation` or `EditorOperation` |

**Impact**: The functionality is exercised indirectly through `InvitationEditor.test.tsx` and
`DraftEditor.test.tsx`, but there are no isolated unit tests for:

- Required hero/quote/thankYou/rsvp field validation (6 rules)
- Impossible state prevention (publishing while restoring)
- `saving-all` variant with `currentSection` tracking

**Action**: Add targeted tests for both targets.

## Gap D — Intentional deviations from plan (LOW)

| Aspect                             | Plan said                            | Implemented                                                                        | Reason                                                                              |
| ---------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Function name                      | `shouldRedactLocation()`             | `isLocationLocked()`                                                               | Revision #2: clear predicate/transformer boundary                                   |
| `EDITOR_SECTION_PRESENTATION`      | derive from `SECTION_COMPOUND_KEYS`  | kept separate                                                                      | Revision #5: UI labels are presentation, not compound grouping                      |
| `DraftEditor.tsx` inline functions | "no functions inside component body" | `renderField` still defined inline but delegates to `<FormField>`                  | Revision #8: only large inline structures removed; normal React handlers acceptable |
| `'after-rsvp'` count criterion     | "appears in exactly 1 file"          | relaxed to "no production implementation comparisons use the literal"              | Revision #4: schema literals, tests, fixtures, docs exempt                          |
| Event-type filtering               | `getBlocksForEventType()` removed    | Removed from `index.ts`; `BlockSelector.tsx` updated to `getAllBlockDefinitions()` | Correct — function had no remaining callers                                         |
| Shared predicate for publish       | `canPublishByStatus()`               | Implemented outside this plan in a prior session                                   | Pre-dates this plan; consistent with its direction                                  |

## Gap E — Low-risk test coverage gap

The `section-content-mapper.test.ts` round-trip test (`getSectionValue` + `applySectionValue`) uses
`as any` for the fixture DraftContent, losing type-level verification that `eventTiming` is
correctly routed. The runtime assertion is correct (passes), but the fixture type is not enforced.

**Action**: Low priority. Can be improved when the `DraftContent` type gains a factory/helper for
partial fixtures.

## Summary of pending items

| Priority   | Item                                                                          | Files           | Estimated effort |
| ---------- | ----------------------------------------------------------------------------- | --------------- | ---------------- |
| **High**   | Migrate `revoke.ts` and `regenerate-token.ts` to `requireAdminMutationAccess` | 2 route files   | 5 min            |
| **Medium** | Add unit test for `validateDraftContent()`                                    | 1 new test file | 10 min           |
| **Medium** | Add unit test for discriminated union invariants                              | 1 new test file | 15 min           |
| **Low**    | Type fixtures in `section-content-mapper.test.ts`                             | 1 test file     | 5 min            |
