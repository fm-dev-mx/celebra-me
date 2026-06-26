---
title: Editorial Magazine XV Theme
status: active
plan_type: implementation
autonomy_level: 2
created: 2026-06-26
updated: 2026-06-26
related_skills:
  - theme-architecture
  - frontend-design
  - copywriting-es
  - astro-patterns
related_docs:
  - .agent/plans/README.md
  - .agent/rules/gatekeeper.md
  - .agent/rules/git-safety.md
  - .agent/rules/invitation-production.md
related_files:
  - src/lib/theme/theme-contract.ts
  - src/lib/intake/demo-preset-catalog.ts
  - src/content/event-demos/xv/demo-xv-editorial-magazine.json
  - src/styles/invitation-presets/editorial-magazine.scss
  - src/styles/invitation-sections-by-preset/editorial-magazine.scss
  - src/styles/themes/presets/_editorial-magazine.scss
---

# Editorial Magazine XV Theme SDD

## Problem Statement

The existing `editorial-cover` reveal gives Celebra-me a magazine-like entrance, but polishing only
the cover creates a mismatch once guests enter the invitation. The target experience is a complete
editorial issue: cover reveal, quote/story spread, save-the-date spread, family/cast cards,
ceremony/reception modules, and RSVP access block.

The system must use a distinctive Celebra-me editorial language. It must not copy protected magazine
brands, must keep visible UI copy in Spanish, and must preserve current reveal behavior, preview
support, no-JS fallback, CTA behavior, existing demos, and published invitations.

## Current-State Audit

Inspected during planning and implementation:

- `src/components/invitation/EditorialCoverReveal.astro`
- `src/styles/invitation/_editorial-cover.scss`
- `src/styles/invitation.scss`
- `src/styles/invitation-presets/`
- `src/styles/themes/presets/`
- `src/styles/themes/sections/`
- `src/styles/invitation-sections-by-preset/`
- `src/lib/theme/theme-contract.ts`
- `src/lib/schemas/content/*`
- `src/lib/adapters/event.ts`
- `src/lib/invitation/page-data.ts`
- `src/pages/[eventType]/[slug].astro`
- `src/pages/dashboard/invitaciones/[id]/preview.astro`
- `src/content/event-demos/xv/demo-xv-editorial.json`
- `src/content/event-demos/xv/demo-xv-editorial-rose.json`
- `src/lib/intake/demo-preset-catalog.ts`

What exists today:

- `EditorialCoverReveal` already renders when `envelope.revealVariant === "editorial-cover"` in
  public and dashboard preview routes.
- `revealVariant`, `coverEdition`, `coverVolume`, and `coverIssue` are already modeled in the
  envelope schema, adapter, and view model.
- `theme.preset` and `sectionStyles.*.variant` validate through `THEME_PRESETS`.
- CSS architecture loads one preset stylesheet plus one section bundle per preset.
- Existing `editorial` and `editorial-rose` demos use `editorial-cover` but do not provide the
  requested red/black/white magazine interior system.

Reusable:

- Existing reveal component and reveal manager behavior.
- Existing public and preview render flow.
- Existing theme preset contract.
- Existing preset CSS and section bundle resolver architecture.
- Existing section `data-variant` contract.

Do not touch:

- Production content in `src/content/events`.
- Database schema, migrations, Supabase repositories, or production SQL.
- Invitation route architecture or duplicated page renderers.
- Existing demos except regression-safe catalog and validation references.

Repo support:

- The feature is cleanly supported without new content fields.
- A narrow contract update is required: add `"editorial-magazine"` to `THEME_PRESETS` and portrait
  support.

## Visual Direction Specification

Design language:

- Magazine cover reveal with issue metadata, bold masthead-like Celebra-me typography, label strips,
  red/black/white contrast, and a real button CTA: "Abrir edición XV".
- Quote/story editorial spread with oversized Spanish quote, dark ink background, red rule, and
  optional author.
- Save-the-date spread with framed date modules, large numerals, double borders, and monochrome or
  high-contrast image treatment.
- Family/cast card system with framed cards, offset black/red shadows, labels such as "Mis padres",
  "Padrinos", and "Con amor y gratitud".
