---
name: invitation-rhythm
description: |
  Govern the compositional rhythm of a Celebra-me invitation: tonal arc, typographic hierarchy
  between sections, intersection cadence (Neutral / Bridge / Climax), asymmetric geometry craft
  rules, shadow vocabulary, reveal coordination, and the rhythm validation protocol.
domain: frontend
version: 1.0.0
when_to_use:
  - Designing or reviewing the section flow of a new or existing invitation profile
  - Assigning intersection treatments to individual section boundaries
  - Auditing whether adjacent sections relate correctly in surface, type, and reveals
  - Planning the tonal band before writing any intersection SCSS
  - Validating a profile before it is considered visually complete
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
inputs:
  - Invitation section order, surface assignments, and preset
  - Existing invitation profile SCSS (when auditing)
outputs:
  - Cadence map (Neutral / Bridge / Climax for every boundary)
  - Tonal band assignment
  - Intersection token decisions
  - Reveal recipe assignments
  - Rhythm validation checklist result
related_skills:
  - theme-architecture
  - animation-motion
  - frontend-design
related_docs:
  - docs/domains/theme/invitation-rhythm.md
---

# Invitation Rhythm

Load [`docs/domains/theme/invitation-rhythm.md`](../../../docs/domains/theme/invitation-rhythm.md)
before planning or reviewing the rhythm of an invitation. It is the sole normative authority for
tonal bands, typographic hierarchy between sections, intersection cadence, geometric craft rules,
shadow vocabulary, reveal coordination, and the rhythm validation protocol. This skill
intentionally duplicates no normative values.

## Implementation workflow

1. Read the invitation section order and preset. Identify the surface band for every section
   (light / mid / dark / transition).
2. Name the tonal band pattern from the approved set (editorial-light, 3-band, ivory-olive,
   full-dark-finale, or document a named variant if genuinely distinct).
3. Assign a cadence role (Neutral / Bridge / Climax) to every boundary using the assignment
   protocol. Record the cadence map as a comment block in the profile SCSS before intersection
   declarations.
4. Select the intersection pattern for each non-neutral boundary following
   `section-intersections.md` geometry rules and the craft rules in `invitation-rhythm.md`.
5. Assign the reveal recipe for each section from the boundary role table.
6. Declare shadow as profile tokens; verify shadow rules by surface context.
7. Apply the rhythm validation protocol before marking the profile complete.

## Authority boundary

This skill orchestrates decisions across `animation-motion`, `section-intersections.md`, and
`theme-architecture`. When a conflict arises between `invitation-rhythm.md` and any of those
owned-domain documents, the domain document takes precedence. Raise the conflict before
implementing either interpretation.

Use the `animation-motion` skill for reveal recipe implementation, timing verification, and
reduced-motion compliance. Use `theme-architecture` for token placement decisions, preset
boundaries, and CSS layer ownership.
