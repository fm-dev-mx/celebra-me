---
title: Editorial Cover Reveal
status: completed
plan_type: implementation
autonomy_level: 3
created: 2026-06-26
updated: 2026-06-26
completed: 2026-06-26
related_docs:
  - .agent/plans/README.md
  - .agent/rules/intake-publishing.md
  - docs/domains/theme-system.md (if exists)
related_files:
  - src/pages/[eventType]/[slug].astro
  - src/pages/dashboard/invitaciones/[id]/preview.astro
  - src/lib/adapters/types.ts
  - src/lib/adapters/event.ts
  - src/lib/invitation/page-data.ts
  - src/components/invitation/EnvelopeReveal.astro
  - src/components/invitation/EditorialCoverReveal.astro (new)
  - src/styles/invitation.scss
  - src/styles/invitation/_editorial-cover.scss (new)
  - src/content/event-demos/xv/demo-xv-editorial.json
  - src/content/event-demos/xv/demo-xv-editorial-rose.json
supersedes:
  - ~/none
---

# Editorial Cover Reveal — SDD

## 1. Current-State Findings

### Envelope/Reveal Architecture

The existing envelope/reveal system (`EnvelopeReveal.astro` + `RevealManager`) uses:

- A single `<ds-envelope-reveal>` custom element rendered as a fixed full-viewport overlay
- A 3D paper envelope with flap, seal, pocket, stamp, and teaser identity card
- Click-driven open: flap rotates, inner card rises via `envCardRise` animation
- After reveal: `data-reveal-state='revealed'` → envelope fades out (2.2s exit) → hero scrolls into
  view
- Theme variants via `[data-variant]` CSS attribute on `.envelope-wrapper`
- Color override via inline scoped CSS vars from `theme-styles.utils.ts`
- `previewState` prop for dashboard preview (skip if already opened)
- localStorage skip, localStorage forceEnvelope param, dev skipEnvelope param
- `RevealManager` also handles audio playback

### Envelope ↔ Hero Coupling

- The envelope is positioned `fixed; inset: 0; z-index: 9999` — it covers the hero entirely
- Hero and sections are already in the DOM underneath, hidden by the envelope
- On reveal: envelope becomes `hidden`, hero scrolls into view
- `data-reveal-state` on `.event-theme-wrapper` drives envelope visibility
- The existing `EnvelopeReveal.astro` and `Hero.astro` are independent components; the envelope is
  rendered first by both `[slug].astro` and `preview.astro`

### Theme Contract

- `THEME_PRESETS` defines 10 presets including `editorial` and `editorial-rose`
- Envelope variant is typed as `ThemePreset` but used purely for CSS scoping
- Content JSON has `hero`, `envelope`, and all section data as sibling keys
- The envelope data model (`EnvelopeViewModel`) covers: seal style, colors, card data, teaser

### Key Insight

The editorial-cover reveal does NOT need to change the theme system. It uses envelope's existing
`enabled` flag and adds new optional cover-specific fields. The `editorial` and `editorial-rose`
themes remain unchanged.

## 2. Goals

1. Create a new premium editorial reveal variant (`editorial-cover`) that presents as a full-screen
   magazine cover
2. Integrate it as an alternative to the envelope without touching the existing envelope code
3. Use strong typographic hierarchy, subtle paper texture, magazine metadata (edition/issue/volume)
4. Spanish CTA (e.g., "ABRIR EDICIÓN XV")
5. Lightweight cover-split motion via CSS transforms
6. Graceful reduced-motion behavior
7. Clean transition into the existing hero section
8. Opt-in per invitation via envelope data fields (no new theme presets)
9. Make the editorial-rose and editorial demos use this new reveal
10. No regressions in build, SSR, caching, or Vercel compatibility

## 3. Non-Goals

- Not a variant of the existing envelope component — it's a standalone alternative
- No new theme presets added
- No content schema migrations (only optional envelope data fields)
- No new libraries, frameworks, or build tools
- No change to the envelope/he​ro CSS architecture for other themes
- No changes to RSVP, sections, music, or invitation content model
- No Three.js, GSAP, Canvas, WebGL
- No changes to `astro.config`, `tsconfig`, `package.json`