- Ceremony/reception editorial modules for "Ceremonia religiosa" and "Recepción", with clear map
  CTAs.
- RSVP press-pass/access block with "Acceso a la celebración" and the existing RSVP interaction.

Tokens:

- Ink: `#0d0d0f`
- Paper: `#f7f5f2`
- White: `#ffffff`
- Editorial red: `#d71920`
- Muted text: `#6f737c`
- Borders: black/red 1-2px rules, double borders, and offset shadows

Typography roles:

- Masthead/display: high-contrast serif from existing font packages.
- Editorial italic: display serif italic for emphasis.
- Metadata: uppercase sans with clear hierarchy and no negative letter spacing.
- Body: readable Spanish invitation copy using existing serif/sans tokens.

Responsive behavior:

- Mobile layouts stack editorial modules with stable framed dimensions and no text overlap.
- Desktop layouts use bolder spreads and side-by-side magazine compositions.
- All controls remain real buttons/links and keep existing focus/interaction behavior.

## Data And Content Strategy

- Create `src/content/event-demos/xv/demo-xv-editorial-magazine.json`.
- Use `_assetSlug: "demo-xv-editorial"` and only valid keys from the existing demo-owned asset
  registry.
- Do not create placeholder assets.
- Use:
  - `theme.preset: "editorial-magazine"`
  - `envelope.revealVariant: "editorial-cover"`
  - MVP section variants for `quote`, `countdown`, `family`, `location`, and `rsvp`
- Add `demo-xv-editorial-magazine` to `DEMO_PRESET_CATALOG` because no repo convention requires
  hiding new demo presets.
- No schema changes are needed beyond adding the preset to the existing theme contract.

## Architecture Plan

- Keep `EditorialCoverReveal` as the specialized reveal component.
- Add `editorial-magazine` to the existing theme preset contract.
- Add `src/styles/themes/presets/_editorial-magazine.scss`.
- Add `src/styles/invitation-presets/editorial-magazine.scss`.
- Add `src/styles/invitation-sections-by-preset/editorial-magazine.scss`.
- Add section-level SCSS only for the MVP sections where the current architecture already supports
  `data-variant`.
- Do not duplicate routes, `InvitationSections`, or the invitation render flow.
- Do not add dependencies.
- Do not touch production content or database code.

## File-Level Plan

- `src/lib/theme/theme-contract.ts` — modified; add `editorial-magazine` to `THEME_PRESETS` and
  portrait-supported presets.
- `src/lib/intake/demo-preset-catalog.ts` — modified; register the dashboard/demo catalog entry.
- `src/content/event-demos/xv/demo-xv-editorial-magazine.json` — new; Spanish demo content using
  valid existing demo-owned assets.
- `src/styles/themes/presets/_editorial-magazine.scss` — new; token-level magazine identity.
- `src/styles/invitation-presets/editorial-magazine.scss` — new; preset CSS entrypoint and existing
  font imports.
- `src/styles/invitation-sections-by-preset/editorial-magazine.scss` — new; MVP section bundle.
- `src/styles/themes/sections/{hero,quote,countdown,family,location,rsvp}/_editorial-magazine.scss`
  — new; scoped section variants.
- `src/styles/invitation-sections/{hero,quote,countdown,family,location,rsvp}/editorial-magazine.scss`
  — new; section bundle wrappers.
- `src/styles/invitation/_editorial-cover.scss` — modified; scoped cover styling for
  `[data-variant='editorial-magazine']` only.
- `tests/content/schema.test.ts`, `tests/unit/theme-contract.test.ts`, and
  `tests/unit/validate-schema-script.test.ts` — modified; cover contract, catalog, schema, asset,
  and known section-warning behavior.

## Acceptance Criteria

- `/xv/demo-xv-editorial-magazine` renders with `themePreset: "editorial-magazine"`.
- Cover reveal remains functional in public route and preview route.
- CTA remains a real button.
- No-JS fallback still works through `skipEnvelope`.
- Preview reveal states `closed`, `opened`, and `internal` remain supported by the existing preview
  route.
- MVP sections visually match the magazine system.
- Gallery and gifts remain safely styled by base/preset tokens unless compact section styling is
  added later.
