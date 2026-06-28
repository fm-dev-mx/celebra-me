---
title: Valentina Hernandez XV Editorial Section Dividers
status: active
plan_type: implementation
autonomy_level: 2
created: 2026-06-28
updated: 2026-06-28
related_skills:
  - frontend-design
  - theme-architecture
  - animation-motion
related_plans:
  - .agent/plans/active/valentina-section-transitions-analysis.spec.md
  - .agent/plans/active/valentina-editorial-accent-pass.spec.md
  - .agent/plans/active/valentina-editorial-magazine-real-invitation.spec.md
related_rules:
  - .agent/rules/gatekeeper.md
  - .agent/rules/git-safety.md
---

# Valentina Hernandez XV Editorial Section Dividers

## 1. Current Section Order and IDs

This is a Valentina-specific premium visual pass for `/xv/valentina-hernandez`. It is not a generic
divider system and should not be promoted to the `editorial-magazine` preset during this phase.

`src/components/invitation/InvitationSections.astro` renders each item inside:

- `.invitation-section-wrapper`
- `data-section-id="section-{index}-{component}"`

For a guest-context or demo-preview render where PersonalizedAccess is present, the expected order
is:

| Position | Wrapper ID                       | Component                 |
| -------: | -------------------------------- | ------------------------- |
|        0 | `section-0-quote`                | Quote                     |
|        1 | `section-1-family`               | Family                    |
|        2 | `section-2-interlude`            | Interlude after Family    |
|        3 | `section-3-countdown`            | Countdown                 |
|        4 | `section-4-itinerary`            | Itinerary                 |
|        5 | `section-5-interlude`            | Interlude after Itinerary |
|        6 | `section-6-location`             | Location                  |
|        7 | `section-7-interlude`            | Interlude after Location  |
|        8 | `section-8-gallery`              | Gallery                   |
|        9 | `section-9-gifts`                | Gifts                     |
|       10 | `section-10-personalized-access` | PersonalizedAccess        |
|       11 | `section-11-rsvp`                | RSVP                      |
|       12 | `section-12-interlude`           | Interlude after RSVP      |
|       13 | `section-13-thankYou`            | ThankYou                  |

For a public non-guest render, PersonalizedAccess is omitted and RSVP shifts earlier. Numeric IDs
are therefore treated as confirmation evidence only; implementation uses suffix selectors such as
`[data-section-id$='-family']` and `[data-section-id$='-rsvp']`.

## 2. Files Inspected

- `src/components/invitation/InvitationSections.astro`
- `src/lib/invitation/render-plan.ts`
- `src/lib/invitation/section-render-data.ts`
- `.agent/plans/active/xv-valentina-hernandez-db-payload.json`
- `src/components/invitation/Quote.astro`
- `src/components/invitation/Family.astro`
- `src/components/invitation/Interlude.astro`
- `src/components/invitation/Countdown.astro`
- `src/components/invitation/Gallery.astro`
- `src/components/invitation/PhotoGallery.astro`
- `src/components/invitation/PersonalizedAccess.astro`
- `src/components/invitation/RSVP.tsx`
- `src/components/invitation/RSVPComponents.tsx`
- `src/styles/invitation/_interlude.scss`
- `src/styles/themes/sections/_xv-valentina-hernandez.scss`
- `src/styles/themes/sections/quote/_editorial-magazine.scss`
- `src/styles/themes/sections/family/_editorial-magazine.scss`
- `src/styles/themes/sections/countdown/_editorial-magazine.scss`
- `src/styles/themes/sections/personalized-access/_editorial-magazine.scss`
- `src/styles/themes/sections/rsvp/_editorial-magazine.scss`

## 3. Confirmed Selectors and Classes

- Quote wrapper: `.invitation-section-wrapper[data-section-id$='-quote']`
- Family wrapper: `.invitation-section-wrapper[data-section-id$='-family']`
- Family section: `.family[data-variant='editorial-magazine']`
- Family folios already in use: `.family::before` and `.family__header::before`
- Interlude wrapper after Family: `.invitation-section-wrapper[data-section-id$='-interlude']`
- Interlude section: `.invitation-interlude[data-interlude-index='1']`
- Countdown wrapper: `.invitation-section-wrapper[data-section-id$='-countdown']`
- Countdown section: `.countdown-section[data-variant='editorial-magazine']`
- Location wrapper: `.invitation-section-wrapper[data-section-id$='-location']`
- Interlude wrapper after Location: `.invitation-section-wrapper[data-section-id$='-interlude']`
- Gallery wrapper: `.invitation-section-wrapper[data-section-id$='-gallery']`
- Gallery section: `.gallery-section[data-variant='editorial-magazine']`
- PersonalizedAccess wrapper: `.invitation-section-wrapper[data-section-id$='-personalized-access']`
- PersonalizedAccess section: `.personalized-access[data-variant='editorial-magazine']`
- PersonalizedAccess already uses `.personalized-access::before` for a top rule
- RSVP wrapper: `.invitation-section-wrapper[data-section-id$='-rsvp']`
- RSVP card: `.rsvp[data-variant='editorial-magazine']`
- RSVP already uses `.rsvp::before` for the `CONFIRMACION DE ASISTENCIA / R.S.V.P.` label