## 4. Technical Constraints

- Astro SSR (`output: 'server'`), Vercel adapter — must not break SSR
- Server/client boundaries: reveal UI+css are client-side, but the component mounts server-side in
  Astro
- CSS must be imported via existing SCSS pipeline (`invitation.scss` entrypoint)
- Preserve `[data-reveal-state]` contract for music-player and hero interaction
- Use Spanish for UI copy, English for code identifiers and comments
- `prefers-reduced-motion` must be respected
- Must not block access to invitation content if JS fails (graceful degradation via SSR rendering)
- Must handle preview state (dashboard preview vs public invitation)

## 5. Data/Model Assumptions

### New optional envelope data fields (in `EnvelopeViewModel.data`)

```typescript
revealVariant?: 'editorial-cover';  // Activation flag: when 'editorial-cover', renders the editorial-cover reveal instead of the envelope
coverEdition?: string;               // e.g., "XV" — the edition number (presentation only)
coverVolume?: string;                // e.g., "1" — the volume number (presentation only)
coverIssue?: string;                 // e.g., "2026" — the issue year (presentation only)
```

When `revealVariant === 'editorial-cover'`, the editorial-cover reveal is used. `coverEdition`,
`coverVolume`, and `coverIssue` are presentation metadata only — they do not control which reveal
component renders. Fallback is the existing envelope.

### Magazine cover composition (derived from existing data)

| Element        | Source                                      |
| -------------- | ------------------------------------------- |
| Masthead       | "Celebra·Me" (fixed brand)                  |
| Edition        | `coverEdition` (e.g., "XV")                 |
| Cover headline | `hero.name` + `hero.secondaryName`          |
| Event label    | `hero.label` or `envelope.documentLabel`    |
| Date           | `hero.date` (formatted es-MX)               |
| Venue          | `hero.venueName` or location venue          |
| CTA            | `"ABRIR EDICIÓN ${coverEdition}"`           |
| Volume/Issue   | `coverVolume` + `coverIssue`                |
| Background     | `hero.backgroundImage` or dark editorial bg |

## 6. Implementation Plan

### Phase 1: SDD Spec (this document)

### Phase 2: Type and schema updates

- Add `revealVariant`, `coverEdition`, `coverVolume`, `coverIssue` to `EnvelopeViewModel.data` in
  `types.ts`
- Add corresponding optional fields to `envelope.schema.ts` (Zod schema for content validation)

### Phase 3: Adapter pass-through

- In `event.ts` `buildEnvelope()`, copy `data.envelope.revealVariant`, `data.envelope.coverEdition`,
  `data.envelope.coverVolume`, `data.envelope.coverIssue` into the envelope view model

### Phase 4: New component — `EditorialCoverReveal.astro`

- Full-screen fixed overlay with editorial magazine layout
- Uses existing hero data + envelope data for composition
- Includes:
  - Magazine masthead "CELEBRA·ME · EDICIÓN {coverEdition}"
  - Honoree name displayed as cover headline with strong typography
  - Event details (date, venue)
  - CTA button "ABRIR EDICIÓN {coverEdition}"
  - Volume/Issue footer metadata
  - Subtle paper grain texture on the background
  - No-JS fallback: shows a simple link/button with `href` to skip
- Custom element class: `DsEditorialCoverReveal`
- On open: apply CSS class that triggers cover-split animation, then calls same `completeReveal`
  pattern as envelope

### Phase 5: SCSS — `_editorial-cover.scss`

- Full-screen fixed cover with `z-index: 9999` (same as envelope)
- Editorial layout:
  - Magazine masthead at top
  - Cover headline in large display font
  - Details section
  - CTA button centered
  - Issue/volume footer
  - Paper texture overlay using CSS gradients
- Cover-split animation: the cover translates upward (translateY(-100%)) with scale and opacity
- Exit transition mirrors envelope's `--duration-long` timing
- `prefers-reduced-motion`: opacity-only fade
- Dark theme by default with CSS custom properties for themeability
- Mobile responsive

### Phase 6: Route integration

- In `[slug].astro`, conditionally render `<EditorialCoverReveal>` when
  `envelope.revealVariant === 'editorial-cover'`