- No protected magazine brand names are present in runtime files.
- Existing demos and published invitations are not visually regressed.
- No dependency is added.
- Build and schema validation pass.

## Validation Plan

Run:

- `pnpm type-check`
- `pnpm run lint`
- `pnpm test`
- `pnpm build`
- `pnpm ops validate-schema`
- `rg -n "VOGUE|vogue|Vogue" src public tests`
- `pnpm agent:git-safety:check`
- `pnpm agent:git-safety:end`

Manual/visual QA:

- Public route: `/xv/demo-xv-editorial-magazine`
- Existing reveal regression routes: `/xv/demo-xv-editorial`, `/xv/demo-xv-editorial-rose`
- One non-editorial regression route: `/xv/demo-xv-jewelry-box`
- Mobile 360px, mobile 390px, and desktop 1440px
- No-JS check with `?skipEnvelope=true`
- Verify CSS links include the new preset and section bundle.
- Preview route reveal states should be checked when a local invitation id is available.

## Risks And Mitigations

- Cover-only result: MVP includes interior quote, date, family, location, and RSVP styling.
- Overfitting to one XV demo: selectors are scoped by reusable preset/section variants, not event
  slugs.
- Schema churn: only the theme contract changes; no new content fields.
- CSS bloat: gallery/gifts custom section styling is deferred unless it can stay compact.
- Asset mismatch: existing demo-owned assets are reused; red/black/white impact relies partly on CSS
  filters and composition.
- Protected brand risk: runtime scan is limited to `src public tests` with the forbidden-brand
  command above.

## Phased Execution

1. Add contract and failing tests.
2. Add preset and section bundle entrypoints.
3. Add scoped MVP section styles.
4. Add demo JSON using valid existing demo-owned assets.
5. Add dashboard/demo catalog entry.
6. Run validation and visual QA.
7. Final report with changed files, routes, viewport notes, no-JS/preview status, asset limitations,
   and `git status --short`.

## Non-Goals

- Redesigning the dashboard editor UI.
- Changing database schema or production SQL.
- Changing published production invitations.
- Adding animation libraries.
- Replacing reveal architecture.
- Duplicating routes or invitation render flow.
- Copying third-party magazine brands.

## Visual Hardening Pass

### Current Visual Problems

The initial implementation delivers a functional editorial-magazine preset, but several sections
still reveal inherited generic UI patterns that damage premium perception. The overall theme reads
as "luxury wedding template with red/black accents" rather than "premium fashion/editorial magazine
issue."

Section-by-section diagnosis:

1. **Cover reveal**: The red vertical block dominates too much. The masthead feels
   forced/compressed. The cover is mostly typographic and slightly empty. The CTA looks like a web
   form control instead of an editorial opening action.

2. **Hero**: The double-image composition feels like a collage. The red portrait frame is too
   literal and decorative. The inset portrait feels pasted on top of the background rather than
   editorially composed.

3. **Quote**: Good dramatic mood, but too poster-like and centered. The red bar feels isolated. It
   lacks editorial structure such as a heading, folio, or credit.

4. **Family**: The "Elenco familiar" concept is good, but white layout with thick borders, hard
   shadows, and label stickers feel rough. Parent/godparent cards look like pasted signs rather than
   editorial credits.

5. **Countdown**: Still feels like a widget. The boxed segments with red offset shadows are too
   heavy. The repeated date treatment feels flat.

6. **Location**: Strongly reveals inherited UI: white cards, map buttons, generic layout. The red
   divider is too heavy. Should feel like an editorial itinerary.

7. **Gallery**: Good direction but still behaves like stacked image cards. Rounded corners and lack
   of visible captions make it less magazine-like.

8. **Gifts**: Looks like ecommerce/dashboard cards. Icon-in-circle, shadows, and button styling are
   generic.

9. **Thank-you/closing**: Circular image feels like avatar/profile. The gradient background breaks
   the black/red/marfil editorial system. Feels like a generic thank-you card rather than a magazine
   back cover.

10. **RSVP/access pass**: Looks like a certificate/card from a generic elegant template. The light
    ornamental style breaks the editorial system.

