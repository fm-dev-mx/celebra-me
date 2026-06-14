---
title: Leah Lexa Baby Shower Client Invitation
status: active
created: 2026-06-12
updated: 2026-06-13
related_skills:
  - frontend-design
  - astro-patterns
  - theme-architecture
  - copywriting-es
  - testing
related_docs:
  - .agent/invitation-production-rules.md
  - .agent/db/README.md
  - docs/domains/content/event-governance.md
  - docs/domains/intake/production-flow.md
  - scripts/manual/production-patches/20260613_prepare_leah_lexa_baby_shower.sql
supersedes:
  - decouple-leah-lexa-from-demo.md
superseded_by: []
---

# Leah Lexa Baby Shower Client Invitation Plan

## Summary

Continue Leah Lexa as a real/client Baby Shower invitation published from DB content at
`/baby-shower/leah-lexa`. Do not create
`src/content/event-demos/baby-shower/leah-lexa-baby-shower.json`, do not add real client content to
`src/content/events`, and do not point Leah asset resolution at the generic Baby Shower demo.

The generic static demo remains `demo-baby-shower-celestial` and must stay fictitious.

## Current Source of Truth

- Production preparation patch:
  `scripts/manual/production-patches/20260613_prepare_leah_lexa_baby_shower.sql`
- Route slug / event slug: `leah-lexa`
- Asset slug: `leah-lexa-baby-shower`
- Demo/base catalog link: `demo-baby-shower-celestial`
- Event type: `baby-shower`
- Theme preset: `celestial-blue`

Slug meanings must remain distinct:

- `leah-lexa` is the public route and RSVP event slug.
- `leah-lexa-baby-shower` is `_assetSlug` and the local asset registry directory key.
- `demo-baby-shower-celestial` is only the base demo/catalog reference.

## Implementation Rules

- Use DB-published content for the real invitation.
- Preserve `is_demo = false` for Leah published content.
- Preserve `base_demo_id = 'demo-baby-shower-celestial'` only as catalog lineage.
- Preserve `_assetSlug = 'leah-lexa-baby-shower'` so internal asset keys resolve from Leah assets.
- Do not create a Leah-specific static demo JSON file.
- Do not copy old non-manifest SQL patches as templates.
- Do not execute production SQL from this plan. The patch entrypoint is dry-run lint only until a
  reviewed execution process exists.

## Editorial Refresh Scope

Approved refresh work keeps Leah Lexa on DB-published content at `/baby-shower/leah-lexa` and keeps
`_assetSlug = 'leah-lexa-baby-shower'`. The route must not gain a static Leah JSON file.

Asset mapping confirmed from local files:

- `gallery01`: other parents photo.
- `gallery02`: ultrasound/ecografia image.
- `gallery03`: dogs image.

Implementation direction:

- Preserve the current hero image and improve mobile text contrast with a soft bottom overlay and
  readable warm/light tones.
- Add a reusable `medium` interlude height for compact emotional interludes.
- Use `gallery01` as a medium parents-photo interlude after `quote`.
- Keep `gallery` in Leah's section order, but repurpose it as a one-image secondary dogs section
  using `variant: single`, `gallery03`, title `La manada también te espera`, and copy
  `En casa ya hay patitas listas para recibirte con amor.`.
- Use `gallery02` as the thank-you ultrasound/ecografia image with intimate closing copy.
- Do not change family schemas/components/styles for the dogs treatment.
- Do not remove shared gallery functionality, delete assets, or remove gallery globally.

## Next Work

1. Confirm the real owner `auth.users.id`.
2. Re-run SQL safety checks on the Leah patch.
3. Review the Leah content embedded in the patch for final owner, map, RSVP, gift, and asset
   approval details.
4. For local visual QA, confirm whether the local DB row has been updated from the edited manual
   patch. If not, either apply the guarded patch through a local-safe owner UUID workflow or report
   that visual QA cannot verify the updated DB-published content yet.
5. Only after review, follow the approved production database workflow for any production mutation.

## Validation

Required before continuing:

- `pnpm db:sql:lint -- --file scripts/manual/production-patches/20260613_prepare_leah_lexa_baby_shower.sql`
- `pnpm db:prod:patch -- --file scripts/manual/production-patches/20260613_prepare_leah_lexa_baby_shower.sql`
- `pnpm type-check`
- `pnpm lint`
- `pnpm validate:event-parity`
- `pnpm validate:no-pii`

Manual QA after DB publication exists:

- `/baby-shower/leah-lexa` loads from DB-published content.
- No visible copy says `Bautizo`.
- Leah assets resolve from `src/assets/images/events/leah-lexa-baby-shower/`.
- Generic demo content remains fictitious and separate.
- RSVP behavior matches the selected production access mode.
