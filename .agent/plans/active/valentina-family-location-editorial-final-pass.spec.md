---
title: Valentina Family and Location Editorial Pass Spec
status: active
plan_type: implementation
autonomy_level: 2
created: 2026-06-28
updated: 2026-06-28
related_skills:
  - frontend-design
  - theme-architecture
  - accessibility
  - backend-engineering
related_plans:
  - .agent/plans/active/valentina-final-blockers-pass.spec.md
related_rules:
  - .agent/rules/gatekeeper.md
  - .agent/rules/git-safety.md
---

# Valentina Family and Location Editorial Pass Spec

This document details the visual problems, design solutions, implementation details, and
verification steps for upgrading the Family and Location sections of the Valentina Hernández XV
invitation.

## 1. Current Visual & Functional Problems

### A. Family Section

- **Flat Layout**: Currently rendered as a flat, centered list of parents and godparents.
- **Directory-Like**: It feels like an administrative directory rather than a premium, high-end
  editorial spread.
- **Lack of Tension/Rhythm**: It lacks visual interest, editorial typography hierarchy, and a
  sophisticated gratitude tone.

### B. Event Location Section

- **Duplicate Cards**: Ceremony and reception both take place at "Finca Las Palmas". Rendering two
  separate cards with duplicate addresses, Google Maps links, and maps feels mechanical and
  repetitive.

## 2. Scope and Non-Goals

### Goals

- **Family Section Upgrade**:
  - Re-style the family section for Valentina (`editorial-magazine` theme) to feel like a high-end
    editorial credits/gratitude page.
  - Left-align content and create an elegant, asymmetric page layout.
  - Turn the family message into an elegant pull quote/dedication (italicized serif style, removed
    line-border, custom spacing).
  - Treat the family photo as a sharp, frameless editorial anchor (sharp corners, no heavy
    dropshadow).
  - Use clean left-aligned dividers and spacing to structure sections rather than boxy cards or
    heavy dividers.
  - Ensure all copy is in Spanish and code/comments in English.
- **Venue Consolidation**:
  - Add a shared helper to group venues sharing the same `googleMapsUrl` (or normalized name +
    address fallback).
  - Update `EventLocation.astro` and `VenueCard.astro` to support rendering grouped itineraries.
  - Update Valentina payload and SQL patches to ensure correct data consistency.
  - Ensure other invitations are not broken by this shared logic.

### Non-Goals

- No changes to other presets or themes besides the targeted Valentina custom SCSS and shared
  HTML/helper logic.
- No database migration schema changes (use existing structure).
- Do not stage or commit files (keep existing staged changes intact).

## 3. Files Inspected

- [Family.astro](file:///d:/code/celebra-me/src/components/invitation/Family.astro)
- [EventLocation.astro](file:///d:/code/celebra-me/src/components/invitation/EventLocation.astro)
- [VenueCard.astro](file:///d:/code/celebra-me/src/components/invitation/components/VenueCard.astro)
- [\_xv-valentina-hernandez.scss](file:///d:/code/celebra-me/src/styles/themes/sections/_xv-valentina-hernandez.scss)
- [\_event-location.scss](file:///d:/code/celebra-me/src/styles/invitation/_event-location.scss)
- [xv-valentina-hernandez-db-payload.json](file:///d:/code/celebra-me/.agent/plans/active/xv-valentina-hernandez-db-payload.json)

## 4. Proposed Changes

### A. Location Grouping Logic (Shared)

- **[NEW] [location-helper.ts](file:///d:/code/celebra-me/src/lib/invitation/location-helper.ts)**:
  - Implement `groupVenues(venues: VenueEntry[]): GroupedVenue[]`.
  - Group venues sharing the same `googleMapsUrl` (trimmed, lowercase, non-empty) or matching
    normalized `venueName` + `address` when `googleMapsUrl` is missing.
  - Consolidate events into an `events` array containing `name` and `time`.
  - Mark grouped items as `type: 'grouped'`.
- **[NEW]
  [location-helper.test.ts](file:///d:/code/celebra-me/tests/unit/location-helper.test.ts)**:
  - Unit tests validating correct grouping, fallback address matching, and ignoring of different
    venues.
- **[MODIFY]
  [EventLocation.astro](file:///d:/code/celebra-me/src/components/invitation/EventLocation.astro)**:
  - Import and apply `groupVenues` to `displayVenues`.
- **[MODIFY]
  [VenueCard.astro](file:///d:/code/celebra-me/src/components/invitation/components/VenueCard.astro)**:
  - Update `Props` and `VenueData` interface to optionally accept `events`
    (`{ name: string; time: string }[]`).
  - Render a compact itinerary list if `venue.events` exists, matching the existing
    `.event-location__card-content-itinerary` CSS layout.

### B. Valentina Editorial Upgrades (Family & Location styling)

- **[MODIFY]
  [\_xv-valentina-hernandez.scss](file:///d:/code/celebra-me/src/styles/themes/sections/_xv-valentina-hernandez.scss)**:
  - **Family Section Styling**:
    - Remove boxy borders, shadows, and background of `.family__panel` to open up the editorial
      spread.
    - Style `.family__media-frame` with sharp corners (`border-radius: 0`), thin charcoal border,
      and minimal shadow.
    - Transform `.family__message` into an elegant left-aligned pull quote with italicized serif
      type and custom spacing.
    - Left-align all family groups, using short left-aligned borders for the divider between blocks.
    - Improve mobile rhythm by reducing panel padding and vertical margins.
  - **Location Section Styling**:
    - Add styles for `.event-location__card-content-itinerary` and items to match the blush, silver,
      and charcoal color scheme.

## 5. Accessibility Considerations

- **Screen Reader Parity**: The consolidated itinerary uses semantic HTML (`<ul>` and `<li>`) so
  assistive technologies read the events and times sequentially.
- **Hiding Redundancies**: Visible role headers ("Mis padres", "Padrinos") act as the semantic
  labels; individual role names remain `.sr-only` where redundant.
- **Keyboard Reachability**: All CTAs (like Google Maps buttons) remain fully focusable and use
  descriptive label text.

## 6. Rollback Notes

- To roll back, run `git checkout` on modified files, and delete the new `location-helper.ts` and
  `location-helper.test.ts` files.

## 7. Validation Commands

- `pnpm lint:styles:changed`
- `pnpm lint`
- `pnpm type-check`
- `pnpm test`
- `pnpm validate:event-parity`
- `pnpm build`
- `pnpm agent:git-safety:check`

## 8. Manual QA Checklist

- [ ] `/xv/valentina-hernandez` family section is left-aligned, uses pull-quote typography, and has
      a clean, frameless editorial feel.
- [ ] No border/background on family container, showing a clean magazine spread.
- [ ] Deceased indicators and family names are clear.
- [ ] Redundant roles are hidden.
- [ ] Ceremony and Reception at Finca Las Palmas are combined into a single card.
- [ ] Itinerary shows both "Ceremonia religiosa — 3:45 p.m." and "Recepción — 4:30 p.m.".
- [ ] Single "Abrir en Google Maps" button is present and functional.
- [ ] Different-venue mock invites render two separate cards without issue.
