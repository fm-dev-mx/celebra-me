# Intake / Publish State Machine

## Status Constants

All status enums are defined in `src/lib/intake/types.ts`:

| Constant                       | Values                                                                                                                               | Used by                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `InvitationStatus`             | `draft`, `waiting_for_client`, `client_submitted`, `in_review`, `in_production`, `preview_sent`, `approved`, `published`, `archived` | `invitations` table               |
| `InvitationContentDraftStatus` | `draft`, `reviewed`, `approved`                                                                                                      | `invitation_content_drafts` table |
| `ContentSource`                | `draft`, `published`, `empty`, `mixed`                                                                                               | Derived, not persisted            |
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

## Content Contracts (Draft vs Published)

Two distinct representations exist and must never be interchanged:

| Representation    | Shape                                                       | Storage                        |
| ----------------- | ----------------------------------------------------------- | ------------------------------ |
| Published content | Nested persisted/public model (`eventContentSchema`)        | `published_invitation_content` |
| Draft content     | Flat editable model (`InvitationContentDraftContentSchema`) | `invitation_content_drafts`    |

`family` is where the two diverge most: published uses `parents`, `labels`, `spouse`, `children[]`,
`godparents[]`, `godparentGroups[].godparents`, `groups[].items`; the draft uses
`fatherName`/`motherName`, flat label keys, `spouseName`, `children` as a string, `godparents` as a
string, `godparentGroups[].names`, `groups[].names`.

**Date/time ownership (canonical machine contract):**

| Field                                                    | Owner                                                | Canonical form                 | Notes                                            |
| -------------------------------------------------------- | ---------------------------------------------------- | ------------------------------ | ------------------------------------------------ |
| `eventTiming.localDateTime` / `timeZone` / `startsAtUtc` | Top-level `eventTiming`                              | `YYYY-MM-DDTHH:mm` + IANA zone | Countdown / calendar; independent of venue times |
| Venue `date`                                             | `location.venues[]` or legacy `ceremony`/`reception` | `YYYY-MM-DD`                   | Independent per venue                            |
| Venue `time`                                             | same                                                 | `HH:mm`                        | Independent per venue                            |
| Itinerary item `time`                                    | `itinerary.items[]`                                  | `HH:mm`                        | Independent of venue times                       |

Do not create fallback chains between `eventTiming` and venue date/time. Legacy Published Spanish
prose (`28 de noviembre de 2026`, `5:30 p. m.`) is accepted only at the Published→Draft / display
normalization boundary (`toEditorDate` / `normalizeTime` / `formatVenueDateForDisplay` /
`formatVenueTimeForDisplay`). New writes emit machine form. Publication comparison treats equivalent
spellings as equal during the transition. Inventory legacy Published values with
`pnpm invitation:published-audit` (read-only).

**`showFlourishes` ownership:** canonical field is `location.presentationOptions.showFlourishes`.
Legacy `sectionStyles.location.showFlourishes` is inspected only by the read-only audit/migration
boundary and is rejected by canonical publication input. It must not be folded by the adapter or new
draft mapper.

Location navigation visibility follows the same boundary:
`location.presentationOptions.showNavigationButtons` is canonical; legacy section-style values are
audit/migration input only and are rejected by the canonical adapter path.

Canonical conversion boundaries — do not add parallel mappings:

| Direction                 | Function                                             | Location                                              |
| ------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| Published → Draft         | `mapNestedToDraftContent`                            | `src/lib/intake/services/draft-content-mapper.ts`     |
| Draft → Draft (canonical) | `normalizeDraftContent` / `canonicalizeDraftContent` | `src/lib/intake/services/draft-content-mapper.ts`     |
| Draft → Published         | `mapDraftToPublished`                                | `src/lib/intake/mappers/draft-to-published.mapper.ts` |

Rules:

- **Raw published content must never be persisted as a draft baseline.** Seeding a draft from a
  published revision always goes through `mapNestedToDraftContent`.
- Persisted drafts must not carry published-only content: `theme`, `templateId`, `visualProfileId`,
  `_assetSlug`, `isDemo`, `navigation`, `sectionStyles`, `rsvp.personalizedAccess.noteText`,
  `rsvp.whatsappConfig` (folded to `whatsappPhone`), legacy `location.indications[].icon`, or
  obsolete `countdown.subtitlePrefix`. Publish restores published-only fields from the invitation
  record or the prior published revision.
- `normalizeDraftContent` is the single legacy-draft migration boundary. Editor hydration, preview,
  publish projection, and draft writes must emit the canonical contract; no runtime adapter or
  publish mapper may normalize legacy aliases.
- Legacy draft migration is deterministic, idempotent, and non-destructive, and throws
  `DraftNormalizationError` with explicit paths instead of dropping data it cannot express.
- `mapDraftToPublished` stays strict: it rejects a family draft that still holds published-shaped
  structures rather than silently dropping `groups`, `children` or `godparentGroups`.
- Discard an obsolete draft with
  `pnpm invitation:draft-restore --slug <slug> --entire --target <env>`. (read-only dry-run by
  default; Preview writes need YES on a TTY or `CELEBRA_TASK_SCOPE=preview:<slug>:draft-restore`;
  Production writes require a backup manifest and owner confirmation).
- Detect non-canonical persisted drafts (read-only) with
  `pnpm invitation:draft-audit --slug <slug> --target <env>` or inventory all drafts with
  `pnpm invitation:draft-audit --all --target <env>`.