11. **Notes/indications**: Rows and icons feel administrative. Red highlights feel like warnings.

### Scope Boundaries

- Changes isolated to `editorial-magazine` preset/demo.
- Prefer SCSS and demo content/copy refinements.
- No Astro component refactors unless markup makes the visual target impossible.
- No changes to reveal mechanics, CTA behavior, no-JS fallback, routing.
- No schema, adapter, theme contract, or dashboard preview behavior changes.
- No new dependencies or image assets.
- Use existing demo-owned assets only.
- Code/comments in English; visible UI text in Spanish.

### Affected Files

Priority 1 (high-impact):

- `src/styles/invitation/_editorial-cover.scss` — cover variant refinements
- `src/styles/themes/sections/hero/_editorial-magazine.scss` — hero composition
- `src/styles/themes/sections/family/_editorial-magazine.scss` — editorial credits
- `src/styles/themes/sections/location/_editorial-magazine.scss` — editorial itinerary
- `src/styles/themes/presets/_editorial-magazine.scss` — token adjustments

Priority 2 (new section variants):

- `src/styles/themes/sections/gallery/_editorial-magazine.scss` — new gallery variant
- `src/styles/themes/sections/gifts/_editorial-magazine.scss` — new gifts variant
- `src/styles/themes/sections/thank-you/_editorial-magazine.scss` — new closing variant
- `src/styles/invitation-sections/gallery/editorial-magazine.scss` — new section wrapper
- `src/styles/invitation-sections/gifts/editorial-magazine.scss` — new section wrapper
- `src/styles/invitation-sections/thank-you/editorial-magazine.scss` — new section wrapper
- `src/styles/invitation-sections-by-preset/editorial-magazine.scss` — add new section imports

Priority 3 (refinements):

- `src/styles/themes/sections/quote/_editorial-magazine.scss` — editorial framing
- `src/styles/themes/sections/countdown/_editorial-magazine.scss` — reduce widget feel
- `src/styles/themes/sections/rsvp/_editorial-magazine.scss` — press-pass refinement
- `src/content/event-demos/xv/demo-xv-editorial-magazine.json` — copy refinements

### Acceptance Criteria

- `/xv/demo-xv-editorial-magazine` renders with improved editorial aesthetic.
- Cover CTA remains a real `<button>`.
- Reveal transitions to the revealed state correctly.
- Cover becomes hidden after reveal.
- No-JS `?skipEnvelope=true` shows the hero directly.
- Expected preset and section bundle CSS links are present.
- Existing related routes render without regression:
  - `/xv/demo-xv-editorial`
  - `/xv/demo-xv-editorial-rose`
  - `/xv/demo-xv-jewelry-box`
- All sections read as editorial/magazine, not generic UI.
- Red is used sparingly as accent, not as heavy decoration.
- No rounded cards, icon circles, heavy shadows, or dashboard-like buttons remain.
- `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build` pass.

### Validation Commands

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build
pnpm lint:styles:changed
pnpm ops validate-schema
```

### Visual QA Checklist

Viewports: 360px, 390px, 430px, desktop width.

- [ ] Cover CTA is a real button.
- [ ] Reveal transitions to revealed state.
- [ ] Cover hidden after reveal.
- [ ] No-JS `?skipEnvelope=true` shows hero directly.
- [ ] Preset and section bundle CSS links present.
- [ ] Cover: reduced red block, improved masthead, integrated CTA.
- [ ] Hero: deliberate editorial portrait spread, reduced red framing.
- [ ] Quote: editorial breathing room, structured composition.
- [ ] Family: editorial credits page feel, reduced sticker labels.
- [ ] Countdown: editorial announcement, reduced widget feel.
- [ ] Location: editorial itinerary with usable but secondary map actions.
- [ ] Gallery: editorial spread with rectangular crops, visible captions.
- [ ] Gifts: editorial gift guide, reduced UI-card appearance.
- [ ] Thank-you: back cover feel, no avatar-like photo, on-palette.
- [ ] RSVP: press pass feel, restrained ornamentation.
- [ ] Notes/indications: editorial notes, reduced icon/table feel.
- [ ] Related routes render without regression.
