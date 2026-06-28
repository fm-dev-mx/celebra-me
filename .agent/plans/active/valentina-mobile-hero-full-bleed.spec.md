---
title: Valentina Mobile Hero Full Bleed Spec
status: active
plan_type: implementation
autonomy_level: 2
created: 2026-06-28
updated: 2026-06-28
related_skills:
  - frontend-design
  - theme-architecture
  - accessibility
related_plans:
  - .agent/plans/active/valentina-mobile-hero-gallery-upgrade.spec.md
related_rules:
  - .agent/rules/gatekeeper.md
  - .agent/rules/git-safety.md
---

# Valentina Mobile Hero Full Bleed Spec

This document details the refactoring of the mobile hero on `/xv/valentina-hernandez` to transition
from a framed portrait card layout to a full-bleed premium fashion magazine cover background.

## 1. Visual & Architectural Problems

- **Pasted Card Feeling**: On mobile, the hero portrait is rendered as a 4:5 card inside a dark,
  low-opacity background, making the photo look "pasted in" rather than part of an integrated cover
  design.
- **Occluded & Muted Image**: The background image has an opacity of 48% and a heavy dark overlay,
  which darkens the overall page.
- **Text Readability & Dark Block**: Rather than a heavy lower dark overlay block to make text
  readable, we want a subtle bottom gradient that preserves image clarity and keeps Valentina's face
  bright and unobstructed.

## 2. Proposed Solution

1. **Database Payload Update**:
   - Set `"backgroundImageMobile": "portrait"` in the payload JSON and SQL patch. This makes the
     portrait of Valentina the full-bleed background on mobile viewports.
2. **Hide Portrait Card on Mobile**:
   - In the Valentina-specific mobile media query, set
     `.invitation-hero__portrait { display: none; }`.
3. **Enhance Background and Readability Overlay**:
   - Set `.invitation-hero__background { opacity: 1; }` on mobile to make the background photo fully
     bright and dominant.
   - Set `.invitation-hero__background img { filter: none; }` to bypass the desaturating
     grayscale/contrast filter on mobile.
   - Replace the heavy dark overlay with a soft vertical bottom gradient:
     `linear-gradient(to bottom, transparent 0%, rgb(0 0 0 / 6%) 40%, rgb(0 0 0 / 60%) 100%)` at
     `opacity: 1` to ensure text readability.
4. **Reposition Text and Layout**:
   - Set `.invitation-hero__content` to `justify-content: flex-end;` on mobile. This aligns the text
     block at the bottom of the viewport, keeping Valentina's face (usually located in the
     upper-middle of the frame) completely unobstructed.
   - Lighter page border (`&::before`) and folio rail styling (softer opacity) to keep the frame
     elegant and light.

## 3. Files Inspected & Modified

- [xv-valentina-hernandez-db-payload.json](file:///d:/code/celebra-me/.agent/plans/active/xv-valentina-hernandez-db-payload.json)
  (Inspected & Modified)
- [20260626_valentina_hernandez_xv.sql](file:///d:/code/celebra-me/scripts/manual/production-patches/20260626_valentina_hernandez_xv.sql)
  (Inspected & Modified)
- [\_xv-valentina-hernandez.scss](file:///d:/code/celebra-me/src/styles/themes/sections/_xv-valentina-hernandez.scss)
  (To be modified)

## 4. Acceptance Criteria

- Valentina's portrait is the full-bleed background on mobile.
- The 4:5 portrait card is hidden on mobile.
- The name, date, and venue details are positioned at the bottom, perfectly readable.
- The face is bright, colored, and unobstructed.
- The thin border around the hero is softer and lighter.
- `pnpm build` passes successfully.

## 5. Verification & Rollback Notes

- Run `pnpm lint:styles:changed`, `pnpm lint`, `pnpm type-check`, `pnpm build` to validate.
- Rollback: Revert changes in `_xv-valentina-hernandez.scss` and remove
  `"backgroundImageMobile": "portrait"` from payload JSON and SQL files.
