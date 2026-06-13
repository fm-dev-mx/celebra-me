---
title: Leah Lexa Native Baby Shower Demo
status: active
created: 2026-06-12
updated: 2026-06-12
related_skills:
  - frontend-design
  - astro-patterns
  - theme-architecture
  - copywriting-es
  - testing
related_docs:
  - .agent/plans/README.md
  - .agent/workflows/plan-authoring.md
  - docs/core/architecture.md
  - docs/core/content-schema.md
  - docs/domains/content/collections.md
  - docs/domains/rsvp/architecture.md
supersedes: []
superseded_by: []
---

# Leah Lexa Native Baby Shower Demo Implementation Plan

## Summary

Create a native Baby Shower demo for Leah Lexa at `/baby-shower/leah-lexa-baby-shower`. Do not
publish the real invitation, create real database rows, apply production SQL, or use `bautizo` as a
compatibility event type.

The previous recommendation to use `bautizo` is superseded. The current workflow is:

1. Add minimum native `baby-shower` support required by the architecture.
2. Create the Leah Lexa static demo under the native Baby Shower route.
3. Use the demo for visual and content approval.
4. Later, after approval, create/publish the real invitation with `eventType: "baby-shower"`.

Planning rules followed:

- `.agent/plan/README.md` does not exist.
- Source of truth used: `.agent/plans/README.md`.
- Supporting workflow used: `.agent/workflows/plan-authoring.md`.

## Track A - Minimum Native Baby Shower Support

- Add `baby-shower` to the shared event type contract.
- Update dependent TypeScript unions in RSVP/domain and invitation adapter surfaces.
- Add minimal intake support only where the current UI/type system requires it:
  - event label: `Baby Shower`
  - hero name label: `Nombre del bebé`
  - generic intake block support for `baby-shower`
- Add a Supabase migration that expands existing `events` and `invitations` event type check
  constraints to include `baby-shower`. This migration is for native support and later real
  publication readiness; it must not be applied to production in this pass.
- Update focused tests that enumerate supported event types.
- Do not add Baby Shower-specific intake workflows, a new theme preset, a custom pet renderer,
  `gallery.layout`, or a commercial music flow.

## Track B - Leah Lexa Baby Shower Demo

Create `src/content/event-demos/baby-shower/leah-lexa-baby-shower.json`.

Demo content requirements:

- `eventType: "baby-shower"`
- `isDemo: true`
- `title: "Baby Shower de Leah Lexa"`
- `theme.preset: "celestial-blue"`
- `_assetSlug: "leah-lexa-baby-shower"`
- `eventTiming.localDateTime: "2026-06-21T14:00"`
- `eventTiming.timeZone: "America/Mexico_City"`
- `eventTiming.startsAtUtc` verified from the local event datetime.
- `hero.date` uses the schema-required UTC ISO instant `2026-06-21T20:00:00.000Z`; rendering must be
  verified against `Hero.astro` so the displayed date does not shift.

Visible content:

- Event: `Baby Shower`
- Baby: `Leah Lexa`
- Parents: `Hugo y Fernanda`
- Date/time: `domingo, 21 de junio de 2026, 2:00 PM`
- Address: `Calle 22, Manzana 1, Lote 20, Col. Guadalupe Proletaria, C.P. 07670`
- Location reference: `Casa color naranja al final de la calle, cerca de una capilla.`
- Dress code: `Ropa casual en colores pastel.`
- Gift registry: `https://mesaderegalos.liverpool.com.mx/milistaderegalos/51975133`
- Narrative voice: first person from Leah Lexa.
- Visual direction: celestial pastel, clouds, soft sky, sunset-inspired, tender, and interactive.
- Envelope: cream/white envelope with wax seal monogram `L`.
- Pets: `Mis hermanos perruños`, using one composed/provisional five-dog asset.
- Ultrasound: use the cleaned/provisional ultrasound asset if no original client asset is available.
- Music: omitted by default.

Demo structure:

1. Interactive envelope.
2. Celestial hero/opening.
3. Message about God's timing and the family growing.
4. Ultrasound / parents presentation.
5. Leah Lexa introduction.
6. Hermanos perruños section.
7. Event details.
8. Dress code.
9. Liverpool gift registry.
10. RSVP/demo CTA using existing demo behavior only.
11. Thank-you closing.

Asset status:

- Reuse `src/assets/images/events/leah-lexa-baby-shower/hero.webp`.
- Reuse `src/assets/images/events/leah-lexa-baby-shower/family.webp`.
- Reuse `src/assets/images/events/leah-lexa-baby-shower/gallery-01.webp`.
- These are provisional demo assets, not confirmed client originals.
- The ultrasound-style image and dog composition must not be represented as final client-provided
  assets.

## Track C - Later Real Invitation Publication

Deferred until the client approves the native demo.

Before real publication, confirm:

- final Google Maps pin,
- RSVP mode and owner/admin account,
- original ultrasound and dog approval or replacement assets,
- final closing copy,
- compliant hosted audio file if music is desired.

Do not create production SQL patches or real invitation rows in the demo pass.

## Obsolete Artifact Handling

The uncommitted `scripts/manual/production-patches/20260612143000_publish_leah_lexa_baby_shower.sql`
patch is obsolete because it publishes a real `bautizo` compatibility invitation. Delete it and do
not replace it with another production publication patch in this pass.

## Implementation Progress

- Superseded strategy: the former `bautizo` compatibility publication path is no longer the active
  plan.
- Native support: add `baby-shower` to the shared event contract and the minimum dependent type,
  RSVP, intake label/block, demo catalog, documentation, validation, and migration surfaces.
- Demo route: create static demo content at
  `src/content/event-demos/baby-shower/leah-lexa-baby-shower.json` for
  `/baby-shower/leah-lexa-baby-shower`.
- Production data: deferred. No real invitation rows, production SQL patches, or production data
  changes are part of this pass.
- Migration: prepare a Supabase migration for later DB compatibility with native `baby-shower`, but
  do not apply it.
- Assets: reuse provisional demo assets under `src/assets/images/events/leah-lexa-baby-shower/`;
  these are not confirmed client originals.
- Music: omitted until a compliant hosted audio file or approved commercial-music workflow exists.
- Datetime: keep `eventTiming.localDateTime` as `2026-06-21T14:00` with `America/Mexico_City`; use
  `hero.date: 2026-06-21T20:00:00.000Z` only because the current hero schema requires UTC-form ISO
  datetimes.

## Validation Checklist

Focused tests:

- `pnpm test -- tests/content/schema.test.ts`
- `pnpm test -- tests/unit/event.adapter.test.ts`
- `pnpm test -- tests/unit/db-event-adapter.test.ts`
- `pnpm test -- tests/unit/content-resolver.test.ts`
- `pnpm test -- tests/unit/invitation.section-render-data.test.ts`
- `pnpm test -- tests/components/RSVP.test.tsx`
- `pnpm test -- tests/unit/intake-field-visibility.test.ts`

Full validation:

- `pnpm type-check`
- `pnpm lint`
- `pnpm lint:styles:changed`
- `pnpm validate:event-parity`
- `pnpm build`
- `git diff --check`
- `git status --short`
- `pnpm validate:ui-governance` if practical; known unrelated dashboard `client:*` failures should
  be reported, not fixed in this task.

Manual QA:

- `/baby-shower/leah-lexa-baby-shower` loads.
- No visible copy says `Bautizo`.
- Route and metadata represent Baby Shower.
- Envelope opens and seal shows `L`.
- Date/time displays as domingo, 21 de junio de 2026, 2:00 PM without timezone shift.
- Ultrasound asset has no white border.
- Dog composite has five dogs and a prominent center dog.
- Liverpool link contains `51975133`.
- Maps link opens a reasonable location and remains marked for final validation.
- Music is absent.
- Mobile widths 360, 375, 390, 414, and 430px render without overlap.
