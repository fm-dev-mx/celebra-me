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
