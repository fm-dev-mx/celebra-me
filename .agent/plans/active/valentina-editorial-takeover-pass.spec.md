---
title: Valentina Hernandez XV Editorial Takeover Pass
status: active
plan_type: implementation
autonomy_level: 2
created: 2026-06-28
updated: 2026-06-28
related_skills:
  - frontend-design
  - theme-architecture
  - accessibility
  - copywriting-es
related_rules:
  - .agent/rules/gatekeeper.md
  - .agent/rules/git-safety.md
  - .agent/rules/invitation-production.md
related_plans:
  - .agent/plans/active/valentina-editorial-section-dividers.spec.md
---

# Valentina Hernandez XV Editorial Takeover Pass

## Current Visual Problems Observed

- Guest Notes are rendered through location indications and still read like an administrative note
  list. The existing `NOTA 0n` CSS label is not meaningful markup and does not carry the intended
  editorial guest-code hierarchy.
- Gifts use generic gift cards with small icon medallions and too much empty space, so the section
  feels like a template module instead of a private courtesy/concierge page.
- RSVP has strong black contrast, but the semantic structure still reads as a standard embedded web
  form. The response choices need stronger card affordances, touch targets, and private-access
  framing.
- Location is clear but not yet memorable. Ceremony and reception cards need access-pass labels and
  ticket cues while preserving the real venue, address, date, and times.
- Family, Gallery, and Hero already have editorial direction, but they need a tighter second pass
  after the main weak sections are brought up to the premium level.
- Section dividers already have staged Valentina-specific work. This pass must preserve the staged
  `paper-page-fold` and RSVP cap implementation as user-owned baseline.

## Exact Implementation Scope

- Create this SDD spec before implementation.
- Keep styling Valentina-scoped under `src/styles/themes/sections/_xv-valentina-hernandez.scss`
  unless a shared theme issue is proven.
- Add local, variant-safe markup in invitation components where important visible content must be
  real DOM for comprehension and accessibility:
  - guest-note title metadata in `EventLocation.astro`
  - access-pass numbering in `VenueCard.astro`
  - gift-card numbering/folio metadata in `Gifts.astro`
  - RSVP private-access label and response heading in `RSVPComponents.tsx` / `RSVPFormFields.tsx`
- CSS `content:` is allowed only for decorative folios, counters, issue stamps, rules, and
  non-critical details.
- Preserve all RSVP submission, WhatsApp, guest-cap, location reveal, and gallery/lightbox behavior.

## Non-Goals

- No schema, database, route, content-source, adapter, or publishing-flow changes.
- No production SQL, deploy, staging, commit, push, branch switch, stash, reset, or cleanup actions.
- No Tailwind, new dependencies, broad architecture refactors, or global divider system.
- No replacement of the already-staged divider pass.
- No fake assets, placeholder client data, or invented event details.

## Section-by-Section Design Strategy

- Guest Notes: render each note with a real title (`CÓDIGO DE VESTIMENTA`, `CONFIRMACIÓN`,
  `PUNTUALIDAD`, `CELEBRACIÓN`, `MOMENTOS`) and numeric editorial code. Style the block as a private
  guest guide with black/cream contrast, strong hierarchy, and readable body copy.
- Gifts: render each gift option with real numbering (`01`, `02`, `03`) and concise category text.
  Style cards as physical courtesy cards with double hairlines, VH/issue folios, reduced icon
  prominence, and a premium Liverpool CTA.
- RSVP: keep the form logic intact while adding real private-access framing and a real
  `SELECCIONA TU RESPUESTA` response heading. Strengthen radio cards, focus states, button rhythm,
  and black-card composition.
- Location: add real access-pass labels (`ACCESO 01`, `ACCESO 02`) and optional title attributes
  based on card index/type. Use CSS for ticket perforation, rules, and stamp effects.
- Family: refine as emotional editorial credits without changing real names or gratitude phrases.
- Gallery: make the first image more dominant and keep the mobile swipe affordance visible without
  weakening lightbox accessibility.
- Hero: refine cover authority and folio balance while keeping portrait face/dress legible.
- Transitions: build on the staged Valentina divider pass; do not remove or weaken the existing
  paper fold or RSVP cap.

## Acceptance Criteria

- `/xv/valentina-hernandez` feels like a private luxury editorial edition, not a themed template.
- Guest Notes, Gifts, and RSVP are visibly upgraded and no longer read as generic modules.
- Meaningful visible content is present in markup, not only CSS-generated text.
- All real client data remains accurate: Valentina Hernandez Almaguer, family names, padrinos,
  required gratitude phrases, Finca Las Palmas, address, ceremony/reception times, date, gift
  options, and RSVP behavior.
- UI copy remains Spanish. Code, identifiers, comments, and this spec remain English where
  practical.
- Mobile layout is excellent around iPhone 14 Pro Max width; tablet/desktop do not regress.
- Reduced-motion users do not receive new non-essential motion.
- No unrelated routes, presets, schemas, or production data are changed.

## Validation Plan

Run:

```bash
pnpm agent:git-safety:start
git status --short
git diff --staged -- .agent/plans/active/valentina-editorial-section-dividers.spec.md src/styles/themes/sections/_xv-valentina-hernandez.scss
pnpm lint:styles:changed
pnpm lint
pnpm type-check
pnpm build
pnpm agent:git-safety:check
pnpm agent:git-safety:end
git status --short
```

Manual QA routes:

- `/xv/valentina-hernandez`
- `/xv/valentina-hernandez?forceEnvelope=true`
- `/xv/valentina-hernandez#rsvp`

Manual QA viewports:

