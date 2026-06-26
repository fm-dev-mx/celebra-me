---
title: Opening Reveal Content Contract
status: archived
archived_date: 2026-06-25
reason: stale draft, never approved for implementation
created: 2026-06-18
updated: 2026-06-18
related_skills:
  - frontend-design
  - animation-motion
  - accessibility
  - astro-patterns
  - testing
related_docs:
  - docs/core/architecture.md
  - docs/core/content-schema.md
  - .agent/rules/invitation-production.md
---

# Opening Reveal Content Contract Plan

## Summary

Normalize the invitation opening/reveal contract so the envelope and reveal card derive from
canonical honoree data by default, while still allowing optional opening-specific copy overrides.
This fixes two-honoree invitations such as `primera-comunion/luna-y-estrella` without hardcoding an
invitation-specific path.

Verified current state before implementation:

- `EnvelopeReveal.astro` rendered a single closed-envelope `name` prop and passed one `card` object
  to the revealed card.
- `InvitationRevealCard.astro` rendered only one `card.name`.
- `reveal-card.ts` defined `RevealCardData` with no `secondaryName`.
- `event.ts` built the reveal card from `data.hero.name` only.
- `page-data.ts` derived the closed-envelope name from the reveal card's single name.
- `Hero.astro` already rendered `hero.secondaryName`.
- `InvitationEditor.tsx` exposed only envelope enabled, `cardLabel`, `cardTagline`, and
  `sealInitials`.
- `preview.astro` only distinguished embedded preview from full preview.

## Implementation Strategy

- Keep `hero.name` and `hero.secondaryName` as canonical honoree identity.
- Keep the flat `envelope` object and add optional presentation overrides: `envelopeName`,
  `cardName`, `cardSecondaryName`, `guestLabel`, and `guestNameFallback`.
- Resolve all opening display data through one reveal/opening resolver before rendering.
- Render primary and secondary reveal-card names separately.
- Expose all visible opening fields in the dashboard editor with Spanish labels.
- Add dashboard preview states: `closed`, `opened`, and `internal`.

## Files Likely To Change

- `src/lib/invitation/reveal-card.ts`
- `src/lib/adapters/event.ts`
- `src/lib/invitation/page-data.ts`
- `src/lib/schemas/content/envelope.schema.ts`
- `src/lib/intake/schemas/shared-content.schema.ts`
- `src/lib/intake/mappers/draft-to-published.mapper.ts`
- `src/lib/intake/services/draft-content-mapper.ts`
- `src/components/invitation/EnvelopeReveal.astro`
- `src/components/invitation/InvitationRevealCard.astro`
- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- `src/components/dashboard/intake/editor/EditorPreviewPane.tsx`
- `src/pages/dashboard/invitaciones/[id]/preview.astro`
- `src/styles/invitation/_reveal-card.scss`
- `src/styles/dashboard/_intake-editor.scss`

## Test Plan

- Unit tests for one honoree, two honorees, override fallback, guest label/fallback, and date
  formatting.
- Adapter/page-context tests proving `hero.secondaryName` reaches the envelope and reveal card.
- Schema and mapper tests proving new envelope fields survive save, restore, preview, and publish.
- Editor tests proving every visible opening field renders and saves.
- Preview URL and preview pane tests for `closed`, `opened`, and `internal` states.

## Acceptance Criteria

- `luna-y-estrella` shows `Luna Yamileth` and `Estrella Abigail` in both the closed envelope and
  revealed card through generic derivation.
- No special-case logic is added for `luna-y-estrella`.
- Empty envelope overrides fall back to canonical hero data.
- The editor exposes all visible opening/reveal fields.
- The editor preview can inspect closed envelope, opened reveal card, and invitation interior.
- Existing invitations without new fields remain valid.