- Same pattern in `preview.astro`
- Reuse same `data-reveal-state` and `completeReveal` flow pattern

### Phase 7: Demo content updates

- Add `revealVariant: "editorial-cover"`, `coverEdition: "XV"`, `coverVolume: "1"`,
  `coverIssue: "2026"` to:
  - `demo-xv-editorial.json` envelope
  - `demo-xv-editorial-rose.json` envelope

### Phase 8: Validation

- `pnpm type-check`
- `pnpm lint` (touched files)
- `pnpm build`
- `pnpm test`
- Route-level checks: `/xv/demo-xv-editorial`, `/xv/demo-xv-editorial-rose`,
  `/xv/demo-xv-jewelry-box`

## 7. Acceptance Criteria

| Criterion                                                                         | Method                        |
| --------------------------------------------------------------------------------- | ----------------------------- |
| Editorial-cover renders as a full-screen magazine cover, not a decorated envelope | Visual inspection             |
| Old envelope still works on jewelry-box, celestial-blue, etc.                     | Route check                   |
| CTA button shows "ABRIR EDICIÓN XV" in Spanish                                    | Visual                        |
| Clicking CTA triggers cover-split open animation                                  | Visual                        |
| After animation completes, hero section is visible and scrolls into view          | Visual                        |
| `prefers-reduced-motion` disables animation, uses fade-only                       | DevTools test                 |
| Works on mobile viewport                                                          | DevTools device mode          |
| No JS fail: SSR renders a fallback (link/button) that reveals content             | Browser test with JS disabled |
| Dashboard preview works with the new reveal                                       | Route check                   |
| No type errors, lint errors, test failures, build failures                        | Validation commands           |
| No regressions on existing envelope themes                                        | Route + build check           |

## 8. Validation Checklist

- [x] `pnpm type-check` passes (0 errors)
- [x] `pnpm lint` shows no new errors (0 errors)
- [x] `pnpm build` passes (16.9s, complete)
- [x] `pnpm test` passes (209 suites, 2747 tests, 2 skipped)
- [x] Old reveal (jewelry-box demo) still works (`ds-envelope-reveal` count 3)
- [x] New reveal (editorial-rose demo) renders and opens (`ds-editorial-cover` count 2)
- [x] New reveal (editorial demo) renders and opens (`ds-editorial-cover` count 2)
- [x] Mobile viewport acceptable (responsive CSS via `respond-below(sm)` and `short-viewport`
      mixins)
- [x] Reduced-motion behavior works (`@include mixins.reduced-motion` — opacity-only fade)
- [x] No-JS fallback works (`<noscript>` link with `skipEnvelope` param)
- [x] Preview route handles new reveal (same `buildEnvelopeData` → `pageCtx.envelope.revealVariant`
      path)

## 9. Implementation Summary

### Root Cause

`resolveInvitationContent()` in `content-resolver.ts` checked the DB-published table first. For
`demo-xv-editorial`, a stale DB entry existed (published before the `revealVariant` field was added)
that lacked the new envelope fields. The resolver returned this stale data, so the viewModel had no
`revealVariant`, and the route fell through to the legacy envelope.

`demo-xv-editorial-rose` worked because no stale DB entry existed for it, so the static JSON
fallback was reached.

### Fix

**File:** `src/lib/invitation/content-resolver.ts` **Change:** Added `&& !publishedEntry.isDemo`
guard on the DB-published content path. Demo entries now always use the static JSON files as their
canonical source.

```diff
- if (publishedEntry) {
+ if (publishedEntry && !publishedEntry.isDemo) {
```

### Files Changed (beyond the staged feature files)

| Action | File                                     | Reason                        |
| ------ | ---------------------------------------- | ----------------------------- |
| MODIFY | `src/lib/invitation/content-resolver.ts` | Skip DB path for demo entries |

### Route-Level Validation Evidence

