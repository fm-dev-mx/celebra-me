---
title: Valentina Hernandez XV Final Blockers Pass
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
  - .agent/plans/active/valentina-editorial-section-dividers.spec.md
related_rules:
  - .agent/rules/gatekeeper.md
  - .agent/rules/git-safety.md
---

# Valentina Hernandez XV Final Blockers Pass

This document details the final blockers and requirements to make the `/xv/valentina-hernandez`
digital invitation production-ready.

## 1. Current Blockers

1. **Family section redundancy — Global rule required**: Individual role labels ("Madre", "Padre",
   "Madrina", "Padrino") are shown under category headers ("Mis padres", "Padrinos") which is
   repetitive and administrative.
2. **Event Location — Google Maps link missing**: The venue cards for ceremony and reception do not
   expose a Google Maps navigation button because `googleMapsUrl` is missing from the payload.
3. **Gifts section — Liverpool table number missing**: The Liverpool store gift card does not
   display the table number, even though it is present in the URL.
4. **RSVP — Selected state hierarchy and phone input bug**: The phone input wrapper and country code
   select overlapping prevents entering the phone number under the `editorial-magazine` theme.
   Additionally, fields are ordered confusingly (identity fields appear above the selected
   attendance options when confirmed, causing visual jumpiness).

## 2. Scope and Non-Goals

### Goals

- Resolve the 4 final blockers on `/xv/valentina-hernandez` cleanly, keeping high visual quality,
  premium editorial style, and keyboard accessibility.
- Implement the redundant family role removal as a shared rendering helper that works globally.
- Preserve existing staged work (`valentina-editorial-section-dividers.spec.md` and any staged parts
  of `src/styles/themes/sections/_xv-valentina-hernandez.scss`).

### Non-Goals

- No new CSS libraries, Tailwind, or external forms libraries.
- No changes to backend database migrations (only manual payload sql patch updates).
- No staging or committing of files unless explicitly requested.

## 3. Files Inspected

- `src/components/invitation/Family.astro`
- `src/components/invitation/components/VenueCard.astro`
- `src/components/invitation/EventLocation.astro`
- `src/components/invitation/Gifts.astro`
- `src/components/invitation/RSVP.tsx`
- `src/components/invitation/RSVPComponents.tsx`
- `src/components/invitation/RSVPFormFields.tsx`
- `src/lib/schemas/content/gifts.schema.ts`
- `src/lib/invitation/family-contract.ts`
- `src/styles/themes/sections/_xv-valentina-hernandez.scss`
- `src/styles/themes/sections/rsvp/_editorial-magazine.scss`
- `src/styles/invitation/_rsvp.scss`
- `.agent/plans/active/xv-valentina-hernandez-db-payload.json`
- `scripts/manual/production-patches/20260626_valentina_hernandez_xv.sql`

## 4. Proposed Changes

### Global Family Helper