## 4. Visual Problems at Chosen Boundaries

Quote to Family is the strongest problem: the dark editorial quote ends abruptly and the Family page
enters as a flat light section. The first-pass `paper-page-peak` helped, but it read too literally
as a triangle. The second pass refines it into `paper-page-fold`: lower, wider, and more like a
paper surface entering over the dark quote spread.

Family to Countdown is not a direct boundary. The current payload inserts a full-screen interlude
after Family, so an additional arc at Countdown risks fighting the existing photo transition
surface. The second pass keeps the decision to skip `layered-arc-takeover`.

Location to Gallery is also mediated by a full-screen interlude after Location. The second pass
investigated `photo-diagonal-cut` on the Gallery entry, including wrapper, grid, and first-photo
pseudo-element options. Visual QA showed the effect either disappeared into the gallery stacking or
read as weaker than the existing editorial photo surface, so the divider is intentionally skipped.

PersonalizedAccess to RSVP may or may not be direct, depending on guest context. RSVP needs an entry
shape that still reads correctly when PersonalizedAccess is absent. The first-pass `cta-stage-peak`
worked structurally, but the second pass refines it into `cta-stage-cap`: a wider, flatter cap
integrated with the RSVP card.

## 5. Phase 1 Divider Map

| Boundary                                             | Technique              | Priority | Expected visual result                                                                                   | Risk                                                                        |
| ---------------------------------------------------- | ---------------------- | -------: | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Quote -> Family                                      | `paper-page-fold`      |        1 | Family reads as an ivory editorial page entering over a dark quote spread.                               | Medium: can look like a pasted triangle if too narrow or too sharp.         |
| Family -> Interlude -> Countdown                     | `layered-arc-takeover` |        3 | Skipped unless QA shows the interlude needs help; the existing interlude remains the transition surface. | High: an added arc can fight the photo interlude or read as a generic wave. |
| Location -> Interlude -> Gallery                     | `photo-diagonal-cut`   |        2 | Skipped after QA; the existing interlude and gallery spread remain cleaner than the tested cut.          | Medium: a weak or forced diagonal reads as generic decoration.              |
| PersonalizedAccess or previous light section -> RSVP | `cta-stage-cap`        |        2 | RSVP enters as a deliberate final confirmation stage, valid with or without PersonalizedAccess.          | Medium: can look like a badge/sticker if over-shaped.                       |

## 6. Implementation Strategy

- Keep all CSS in `src/styles/themes/sections/_xv-valentina-hernandez.scss`.
- Scope every selector under `.event--valentina-hernandez.theme-preset--editorial-magazine`.
- Prefer wrapper-level pseudo-elements so existing Family, PersonalizedAccess, and RSVP
  pseudo-elements remain intact.
- Use no more than two visual layers per divider.
- Use `clip-path` only on decorative pseudo-elements, never on real content containers.
- Add minimal local divider tokens for depth and shadow.
- Refine `paper-page-peak` into `paper-page-fold` as the main divider.
- Keep `photo-diagonal-cut` skipped after QA because the tested wrapper and gallery photo-level
  approaches did not meet the premium bar.
- Refine `cta-stage-peak` into `cta-stage-cap` on the RSVP card, not as a PersonalizedAccess-only
  adjacent sibling.
- Keep `layered-arc-takeover` skipped because the Family interlude already works as the transition
  surface.

## 7. Non-Goals

- No global divider or transition system.
- No schema, JSON-configurable, or content model changes.
- No JavaScript or dependency additions.
- No reveal behavior changes.
- No RSVP logic, labels, form state, or link changes.
- No Hero -> Quote, Family -> Countdown arc, Gifts -> PersonalizedAccess, RSVP -> ThankYou, or
  ThankYou -> Footer divider work.
- No production database, staging, deployment, staging, or commit actions.

## 8. Rollback Notes

Rollback is CSS/documentation-only:

1. Remove this spec file if the pass is abandoned before acceptance.
2. Remove the divider token and wrapper selector block from
   `src/styles/themes/sections/_xv-valentina-hernandez.scss`.
3. No migrations, content, schema, or component rollback is required.

## 9. Validation Plan

Run:

```bash
pnpm agent:git-safety:start
pnpm lint:styles:changed
pnpm build
pnpm agent:git-safety:check
pnpm agent:git-safety:end
git status --short
```

Manual route:

```text
/xv/valentina-hernandez?forceEnvelope=true
```

Viewports:

- Mobile around 414px wide
- Desktop around 1440px wide

## 10. Manual Visual QA Checklist

- Quote -> Family reads as `paper-page-fold`, not as a small triangle ornament.
- Existing Family folios remain visible and unbroken.
- Family -> Interlude -> Countdown is inspected as a sequence.
- No extra arc is present if it would fight the interlude.
- Location -> Interlude -> Gallery remains free of an added divider unless a later design pass
  produces a stronger photographic transition than the existing interlude/gallery handoff.
- RSVP entrance reads as an integrated `cta-stage-cap` with or without PersonalizedAccess.
- RSVP buttons, fields, labels, links, and success/error states are untouched.
- No horizontal scroll.
- No clipped content.
- No broken reveal behavior.
- No broken section spacing.
- No console errors introduced.
- Mobile remains the primary quality target.
- Desktop does not look like an afterthought.
