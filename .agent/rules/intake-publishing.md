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
- A meaningful public title or route-slug edit on an already published invitation reopens (or seeds)
  a `draft`, so it is represented in the publication preflight. Client-contact-only changes do not
  create a pending-publication state.

### Restore from published (`restoreInvitationEditorFromPublished`)

- Replaces editable content with a reverse-mapped copy of the public snapshot and resets public
  title/slug metadata to that snapshot; client contact and operational metadata are preserved.
- Reuses the current draft row when present, sets `status = 'draft'`, and clears draft-only fields
  such as `photoNotes`. When no draft exists, it creates one.
- Optimistically checks both invitation and draft revisions. A concurrent save returns 409; missing
  published content returns 404.

### Publish (`publishDraft`)

Guards in `publishing.service.ts` cover: invitation/draft existence, draft validity (status +
non-empty content), config resolution (snapshot, client, asset slug), content integrity (timing,
schema, asset resolvability), and slug/RSVP conflicts. See the publish function and its test suite
for the full guard list.

On success: draft `status = 'approved'`, published content upserted (version incremented),
invitation `status = 'published'`, RSVP event synchronized.

### Publication presentation and guest capacity

The preflight response is the sole source for confirmation-summary labels. It uses semantic
draft-versus-public comparison, canonical registry order, and unique labels; `photoNotes` is
draft-only. The modal renders it verbatim, remains mounted during requests, announces loading,
error, and success, and keeps failures inside the dialog. Only the centralized transient-error
classification permits retry. Conflicts, validation failures, idempotency-input conflicts, and
`publish_upgrade_required` require a new action instead.

`guestCap` is the configurable maximum total attendees in one RSVP response, including the named
guest. Any positive integer supported by the PostgreSQL `integer` column is valid. Editor, public
RSVP, dashboard guest operations, and persistence share that contract and must not apply a smaller
product-level clamp.

### Cache policy

Anonymous invitations use `public, max-age=0, s-maxage=0, must-revalidate`. Personalized invitation
and metadata routes, dashboard preview, intake-token capture, preflight/publication and RSVP APIs,
all invitation errors, validation/conflict/auth failures, and redirects use `no-store, private`.
Verify Vercel/CDN freshness only after deployment.

The editor obtains an authorized, read-only canonical server preflight before confirmation. It
compares the mapped effective draft against published content after normalizing empty values, object
key ordering, and derived upload URLs, and sends `Cache-Control: no-store, private`. The
confirmation carries draft and published baselines, a public metadata hash (`slug` + `title`), a
projection hash, and a client-generated UUID idempotency key. The atomic RPC locks all three records
and rejects a stale public or draft baseline; contact-only metadata changes do not invalidate
confirmation. A globally unique idempotency record binds the request to its result, so an exact
retry returns the already-completed publication without a second version bump while a key reused
with different parameters is rejected.

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

Editor metadata-reopen and restore-from-published commit through atomic RPCs that share the
managed-mutation receipt contract in `docs/core/architecture.md` with
`pnpm invitation:release` where applicable.

The publication path does not rely on the non-transactional repository helpers
(`upsertPublishedContent`, `updateDraftStatus`) for write safety; it commits through the atomic RPC.
`upsertDraft` remains limited to draft initialization/reopening and must not be used as a substitute
for publication concurrency protection.

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

## Publication RPC rollout and receipts

`20260717193000_publication_preflight_integrity.sql` is phase one. It introduces the current RPC and
keeps the historical seven-argument overload as a service-role-only, fail-closed
`publish_upgrade_required` stub. Apply it first, deploy application and operational consumers of the
new contract, monitor legacy stub calls until cached instances drain, then use a separately reviewed
cleanup migration to remove the stub. The overlap intentionally provides publication-only
maintenance.

The idempotency receipt binds invitation/draft revisions, expected published version and content
fingerprint, public metadata baseline, projection, publication inputs, and exact JSON response. It
is retained for the invitation/draft lifetime with `ON DELETE RESTRICT`: at most one row is added
per successful confirmation, so growth is linear and no scheduled cleanup is justified. A retry
reaches database receipt replay even after approval; non-identical approved-draft requests remain
invalid. Public metadata includes slug, title, event type, base demo, theme, kind, snapshot, status,
and archive availability; contact and operational fields are excluded.
