# Internal Invitation Editor

The dashboard editor is the operator-facing portion of the canonical invitation workflow. Use the
[production runbook](production-flow.md) for creation, editing, asset preparation, preview,
publication, deployment, smoke testing, and rollback. This document records only the editor's
current boundary.

## Surface and state

- Invitation operations live under `/dashboard/invitaciones`.
- Creation validates the selected descriptor's event type and preset before any project or draft is
  persisted.
- Draft content is sparse. Preview and publication compute effective content by merging draft data
  with the prior published snapshot; approved demo fallback is limited to demo invitations.
- Both preview and publication remap effective draft content through `mapDraftToPublished` with
  `priorPublishedContent` so non-editable published fields (for example interludes, `sectionStyles`,
  `visualProfileId`, `thankYou.date`, and `thankYou.closingPhrase`) survive the rematerialization
  the same way on each path.
- Saving a section replaces that section object. Every editable field therefore must exist in the
  editor schema, draft schema, both mapping directions, preview, publication, adapter, and renderer.
- Interludes, section styles, visual profile identity, and thank-you closing date/phrase are
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