- Mobile around 430px wide / iPhone 14 Pro Max class
- Tablet around 768px wide
- Desktop around 1440px wide

Accessibility/reduced-motion checks:

- Keyboard focus remains visible on map/copy buttons, gift CTAs, RSVP radio choices, and submit
  controls.
- RSVP labels and guest-note titles are real DOM text.
- Decorative motion/transitions are removed or simplified under `prefers-reduced-motion: reduce`.
- Gallery items remain keyboard-openable and lightbox behavior remains unchanged.

## Rollback Notes

- Remove this spec file if the pass is abandoned.
- Revert only this pass's changes in Valentina SCSS and local component markup.
- Preserve the already-staged divider spec and divider SCSS unless separately instructed.
- No database, migration, route, or schema rollback is required.

## Files Inspected

- `AGENTS.md`
- `.agent/index.md`
- `.agent/load-skills.md`
- `.agent/rules/gatekeeper.md`
- `.agent/rules/git-safety.md`
- `.agent/rules/invitation-production.md`
- `.agent/plans/active/valentina-editorial-section-dividers.spec.md`
- `.agent/plans/active/xv-valentina-hernandez-db-payload.json`
- `package.json`
- `src/components/invitation/EventLocation.astro`
- `src/components/invitation/components/VenueCard.astro`
- `src/components/invitation/Gifts.astro`
- `src/components/invitation/Gallery.astro`
- `src/components/invitation/PhotoGallery.astro`
- `src/components/invitation/RSVP.tsx`
- `src/components/invitation/RSVPComponents.tsx`
- `src/components/invitation/RSVPFormFields.tsx`
- `src/components/invitation/EditorialMagazineHero.astro`
- `src/styles/themes/sections/_xv-valentina-hernandez.scss`
- `src/styles/themes/sections/location/_editorial-magazine.scss`
- `src/styles/themes/sections/gifts/_editorial-magazine.scss`
- `src/styles/themes/sections/rsvp/_editorial-magazine.scss`
- `src/styles/themes/sections/gallery/_editorial-magazine.scss`

## Files Changed

- `.agent/plans/active/valentina-editorial-takeover-pass.spec.md` - created and updated with
  implementation notes and validation results.
- `src/components/invitation/EventLocation.astro` - added real editorial guest-guide heading,
  guest-note titles, note numbers, and access labels for `editorial-magazine`.
- `src/components/invitation/components/VenueCard.astro` - added optional access-pass label markup.
- `src/components/invitation/Gifts.astro` - added real editorial display title, card numbering, and
  VH/edition folio markup for `editorial-magazine`.
- `src/components/invitation/Gallery.astro` - added real swipe-hint markup for `editorial-magazine`.
- `src/components/invitation/PhotoGallery.astro` - added real editorial `LOOK 0n` labels for
  `editorial-magazine`.
- `src/components/invitation/RSVPComponents.tsx` - added real RSVP private-access framing and
  response heading; refined WhatsApp and success copy.
- `src/components/invitation/RSVPFormFields.tsx` - expanded the decline option label to
  `No podré asistir`.
- `src/styles/themes/sections/_xv-valentina-hernandez.scss` - added Valentina-scoped editorial
  styling for guest guide, gifts, RSVP, access-pass location cards, gallery labels, family credits,
  hero folio polish, and reduced-motion guards while preserving the staged divider work.

## Markup and Shared-Theme Justification

- Several markup changes are guarded by `variant === 'editorial-magazine'` rather than the Valentina
  slug because the existing components do not receive the route slug. Solving important visible
  content in Valentina-only CSS would have made headings, labels, and CTAs inaccessible or
  CSS-generated.
- The shared markup is backward-compatible: non-editorial variants do not receive the new editorial
  labels, and existing props/data contracts remain unchanged.
- The only broad copy refinement outside the variant guard is `No podré` to `No podré asistir`,
  which improves RSVP clarity without changing behavior.

## Final Implementation Notes

- Guest Notes now render as a private guide with real DOM titles and numbers:
  `CÓDIGO DE VESTIMENTA`, `CONFIRMACIÓN`, `PUNTUALIDAD`, `CELEBRACIÓN`, and `MOMENTOS`.
- Gifts now render a real `Mesa de cortesía` heading and numbered concierge-style cards.
- RSVP now renders real private-access framing and `SELECCIONA TU RESPUESTA`, with stronger radio
  states and focus affordances.
- Location cards now have real `ACCESO 01` / `ACCESO 02` labels and Valentina-scoped ticket styling.
- Gallery has real `Desliza la edición` and `LOOK 0n` labels.
- The staged `paper-page-fold` and RSVP cap divider implementation in `_xv-valentina-hernandez.scss`
  was preserved.

## Validation Results

- `pnpm agent:git-safety:start` - passed; baseline captured before edits.
- `git status --short` - inspected before edits; found pre-existing staged divider spec and
  Valentina SCSS changes.
- Staged divider diff - inspected before editing `_xv-valentina-hernandez.scss`.
- `pnpm lint:styles:changed` - passed.
- `pnpm lint` - passed.
- `pnpm type-check` - passed with 0 errors and 2 pre-existing deprecation hints.
- `pnpm build` - passed with 0 errors and the same 2 pre-existing deprecation hints during Astro
  check.
- Browser QA passed for:
  - `/xv/valentina-hernandez`
  - `/xv/valentina-hernandez?forceEnvelope=true`
  - `/xv/valentina-hernandez#rsvp`
  - mobile 430px-wide viewport
  - desktop 1440px-wide viewport
- Browser checks found no console errors and no horizontal overflow in tested mobile/desktop states.
