---
title: XV Xareni Iyarit Client Invitation
status: active
created: 2026-06-20
updated: 2026-06-20
related_skills:
  - astro-patterns
  - frontend-design
  - theme-architecture
  - copywriting-es
  - testing
related_docs:
  - .agent/rules/invitation-production.md
  - .agent/plans/README.md
  - docs/core/architecture.md
supersedes: []
superseded_by: []
---

# XV Xareni Iyarit Client Invitation

## Objective

Prepare the client invitation direction, assets, and scoped implementation foundation for the XV
años invitation for XARENI IYARIT SÁNCHEZ HERNÁNDEZ, using `demo-xv-celestial-blue` as the
structural, behavioral, and layout base while replacing the visible blue palette with an elegant
rose-champagne romantic direction.

Recommended evaluation slug and asset namespace: `xv-xareni-iyarit`.

## Corrections To Previous Direction

- `demo-xv-celestial-blue` is the required structural base for route/content structure, section
  order, component composition, layout rhythm, animations, RSVP behavior, gallery, location, family,
  gifts, and general XV invitation experience.
- `enchanted-rose` is not the base. It may only inform color taste if useful.
- The final invitation must not remain blue.
- The implementation should avoid a "celestial blue recolor with pink photos" result.
- Music must be omitted for now.
- RSVP/control de invitados remains included, but pass/invitation modality remains configurable
  after the invitation exists.
- No production DB publishing is authorized by this plan.

## Current-State Findings

- Base content: `src/content/event-demos/xv/demo-xv-celestial-blue.json` defines the useful XV
  section order and content pattern: hero, countdown, quote, family, itinerary, location, gallery,
  dress code, gifts, RSVP, interludes, thank-you, envelope, and sharing.
- Base assets: `src/assets/images/events/demo-xv-celestial-blue/index.ts` exports `hero`,
  `portrait`, `ceremony`, `reception`, `family`, `gallery01..10`, `interlude01..04`, and
  `thankYouPortrait`.
- Base theme: `src/styles/themes/presets/_celestial-blue.scss` contains many cool/blue custom
  properties and section treatments; this is why Xareni needs event-scoped rose/champagne overrides.
- Structural branches:
  - `src/components/invitation/Itinerary.astro` uses the `ItineraryProgram` branch for
    `variant === "celestial-blue"`.
  - `src/components/invitation/ThankYou.astro` uses the editorial branch for `celestial-blue`.
  - `src/lib/components/gallery/getLayoutClass.ts` gives `celestial-blue` its feature/wide gallery
    rhythm.
- Asset registry behavior depends on `_assetSlug` and the static image registry. The asset namespace
  must be case-safe for Vercel/Linux: `xv-xareni-iyarit`.
- Existing precedent: event-scoped section overrides refine shared presets without duplicating full
  themes.
- Real/client invitations should be DB-published payloads, not new checked-in `src/content/events`
  JSON.

## Proposed Implementation Approach

Use a DB-published client invitation payload based on the `demo-xv-celestial-blue` content
structure, with `theme.preset: "celestial-blue"` retained internally so existing component/layout
branches continue to run. Apply a tightly scoped visual override through
`.event--xv-xareni-iyarit.theme-preset--celestial-blue` to replace the inherited blue visual system
with rose champagne, ivory, rose gold, soft mauve, and deep mauve.

This keeps the change small and aligned with current repo behavior. A new named preset is not
recommended for the first implementation because it would require
schema/theme-contract/test/component branch updates for mostly visual needs.

## Files Likely To Change

- `.agent/plans/active/xv-xareni-iyarit-client-invitation.md`
- `.agent/plans/active/xv-xareni-iyarit-assets-report.md`
- `src/assets/images/events/xv-xareni-iyarit/index.ts`
- `src/assets/images/events/xv-xareni-iyarit/*.webp`
- `src/styles/themes/sections/_xv-xareni-iyarit.scss`
- `src/styles/themes/sections/_index.scss`
- `.agent/plans/active/xv-xareni-iyarit-db-payload.json` as the local schema-validated payload
  artifact. This is not a production publish.

## Theme And Color Strategy

Use the celestial-blue variant for behavior, not for color.

Event-scoped palette:

- Warm ivory: `#FFF8F4`
- Blush pink: `#F3D6CF`
- Champagne: `#E8C8B8`
- Rose gold: `#C98F8E`
- Soft mauve: `#B98291`
- Deep mauve / muted wine: `#7A3E57`
- Dark warm plum text: `#3A2A2E`

Deep mauve should be used sparingly for CTAs, selected headings, active states, dividers, and small
ornaments. Hero overlays, gallery backgrounds, countdown, RSVP controls, location cards, interludes,
personalized access, and thank-you should be audited for blue leakage.

## Asset Namespace And Path Recommendation

Use `_assetSlug: "xv-xareni-iyarit"` and static build-time assets in
`src/assets/images/events/xv-xareni-iyarit/`.

Do not assume route slug and `_assetSlug` must always match, but matching them here is safe and
clear.

## Source Photo Inventory

Originals remain outside the repo and were not modified. The source folder supplied in the task
contains:

- `IMG_4591(1).jpg` - 2827x3622, 2.65 MB, best hero candidate.
- `IMG_4609(1).jpg` - 2828x3461, 2.07 MB, full/support portrait.
- `IMG_4610(1)(1)(1).jpg` - 2828x3606, 2.37 MB, gallery/support.
- `IMG_4628(1)(1)(1)(1).jpg` - 2828x4169, 2.32 MB, rejected by default because of a visible
  generated-content style label near the lower edge.
