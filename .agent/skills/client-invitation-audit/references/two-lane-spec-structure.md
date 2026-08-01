# Two-Lane Spec Structure

The spec file lives at `.agent/plans/active/<slug>-<theme>-real-invitation.spec.md`.

## Required Frontmatter

```yaml
---
title: <Client Name> — <Theme> Real Invitation
status: draft
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
supersedes:
  - .agent/plans/active/<previous-spec>.md # if replacing an older approach
related_plans:
  - .agent/plans/active/<theme>-theme.spec.md
  - .agent/plans/active/<slug>-asset-report.md
related_rules:
  - .agent/rules/invitation-production.md
  - .agent/rules/manual-sql-manifest.md
---
```

## Lane A — Client-Specific Invitation Completion

A table per content section. For each, state current value, proposed value, and reason. Cover:

- `theme.preset` change
- `_assetSlug` (confirm or change; never equal demo `_assetSlug`)
- `envelope.revealVariant` + required cover fields
- `sectionStyles.*.variant` entries
- `hero.variant`

### Lane A inheritance reset (required when overriding a shared preset)

List preset/inherited properties the profile must explicitly reset so Lane A does not fight the
base theme (examples: absolute/inset positioning, frosted/backdrop bands, café/sepia image filters,
mix-blend, competing hero metadata stacks). Link face-safe hero guidance in `frontend-design` when
hero crops/type are in scope.

Then separate sections for:

- Family / people data (with confirmation status)
- Venues & location (with confirmation status)
- Gifts configuration
- Gallery captions
- Music (deferred or present)
- Image asset replacement plan
- RSVP labels (confirm or change)
- Interlude replacements

Each "PENDIENTE" item must have:

- Current value
- Proposed value (or `—` if unknown)
- Action required
- Risk level

## Lane B — Reusable Theme Refinements

For each candidate theme change, document:

- Problem description
- Options (numbered, with recommendation)
- Demo impact (improves / neutral / regresses)
- Client impact (improves / neutral)
- Cost estimate (low / medium / high)
- Priority (P1 if shared bug, P2 if polish, P3 if deferred)

**Hard rule:** If a proposed change does not demonstrably improve BOTH the client route AND the
matching demo, it belongs in Lane A as a client-scoped SCSS override, not Lane B.

## Files Changed

Table of every file that changes, with action (create / update / delete / rewrite) and reason.

## Implementation Order

Numbered phases, each with:

- Phase name
- Lane (A or B)
- Dependencies (phases that must complete first)
- Task description

## Verification Plan

Table: check → command/method → when to run

## Risks & Blockers

Table: # → blocker → severity → impact → mitigation
