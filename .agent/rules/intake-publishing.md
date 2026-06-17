# Intake / Publish State Machine

## Status Constants

All status enums are defined in `src/lib/intake/types.ts`:

| Constant                       | Values                                                                                                                               | Used by                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `InvitationStatus`             | `draft`, `waiting_for_client`, `client_submitted`, `in_review`, `in_production`, `preview_sent`, `approved`, `published`, `archived` | `invitations` table               |
| `InvitationContentDraftStatus` | `draft`, `reviewed`, `approved`                                                                                                      | `invitation_content_drafts` table |
| `ContentSource`                | `draft`, `published`, `demo`, `empty`, `mixed`                                                                                       | Derived, not persisted            |
| `IntakeRequestStatus`          | `draft`, `active`, `submitted`, `closed`, `expired`                                                                                  | `intake_requests` table           |
| `IntakeSubmissionStatus`       | `in_progress`, `submitted`, `needs_changes`, `approved`                                                                              | `intake_submissions` table        |

See also `src/lib/intake/repositories/` for the repository layer and
`src/lib/dashboard/dto/intake.ts` for DTO type annotations.

Note: `InvitationContentDraftStatus` includes `'reviewed'` in its type definition, but no current
code path writes `'reviewed'` to `invitation_content_drafts.status`. This is an existing domain
model concern that requires a separate decision — do not rely on `'reviewed'` being reachable today.

## Transition Boundaries

Most status transitions are self-service via the metadata API (`saveInvitationEditorMetadata`). One
transition is code-enforced:

- **`draft` → `approved`** (on `InvitationContentDraftStatus`): enforced by `publishDraft()` —
  checks `draft.status === 'draft'`, rejects others with 422 `invalid_draft_status`.
- On publish success, both `InvitationStatus` is set to `'published'` and
  `InvitationContentDraftStatus` advances from `'approved'` onward.
- All other `InvitationStatus` values can be set through the metadata API without service-layer
  guards.

## Draft → Editor → Publish Flow

### Editor context (`getInvitationEditorContext`)

Read-only composition: loads `invitation` + `draft` + `published` rows, derives `contentSource` via
`mergePublishedWithDraft`, and returns a context DTO. No mutations.

### Save section (`saveInvitationEditorSection`)

- Seeds content from `draft?.content ?? published?.content ?? {}`
- Writes or updates the draft row with `status = 'draft'`
- Uses optimistic locking via `updateDraftContentConditionally` (conflict → 409)

### Save metadata (`saveInvitationEditorMetadata`)

- Writes invitation metadata including any `status` value (arbitrary transitions allowed)
- Checks slug uniqueness before writing (conflict → 409)
- Uses optimistic locking (`updateInvitationConditionally`)

### Restore from published (`restoreInvitationEditorFromPublished`)

- Copies published content into a new draft with `status = 'draft'`
- Fails with 404 if no published content exists

### Publish (`publishDraft`)

Guards in `publishing.service.ts` cover: invitation/draft existence, draft validity (status +
non-empty content), config resolution (snapshot, client, asset slug), content integrity (timing,
schema, asset resolvability), and slug/RSVP conflicts. See the publish function and its test suite
for the full guard list.

On success: draft `status = 'approved'`, published content upserted (version incremented),
invitation `status = 'published'`, RSVP event synchronized.

### Demo publish

Separate flow in `src/lib/content-publication/` with its own `DemoDriftStatus`. Dry-run → confirm
two-phase. Protected by `assertSafeTarget()` (blocks if `prodRow.isDemo !== true`) and stale-content
hash comparison.

## Content Source Derivation

`mergePublishedWithDraft()` in `src/lib/intake/services/merge-content.service.ts` computes
per-section `SectionSource`:

```
Priority per section: draft > published > demo > empty
```

`ContentSource` is the aggregate:

- All `empty` → `'empty'`
- All same non-empty source → that source
- Mixed → `'mixed'`

`PublicationState.hasUnpublishedChanges` is derived as `draft?.status === 'draft'` (a draft exists
and hasn't been approved).

## Optimistic Locking

Optimistic locking is used in editor save paths (`updateDraftContentConditionally`,
`updateInvitationConditionally`) — conflict returns null, service throws 409.

Operations without locking (`upsertDraft`, `upsertPublishedContent`, `updateDraftStatus`) are a
known risk. These are candidates for a separate fix — do not rely on them for write safety.

The conflict error message is:
`"Otra persona guardó cambios antes que tú. Recarga los datos para continuar."`

## Repository Return Contracts

The service layer relies on these implicit contracts from the repository layer:

1. **`findDraftByInvitationId`** returns `null` when no draft row exists (used as branch condition
   in 6+ locations)
2. **`findPublishedByInvitationId`** returns `null` when no published row exists (used as branch
   condition in 5+ locations)
3. **`updateDraftContentConditionally`** returns `null` when no row matches the `updated_at` filter
   (optimistic lock conflict)
4. **`updateInvitationConditionally`** returns `null` on optimistic lock conflict
5. **`ACTIVE_FILTER`** (`deleted_at IS NULL`) applies to all repository `find` queries —
   soft-deleted rows are invisible
6. **`upsertPublishedContent`** finds existing row to branch between INSERT and UPDATE — no DB-side
   upsert

Repositories at `src/lib/intake/repositories/`.