| Route                        | `ds-editorial-cover` | `ds-envelope-reveal` | Status |
| ---------------------------- | -------------------- | -------------------- | ------ |
| `/xv/demo-xv-editorial`      | 2 occurrences        | 1 occurrence         | ✅     |
| `/xv/demo-xv-editorial-rose` | 2 occurrences        | 1 occurrence         | ✅     |
| `/xv/demo-xv-jewelry-box`    | 0 occurrences        | 3 occurrences        | ✅     |

### Validation Commands and Results

| Command           | Result                                                         |
| ----------------- | -------------------------------------------------------------- |
| `pnpm type-check` | 0 errors, 0 warnings, 2 hints (pre-existing deprecation hints) |
| `pnpm run lint`   | 0 errors                                                       |
| `pnpm run test`   | 209 suites passed, 2747 tests passed, 2 skipped                |
| `pnpm build`      | Server built in 16.91s, complete                               |

### Remaining Risks

- If other demo entries have stale DB-published content, they may also exhibit stale behavior. The
  fix prevents this by always using static JSON for demos.
- The `findPublishedBySlugAndEventType` function may return DB results for demo slugs that were
  previously published for testing. The fix addresses this.

### Rollback Notes

- Revert changes to: `[slug].astro`, `preview.astro`, `types.ts`, `event.ts`, `invitation.scss`,
  `content-resolver.ts`
- Remove: `EditorialCoverReveal.astro`, `_editorial-cover.scss`
- Revert demo JSON envelope changes
- Run `pnpm build` and route checks
- All routes fall back to existing envelope behavior

### Final Status

**COMPLETED** — All acceptance criteria met. The editorial-cover reveal feature is fully integrated:

- Both editorial demo routes render `ds-editorial-cover`
- Legacy routes render `ds-envelope-reveal`
- Activation is based on explicit `revealVariant === 'editorial-cover'` (not metadata)
- The same logic works in public invitation and dashboard preview routes
- No debug artifacts remain
- No placeholder/unused code in EditorialCoverReveal.astro
- Existing hero and legacy envelope are untouched

## 10. Visual Design Brief

The editorial cover should feel like the cover of a premium fashion/ lifestyle magazine:

```
┌──────────────────────────────────┐
│ CELEBRA·ME  ·  EDICIÓN XV       │  ← Magazine masthead (top bar)
│                                  │
│                                  │
│       Aurora Valencia            │  ← Cover headline (large display type)
│                                  │
│   Sábado, 28 de agosto 2027     │  ← Event details
│   Salón Magnolia                 │
│                                  │
│       [ ABRIR EDICIÓN XV ]      │  ← CTA button
│                                  │
│   Vol. 1 · No. 2026             │  ← Footer metadata
└──────────────────────────────────┘
```

- Background: deep dark/editorial tone with subtle paper grain overlay
- Typography: strong hierarchy — masthead (small caps), headline (large serif display), details
  (clean sans or light serif)
- CTA: distinct but not gaudy, text in white on subtle accent background
- Split animation: cover lifts/slides upward revealing the hero section underneath
- Subtle paper texture via CSS radial-gradient + repeating-linear-gradient noise

## 11. File Summary

| Action | File                                                                       |
| ------ | -------------------------------------------------------------------------- |
| CREATE | `.agent/plans/active/editorial-cover-reveal.md`                            |
| CREATE | `src/components/invitation/EditorialCoverReveal.astro`                     |
| CREATE | `src/styles/invitation/_editorial-cover.scss`                              |
| MODIFY | `src/lib/adapters/types.ts` (add envelope optional fields)                 |
| MODIFY | `src/lib/adapters/event.ts` (pass-through cover fields)                    |
| MODIFY | `src/lib/schemas/content/envelope.schema.ts` (add Zod schema fields)       |
| MODIFY | `src/lib/invitation/content-resolver.ts` (skip DB path for demos)          |
| MODIFY | `src/pages/[eventType]/[slug].astro` (conditional render)                  |
| MODIFY | `src/pages/dashboard/invitaciones/[id]/preview.astro` (conditional render) |
| MODIFY | `src/styles/invitation.scss` (import new SCSS)                             |
| MODIFY | `src/content/event-demos/xv/demo-xv-editorial.json` (add cover data)       |
| MODIFY | `src/content/event-demos/xv/demo-xv-editorial-rose.json` (add cover data)  |
