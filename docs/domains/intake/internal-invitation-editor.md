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
- Saving a section replaces that section object. Every editable field therefore must exist in the
  editor schema, draft schema, both mapping directions, preview, publication, adapter, and renderer.
- Interludes are published content but are not dashboard-editable section values. Republishing must
  preserve them.

## Publication boundary

Publication maps effective content through the canonical schema, validates referenced assets, and
uses the atomic database RPC with an expected draft revision. A validation error persists nothing; a
stale revision rejects the publish and is safe to retry after refreshing current state.

The public read path validates stored JSON against the same canonical schema before adaptation.
Invalid stored content resolves to the controlled invitation-unavailable state and is not publicly
cached.

## Canonical contracts

- Content and section ordering: [`../../core/content-schema.md`](../../core/content-schema.md)
- End-to-end operation: [`production-flow.md`](production-flow.md)
- Static/demo/template capabilities: [`../content/collections.md`](../content/collections.md)
- Agent execution constraints:
  [`../../../.agent/rules/invitation-production.md`](../../../.agent/rules/invitation-production.md)