- Restore uses one domain service (`draft-restore.service.ts`):
  - `restoreDraftSection` — replace one editable section from published → flat Draft;
  - `restoreEntireDraft` — replace the full draft (and public title/slug via the atomic RPC).
    Editor/API and `pnpm invitation:draft-restore` are facades over that planner; Published is never
    written by restore.

## Editor Surface

The dashboard editor under `/dashboard/invitaciones` edits existing managed invitations only; it has
no create or duplicate endpoint (`src/pages/api/dashboard/intake/index.ts` exports `GET` only). The
end-to-end operation lives in
[`docs/domains/intake/production-flow.md`](../../docs/domains/intake/production-flow.md).

- The editor consumes flat `DraftContent`, never raw published shapes.
- Saving a section replaces that section object, so every editable field must exist in the editor
  schema, draft schema, both mapping directions, preview, publication, adapter, and renderer.
- Preview and publication merge the draft with the prior published snapshot and remap it through
  `mapDraftToPublished` with `priorPublishedContent`. Published-only values that are not
  dashboard-editable (`visualProfileId`, `composition`, `navigation`, managed `memories`,
  `thankYou.date`, `thankYou.closingPhrase`) are carried from the prior revision on both paths.
- Section restore ("Restaurar versión publicada") and full draft restore reuse `restoreDraftSection`
  / `restoreEntireDraft`.
- The public read path validates stored JSON against the canonical schema before adaptation. Invalid
  stored content resolves to the invitation-unavailable state and is not publicly cached.
- Host share-message edits from the guests dashboard are a narrow exception documented in
  [`docs/core/content-parity-rsvp-isolation.md`](../../docs/core/content-parity-rsvp-isolation.md):
  they patch published `sharing` only and increment `version` / `published_at`.

## Administrative Work Status

The dashboard list separates work status from publication and manual review. The `invitations` row
owns these fields; `PATCH /api/dashboard/intake/[id]/workflow` writes them with optimistic locking
(migration `20260910160000_invitation_workflow.sql`).

- `in_progress` / `completed` are administrative decisions. Neither changes publication, content
  parity, visual acceptance, RSVP, or release checks. New rows start in progress with no review.
- Only the owner account may record or clear a manual review; agents must never invoke that action,
  including through browser automation. Agents may change work status within an authorized task. The
  recorded date is historical, not certification of the current deployment.
- Client database roles cannot write these fields directly. Publication and environment
  synchronization must not copy administrative decisions between environments.
- An application rollback keeps the additive columns and recorded decisions.

## Draft → Editor → Publish Flow

### Editor context (`getInvitationEditorContext`)

Read-only composition: loads `invitation` + `draft` + `published` rows, derives `contentSource` via
`mergePublishedWithDraft`, and returns a context DTO. No mutations.

### Save section (`saveInvitationEditorSection`)

- Seeds the baseline as canonical flat `DraftContent`: `normalizeDraftContent(draft.content)` when a
  draft exists, otherwise `mapNestedToDraftContent(published.content)`, otherwise `{}`
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

The `guestCap` contract is owned by the
[production runbook](../../docs/domains/intake/production-flow.md#7-publish).

### Cache policy and preflight

Cache headers follow
[`public-response-cache-policy.md`](../../docs/domains/invitations/public-response-cache-policy.md).

The editor obtains an authorized, read-only canonical server preflight before confirmation. It
compares the mapped effective draft against published content after normalizing empty values, object
key ordering, and derived upload URLs, and sends `Cache-Control: no-store, private`. The
confirmation carries draft and published baselines, a public metadata hash (`slug` + `title`), a
projection hash, and a client-generated UUID idempotency key. The atomic RPC locks all three records
and rejects a stale public or draft baseline; contact-only metadata changes do not invalidate
confirmation. A globally unique idempotency record binds the request to its result, so an exact
retry returns the already-completed publication without a second version bump while a key reused
with different parameters is rejected.

Demos have no publication flow: they are versioned JSON under `src/content/event-demos/`, rendered
from Git and never mirrored into the database.

## Content Source Derivation

`mergePublishedWithDraft()` in `src/lib/intake/services/merge-content.service.ts` computes
per-section `SectionSource`:

```
Priority per section: draft > published > empty
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
managed-mutation receipt contract in `docs/core/architecture.md` with `pnpm invitation:release`
where applicable.

The publication path does not rely on the non-transactional repository helper `updateDraftStatus`
for write safety; it commits through the atomic RPC. `upsertDraft` remains limited to draft
initialization/reopening and must not be used as a substitute for publication concurrency
protection.

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

Repositories at `src/lib/intake/repositories/`.

## Publication RPC and receipts

`20260717193000_publication_preflight_integrity.sql` introduced the current publication RPC;
`20260911070000_remove_obsolete_publication_overload.sql` removed the retired seven-argument
overload.

The idempotency receipt binds invitation/draft revisions, expected published version and content
fingerprint, public metadata baseline, projection, publication inputs, and exact JSON response. It
is retained for the invitation/draft lifetime with `ON DELETE RESTRICT`: at most one row is added
per successful confirmation, so growth is linear and no scheduled cleanup is justified. A retry
reaches database receipt replay even after approval; non-identical approved-draft requests remain
invalid. Public metadata includes slug, title, event type, base demo, theme, kind, snapshot, status,
and archive availability; contact and operational fields are excluded. The base demo and snapshot
entries mirror the legacy `base_demo_id`/`snapshot` columns, scheduled for removal.
