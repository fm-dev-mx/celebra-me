# Internal Invitation Editor

The dashboard editor is the operator-facing portion of the canonical invitation workflow. Use the
[production runbook](production-flow.md) for creation, editing, asset preparation, preview,
publication, deployment, smoke testing, and rollback. This document records only the editor's
current boundary.

## Surface and state

- Invitation operations live under `/dashboard/invitaciones`.
- Creation validates the selected descriptor's event type and preset before any project or draft is
  persisted.
- Contracts:
  - Published content = nested public/persisted representation
  - `DraftContent` = canonical flat editable representation
  - Editor = consumer of `DraftContent` (never raw Published shapes)
  - Location venue `date`/`time` and itinerary times use the machine contract (`YYYY-MM-DD` /
    `HH:mm`) in Draft and in new Published writes. Legacy Spanish prose is normalized at the
    mapping/display boundary only. `showFlourishes` is owned by
    `location.presentationOptions.showFlourishes`. Legacy `sectionStyles` values are migration/audit
    input only and are rejected by the canonical publication path.
- Draft content is sparse. A draft seeded from a published revision is converted with
  `mapNestedToDraftContent` first; see the contract table in
  [`.agent/rules/intake-publishing.md`](../../../.agent/rules/intake-publishing.md). Legacy/hybrid
  drafts are normalized by `normalizeDraftContent` (strips published-only nested residue such as
  `gifts.variant`, indication `icon`, `countdown.subtitlePrefix`, and folds `rsvp.whatsappConfig` →
  `whatsappPhone`).
- Section restore (“Restaurar versión publicada”) and full draft restore reuse `restoreDraftSection`
  / `restoreEntireDraft`. CLI: `pnpm invitation:draft-restore`. Inventory non-canonical drafts
  (read-only): `pnpm invitation:draft-audit --all --target <env>`.
- Preview and publication compute effective content by merging draft data with the prior published
  snapshot; an explicit canonical demo contract supplies structural prerequisites only when no
  prior snapshot exists.
- Both preview and publication remap effective draft content through `mapDraftToPublished` with
  `priorPublishedContent` so non-editable published fields (for example interludes,
  `visualProfileId`, `thankYou.date`, and `thankYou.closingPhrase`) survive the rematerialization
  the same way on each path.
- Saving a section replaces that section object. Every editable field therefore must exist in the
  editor schema, draft schema, both mapping directions, preview, publication, adapter, and renderer.
- Interludes, visual profile identity, and thank-you closing date/phrase are
  published content that are not dashboard-editable section values. Republishing and internal
  preview must preserve them from the prior published snapshot.

## Publication boundary

Publication maps effective content through the canonical schema, validates referenced assets, and
uses the atomic database RPC with an expected draft revision. A validation error persists nothing; a
stale revision rejects the publish and is safe to retry after refreshing current state.

The public read path validates stored JSON against the same canonical schema before adaptation.
Invalid stored content resolves to the controlled invitation-unavailable state and is not publicly
cached.

Host share-message edits from the guests dashboard are an explicit narrow exception documented in
[`docs/core/content-parity-rsvp-isolation.md`](../../core/content-parity-rsvp-isolation.md): they
patch published `sharing` only and increment `version` / `published_at`. They are not a general
publish bypass.

## Canonical contracts

- Content and section ordering: [`../../core/content-schema.md`](../../core/content-schema.md)
- End-to-end operation: [`production-flow.md`](production-flow.md)
- Static/demo/template capabilities: [`../content/collections.md`](../content/collections.md)
- Agent execution constraints:
  [`../../../.agent/rules/invitation-production.md`](../../../.agent/rules/invitation-production.md)