- **[NEW] [family-helper.ts](file:///d:/code/celebra-me/src/lib/invitation/family-helper.ts)**:
  Contains the `shouldHideRoleVisually(groupTitle: string, role?: string): boolean` helper. It
  checks if the category title (e.g. "Mis padres", "Padrinos") matches the individual role (e.g.
  "Madre", "Madrina"), and if so, returns `true` to hide the redundant label.
- **[NEW] [family-helper.test.ts](file:///d:/code/celebra-me/tests/unit/family-helper.test.ts)**:
  Validates the helper behaves correctly under different title/role inputs.
- **[MODIFY] [Family.astro](file:///d:/code/celebra-me/src/components/invitation/Family.astro)**:
  Integrates the helper. Redundant roles will be wrapped in the `.sr-only` class to hide them
  visually while preserving accessibility.

### Location Maps Link

- **[MODIFY]
  [VenueCard.astro](file:///d:/code/celebra-me/src/components/invitation/components/VenueCard.astro)**:
  Uses "Abrir en Google Maps" as the CTA text in Spanish.
- **[MODIFY]
  [xv-valentina-hernandez-db-payload.json](file:///d:/code/celebra-me/.agent/plans/active/xv-valentina-hernandez-db-payload.json)**:
  Adds
  `"googleMapsUrl": "https://www.google.com/maps/search/?api=1&query=Finca+Las+Palmas+San+Luis+Huexotla+Texcoco"`
  to both the ceremony and reception locations.
- **[MODIFY]
  [20260626_valentina_hernandez_xv.sql](file:///d:/code/celebra-me/scripts/manual/production-patches/20260626_valentina_hernandez_xv.sql)**:
  Synchronizes the embedded SQL payload with the JSON payload.

### Gifts Section Table Number

- **[MODIFY]
  [gifts.schema.ts](file:///d:/code/celebra-me/src/lib/schemas/content/gifts.schema.ts)**: Adds
  `tableNumber: z.string().optional()` to the Zod schema for store gift items.
- **[MODIFY] [Gifts.astro](file:///d:/code/celebra-me/src/components/invitation/Gifts.astro)**:
  Checks for `gift.tableNumber` and renders it if present: `"Mesa: {gift.tableNumber}"`.
- **[MODIFY] [\_gifts.scss](file:///d:/code/celebra-me/src/styles/invitation/_gifts.scss)**,
  **[\_xv-valentina-hernandez.scss](file:///d:/code/celebra-me/src/styles/themes/sections/_xv-valentina-hernandez.scss)**,
  and
  **[\_editorial-magazine.scss](file:///d:/code/celebra-me/src/styles/themes/sections/gifts/_editorial-magazine.scss)**:
  Style the `.gift-card__table-number` class to match the editorial aesthetics.
- **[MODIFY]
  [xv-valentina-hernandez-db-payload.json](file:///d:/code/celebra-me/.agent/plans/active/xv-valentina-hernandez-db-payload.json)**:
  Adds `"tableNumber": "52020257"` to the Liverpool store gift.
- **[MODIFY]
  [20260626_valentina_hernandez_xv.sql](file:///d:/code/celebra-me/scripts/manual/production-patches/20260626_valentina_hernandez_xv.sql)**:
  Updates the Liverpool gift store object in the SQL patch.

### RSVP Hierarchy and Layout Fixes

- **[MODIFY]
  [RSVPComponents.tsx](file:///d:/code/celebra-me/src/components/invitation/RSVPComponents.tsx)**:
  Reorders the JSX structure in `RsvpFormView` so that the `AttendanceField` comes first, and the
  identity fields (`NameField` and `PhoneField`) appear directly below it.
- **[MODIFY]
  [RSVPFormFields.tsx](file:///d:/code/celebra-me/src/components/invitation/RSVPFormFields.tsx)**:
  Adds visual required markers `*` to Name and Phone fields.
- **[MODIFY]
  [\_editorial-magazine.scss](file:///d:/code/celebra-me/src/styles/themes/sections/rsvp/_editorial-magazine.scss)**:
  - Constrains `.rsvp__country-code` to `width: 76px; min-width: 60px; flex: 0 0 auto;` with custom
    padding so the text input next to it gets space and does not shrink to 0.
  - Implements unselected card de-emphasis styling: when an option is selected, the unselected radio
    card receives `opacity: 0.45` and a more muted border to reduce visual noise.
  - Increases general visibility and contrast of `label` and `legend` elements by setting their
    color to `rgb(var(--editorial-magazine-white-rgb) / 72%)`.

## 5. Accessibility Considerations

- Hiding redundant family roles visually but wrapping them in `.sr-only` keeps the semantic
  relationship intact for screen readers.
- Keyboard navigation (tabIndex, buttons, selects) is fully preserved.
- The Google Maps CTA button is keyboard-accessible, focusable, and uses clear descriptive Spanish
  text rather than just an icon.
- Required fields are visually indicated with `*` and have correct `aria-invalid` bindings on error.

## 6. Rollback Notes

Rollback is completely code/documentation-only:

1. Revert modifications in `.scss`, `.tsx`, and `.astro` files.
2. Remove the spec file and the new `family-helper.ts` and `family-helper.test.ts` files.

## 7. Validation Commands

Run:

- `pnpm lint`
- `pnpm type-check`
- `pnpm test` (for family-helper unit tests)
- `pnpm build`
- `pnpm agent:git-safety:check`
