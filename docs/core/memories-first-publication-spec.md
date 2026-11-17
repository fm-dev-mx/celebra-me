# Memories on the First Publication — Specification

Status: proposed (specification only; no code changes). Origin: publication audit, improvement C4.

## Problem

An invitation whose published content carries `memories.publicSlug` cannot be published for the
first time in one release. The two prerequisites reference each other:

- The publish gate `assertManagedMemoriesReference`
  (`scripts/provision/managed-memories-reference.ts`) reads the target database before the apply
  (called from `scripts/provision/invitation-import-engine.ts` in the hosted path and
  `scripts/provision/apply-local-invitation.ts` in the local path). It evaluates
  `evaluateMemoriesSpaceReference` (`src/lib/memories/contract/space-reference.ts`), which returns
  `block` when:
  - the target has no event yet (`event-missing`);
  - no space uses the slug, or its event is soft-deleted (`space-missing`);
  - the space belongs to another event (`space-other-event`).
- The space (`event_memory_settings`, keyed by `event_id`, unique `public_slug`) can only be created
  by `createMemorySpaceAdmin` (`src/lib/memories/server/admin.service.ts`), which requires an event
  with `status === 'published'`. The event exists only after the apply.

Cycle: apply needs the space → the space needs the published event → the event needs the apply.
Today the message itself prescribes the workaround: publish without memories, create the space, then
publish again with the section. That costs an extra release (Camila Beltrán: `prod:apply` blocked
with `MEMORIES_SPACE_REFERENCE`, about 37 minutes and one extra release, PR #1018). CI and Preview
do not catch it, because they never prove that the space exists in Production.

## Options

### A. Create the space inside the same apply

The apply creates the event and, in the same transaction, inserts the `event_memory_settings` row
from a new package declaration (schedule, time zone, limit profile). The gate is replaced by "space
exists or this plan creates it for this event".

- Pros: one release, one plan, nothing to remember afterwards.
- Cons: the apply mutates a table it does not own today; requires the plan/diff/rollback machinery
  to understand a second table; the Production apply grows a new write whose defaults (schedule,
  limits, entitlement) are commercial decisions; the admin rule "only published events have spaces"
  must be relaxed or bypassed; larger blast radius.

### B. Publish without the section and activate it in the same plan (recommended)

The apply is split inside one plan into ordered steps against the same target:

1. Publish the invitation with `memories` stripped from the published content (the draft keeps it).
2. Create the space for the now-existing event, using the same code path as the admin
   (`createMemorySpaceAdmin` semantics, not a second writer).
3. Re-evaluate the gate against the real row, then publish the content with `memories`.

The gate keeps its current meaning for steps 3 and for every later update; only the plan decides
when step 2 is allowed.

- Pros: reuses the admin creation rules and the existing gate unchanged; each step is individually
  idempotent and verifiable; the guest-visible section never appears before the space exists.
- Cons: briefly two published versions in one run (the section-less one is live until step 3); needs
  a plan model with an ordered, resumable sequence.

### Decision

Choose **B**. It keeps one writer for spaces (the admin service rules: published event, validated
schedule, audit row `space_created`), keeps `evaluateMemoriesSpaceReference` as the single safety
gate, and limits the new behavior to plan orchestration.

## Specification (option B)

### Ownership

- A space belongs to exactly one event (`event_id` primary key) and `public_slug` is the printed QR
  contract: unique and never changed after creation.
- The plan may create a space only for the event it is publishing in the same run, and only when no
  row uses that `public_slug`. A row owned by another event is always a hard `block`
  (`space-other-event`); the plan never reassigns or edits another event's space.
- The event is resolved by the target's event row after step 1, never by the slug in the content.

### Declaration

The package declares intent explicitly (a `memories.space` block with time zone, window and limit
profile), validated at `validate`/plan time, not at apply time. Without the declaration, and without
an existing space, the plan reports `MEMORIES_SPACE_REFERENCE` at plan time (earlier than today)
with the same message. Defaults come from the same helpers as `listMemorySpaceCandidatesAdmin`.

### Idempotency

- Re-running a plan whose step 1 is done and step 2 is not: creates the space and continues.
- Re-running when the space already exists for this event (same `public_slug`, same `event_id`):
  step 2 is a no-op and is reported as `unchanged`; stored limits and schedule are never
  overwritten.
- Re-running after step 3: whole plan is a no-op.
- A unique violation on `public_slug` during step 2 is re-read: same event → success; other event →
  block. No retry loop.

### Rollback

- Step 3 fails: the section-less version stays published and valid; the space stays (it holds no
  guest data yet). The plan reports `partial` with the next command; re-run resumes at step 3.
- Step 2 fails: nothing to undo; the published invitation is the valid section-less version.
- The plan never deletes a space it created: `event_memory_*` tables reference it with
  `on delete restrict` and guests may already have uploaded. Removal stays a manual, audited admin
  action.
- Reverting the invitation to a prior release uses the existing release rollback; it leaves the
  space disabled-by-section (no reference), which the gate treats as harmless.

### Authorization

| Action                                                    | Who authorizes |
| --------------------------------------------------------- | -------------- |
| Spec, tests, local and Preview runs (including the space) | Agents         |
| `prod:apply` that creates a Production space              | Owner (Paco)   |
| Defaults for limits, entitlement and windows on new sales | Owner (Paco)   |

A plan that includes a space creation must say so explicitly in the Production window summary, so
the owner approves the new write once, together with the release, instead of in a later command.

## Tests the implementation must add

1. Unit (`space-reference`): event-missing and space-missing findings distinguish "plan will create"
   from "must exist"; other-event stays `block`.
2. Plan: package with `memories` and no space/no event → ordered steps 1–3; without declaration →
   `MEMORIES_SPACE_REFERENCE` at plan time.
3. Idempotency: run the plan twice on a disposable database; second run reports `unchanged` and does
   not change `updated_at` or limits of the space.
4. Ownership: a space with the same slug owned by another event blocks and writes nothing.
5. Resume: fail after step 2 (injected); re-run completes step 3 only.
6. Unique-violation race: two concurrent runs; exactly one space row, both end consistent.
7. Preview run of the whole flow end to end on a new slug, with the evidence kept in the PR.
8. Regression: published invitations without `memories` keep a byte-identical plan.

All database tests use `disposable-test` (resets) or Preview; none touch Production.

## Out of scope

Option A, changing entitlement defaults, deleting spaces, and any Production run. Implementation is
a separate high-risk task.