- `IMG_4632(1).jpg` - 2828x4131, 2.40 MB, close-up gallery.
- `IMG_4635(1)(1).jpg` - 2828x3584, 2.25 MB, thank-you/support.
- `IMG_4674(1)(1)(1).jpg` - 2525x3853, 1.95 MB, gallery/support.

## Edited And Generated Asset Inventory

Final WebP assets were produced with deterministic `sharp` edits: orientation normalization, warm
romantic color grade, mild exposure lift, subtle sharpening, crops, and WebP quality 86.

- `hero.webp` - 9:16 mobile hero crop from `IMG_4591(1).jpg`.
- `portrait.webp` - 4:5 preview/support crop from `IMG_4591(1).jpg`.
- `family.webp` - 3:4 or 4:5 support portrait from `IMG_4609(1).jpg`.
- `gallery-01.webp` through `gallery-06.webp` - edited client photos with consistent warm
  blush/champagne grading.
- `thank-you-portrait.webp` - closing portrait from `IMG_4635(1)(1).jpg`.
- `ceremony.webp` and `reception.webp` - decorative non-people fallback images derived from
  generated interlude imagery because no real venue photos were provided. The prepared DB payload
  intentionally does not map these images to the ceremony/reception venue cards, so they are not
  presented as real location photography.
- `interlude-01.webp` through `interlude-04.webp` - generated rose-champagne abstract interludes:
  tulle/embroidery, ivory mirror/floral shadows, lace divider with negative space, and RSVP/closing
  blush tulle.

Detailed sizes and reductions are tracked in
`.agent/plans/active/xv-xareni-iyarit-assets-report.md`.

## Rejected Asset Inventory

- `IMG_4628(1)(1)(1)(1).jpg` - rejected because the lower edge includes a visible generated-content
  style label/watermark risk. It should only be reconsidered if manually cropped enough to remove
  the mark and still produce a useful composition.

## Content Mapping

DB-published payload guidance:

- `eventType: "xv"`
- `isDemo: false`
- `_assetSlug: "xv-xareni-iyarit"`
- `theme: { fontFamily: "serif", preset: "celestial-blue" }`
- `sectionOrder`: mirror `demo-xv-celestial-blue`, but omit music from content.
- Local artifact: `.agent/plans/active/xv-xareni-iyarit-db-payload.json`
- Hero:
  - `name: "Xareni Iyarit"`
  - `label: "Mis XV años"`
  - `date: "2026-09-13T01:00:00.000Z"`
  - `eventTiming.localDateTime: "2026-09-12T19:00"`
  - `eventTiming.timeZone: "America/Mexico_City"`
- Quote:
  - `text: "La vida es una aventura atrevida o no es nada."`
  - `author: "Helen Keller"`
- Ceremony:
  - `Basílica De Nuestra Señora Misericordia`
  - `7:00 p.m.`
  - `Av. Cuauhtémoc 101, Centro, 90300 Cdad. de Apizaco, Tlax.`
  - No venue image in the prepared payload until real venue photography is supplied or generated
    decorative imagery is explicitly approved as decorative.
- Reception:
  - `Las Camelinas`
  - `8:30 p.m.`
  - `C. José Aramburu 3, San Martín de Porres, 90360 Cdad. de Apizaco, Tlax.`
  - No venue image in the prepared payload until real venue photography is supplied or generated
    decorative imagery is explicitly approved as decorative.
- Parents:
  - `Ignacio Sabino Sánchez Hernández`
  - `Nabil Hernández García`
- Godparents:
  - `José Rosendo Hernández Martínez`
  - `Airemy Grisel Hernández García`
- Dress code: `Formal elegante.`
- Gifts: `Lluvia de sobres`.
- RSVP: keep `accessMode: "hybrid"` and `confirmationMode: "api"` unless the later pass modality
  decision requires a payload-only adjustment.
- Music: omit.
- Sharing: Spanish WhatsApp template and `ogImage: "portrait"`.

## Validation Strategy

- Asset report generation with source filename, output filename, role/key, dimensions, original
  size, final size, reduction percentage, and notes.
- Focused Jest coverage for plan, asset registry, static assets, and scoped theme wiring.
- Content/schema validation against `eventContentSchema` for
  `.agent/plans/active/xv-xareni-iyarit-db-payload.json`.
- Asset registry/build check for `xv-xareni-iyarit`.
- `pnpm type-check`
- `pnpm lint`
- `pnpm validate:event-parity`
- `pnpm build`
- `pnpm agent:git-safety:check`
- `pnpm agent:git-safety:end`

## Risks And Mitigations

- Risk: keeping `theme.preset: "celestial-blue"` is semantically odd. Mitigation: document that it
  is a structural preset here, and keep the visible visual system in a client-scoped override.
- Risk: inherited blue may leak from direct preset tokens. Mitigation: override the inherited color
  custom properties and audit major section surfaces.
- Risk: a new true rose preset would produce a wider diff. Mitigation: defer until multiple clients
  need the same structural branch with a rose preset name.
- Risk: generated decorative images could violate client constraints. Mitigation: use no people, no
  faces, no text, no logos, no crowns, no blue palette, no cartoon style, and restrained rose-gold
  detail.
- Risk: production DB publishing could bypass review. Mitigation: no DB writes until explicitly
  authorized.

## Non-Goals

- Do not create a new event type.
- Do not switch the base to `enchanted-rose`.
- Do not preserve celestial-blue colors.
- Do not add music.
- Do not change RSVP architecture.
- Do not implement runtime image processing.
- Do not publish to production DB unless explicitly authorized.
- Do not stage or commit.

## Open Questions

No blocking product questions remain for implementation. The only deferred decision is the final
RSVP pass/invitation modality, which can remain configurable after the invitation exists.
