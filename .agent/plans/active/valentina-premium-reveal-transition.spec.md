---
title: Valentina Premium Reveal Transition
status: active
type: implementation
created: 2026-06-27
updated: 2026-06-27
autonomy: 'Level 2 - Local code changes allowed, no staging/commit/deploy'
related_skills:
  - frontend-design
  - animation-motion
  - accessibility
  - theme-architecture
related_rules:
  - .agent/rules/gatekeeper.md
  - .agent/rules/git-safety.md
  - .agent/rules/invitation-production.md
related_docs:
  - docs/core/architecture.md
  - docs/domains/theme/architecture.md
  - docs/domains/theme/typography.md
---

# Valentina Premium Reveal Transition

## Mission

Eliminate the mirror effect between the editorial cover and the first interior hero on
`/xv/valentina-hernandez` by making the cover read as the magazine jacket and the hero read as a
premium feature spread. The result must feel like a deliberate editorial pace change: centralized
impact first, then asymmetric negative space, restrained hierarchy, and choreographed entry.

## Preflight Findings

### Repository context loaded

- `AGENTS.md`
- `.agent/index.md`
- `.agent/load-skills.md`
- `.agent/rules/gatekeeper.md`
- `.agent/rules/git-safety.md`
- `.agent/plans/README.md`
- `.agent/skills/frontend-design/SKILL.md`
- `.agent/skills/animation-motion/SKILL.md`
- `.agent/skills/theme-architecture/SKILL.md`
- `.agent/workflows/plan-authoring.md`
- `.agent/workflows/theme-architecture-governance.md`
- `docs/domains/theme/architecture.md`
- `docs/domains/theme/typography.md`

### Target path validation

All requested target files exist at the expected workspace paths:

| File                                                         | Status |
| ------------------------------------------------------------ | ------ |
| `src/components/invitation/EditorialCoverReveal.astro`       | Found  |
| `src/styles/invitation/_editorial-cover.scss`                | Found  |
| `src/styles/themes/sections/hero/_editorial-magazine.scss`   | Found  |
| `src/styles/themes/sections/header/_editorial-magazine.scss` | Found  |
| `src/styles/themes/sections/_xv-valentina-hernandez.scss`    | Found  |

### Current implementation notes

- `EditorialCoverReveal.astro` already preserves the binary global reveal contract and uses the
  local `data-editorial-reveal-phase="revealing"` on both the cover wrapper and invitation root.
- The current cover CTA text is `ABRIR EDICIÓN XV` for Valentina because `coverEdition` is present.
- `_editorial-cover.scss` still contains `text-shadow` in
  `.editorial-cover-wrapper[data-variant='editorial-magazine'] .editorial-cover__headline`.
- `_xv-valentina-hernandez.scss` adds additional `text-shadow` to `.editorial-masthead__brand`,
  `.editorial-cover__headline`, and the mobile `.invitation-hero__title`.
- `_editorial-magazine.scss` currently uses a full-screen background with a large uppercase hero
  name, right-side portrait, and metadata footer. That repeats the cover hierarchy too closely.
- `Hero.astro` has no lyrical prose node inside the hero. The quote text exists in
  `.agent/plans/active/xv-valentina-hernandez-db-payload.json` under `quote.text`, but it renders in
  the quote section, not the hero. This implementation must avoid inventing invisible prose in CSS.

## Authority And Scope

### Allowed file scope

- `src/components/invitation/EditorialCoverReveal.astro`
- `src/styles/invitation/_editorial-cover.scss`
- `src/styles/themes/sections/hero/_editorial-magazine.scss`
- `src/styles/themes/sections/header/_editorial-magazine.scss`
- `src/styles/themes/sections/_xv-valentina-hernandez.scss`
- Focused test/spec files only if needed to guard the reveal contract.

### Non-goals

- No third global reveal state. The only global states remain `data-reveal-state="sealed"` and
  `data-reveal-state="revealed"`.
- No schema, database, payload, adapter, route, content resolver, or asset registry change.
- No broad hero component refactor unless the existing DOM cannot express the layout. If markup is
  touched, keep it local and explicit in `Hero.astro`; otherwise prefer SCSS only.
- No new dependencies, mixin systems, Tailwind, or over-abstracted choreography helpers.
- No staging, committing, pushing, deploying, or production database operations.

## Design Direction

### Cover: The Impact

The cover remains centralized, massive, and reticular. It should feel like a flat fashion cover, not
a web hero overlay.

- Keep the masthead/name dominant and uppercase.
- Retain the structured grid and issue metadata, but reduce mobile density where elements compete.
- Remove visible text shadows from cover typography.
- Use photo grading and subtle scrims for contrast:
  - `linear-gradient()` scrims on background layers are allowed.
  - `filter` on the image is allowed if restrained.
  - Heavy drop shadows on text are not allowed.
- Convert the pill-like CTA into a text-driven editorial interaction:
  - Preferred text: `ENTRAR A LA EDICIÓN`
  - Acceptable fallback: `DESCUBRIR`
  - Wide tracking and underline/rule treatment instead of a filled rounded control.
  - Keep semantic `<button>` behavior and visible focus.

### Hero: The Feature Spread

The hero must no longer repeat the cover's centered uppercase-name composition. It becomes an
asymmetric magazine spread with a large photographic art frame and intentional blank canvas.

- Use a split editorial composition on desktop:
  - Photo/art field: 50-60% width.
  - Copy/metadata field: remaining 40-50%.
  - The two fields should not be visually centered as a symmetric hero.
- The portrait or image frame should act like a gallery art block:
  - Rectangular, border-radius `0`.
  - Width target: `min(58vw, 680px)` on desktop.
  - Aspect ratio target: `4 / 5` or `3 / 4`, depending on the available image crop.
  - Use `object-fit: cover`; preserve Valentina-specific focal points.
- Use negative space on the opposite side:
  - Desktop content column max-width: `min(34rem, 38vw)`.
  - Asymmetric padding: larger outer edge, quieter inner gap.
  - Avoid text or image touching viewport edges.
- Decompress typography:
  - `.invitation-hero__label` becomes the chapter concept, visually similar to `Capítulo XV`.
  - `.invitation-hero__title` becomes a byline/signature element, not the primary headline.
  - The primary narrative energy should point users into the next quote section, where the existing
    Spanish line begins: `Dicen que la moda es temporal...`.
- Because the current hero DOM has no prose node, do not fake prose with CSS generated content.
  Instead, use the hero label/title/details as chapter/byline metadata and let the following quote
  section carry the lyrical prose.

## Layout Mechanics

### Desktop hero mechanics

| Selector                                              | Current role                                 | Required behavior                                                                                                                      |
| ----------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `.invitation-hero[data-variant='editorial-magazine']` | Full-screen centered hero canvas             | Keep `min-height: 100svh`; set a pale/editorial surface for Valentina via event scope; hide horizontal overflow.                       |
| `.invitation-hero__background`                        | Full-bleed background photo                  | For Valentina, demote to atmosphere/surface or set low-contrast backing; the art-frame photo must carry the visual weight.             |
| `.invitation-hero__content`                           | Two-column grid with name and portrait       | Rebuild as asymmetric grid: `minmax(0, 0.58fr) minmax(18rem, 0.42fr)` or equivalent, width `min(1240px, 100%)`.                        |
| `.invitation-hero__portrait`                          | Small right portrait, max 340px              | Promote to art frame: width `min(58vw, 680px)`, justify left or right based on composition, `aspect-ratio: 4 / 5`, no rounded corners. |
| `.invitation-hero__label`                             | Small metadata                               | Treat as chapter concept: wide tracked uppercase, top rule, delay at T+150ms.                                                          |
| `.invitation-hero__title`                             | Massive uppercase repeated name              | Downscale to signature/byline: target `clamp(1.55rem, 3.2vw, 3rem)`, line-height `0.95-1.05`, no text-shadow.                          |
| `.invitation-hero__details`                           | Absolute bottom metadata rail                | Convert to quiet metadata below/by the byline; avoid mirroring cover metadata stack.                                                   |
| `.invitation-hero__divider`                           | Hidden in current editorial-magazine variant | Re-enable as a minimalist top/side rule when it supports the chapter rhythm.                                                           |

### Mobile hero mechanics

| Viewport       | Required behavior                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `390px`        | Use a dramatic single-column museum-gallery layout. The portrait/art frame must command the viewport at roughly `width: min(88vw, 24rem)` with safe centered or subtly off-center margins, never a small thumbnail. |
| `414px`        | Preserve the same gallery hierarchy with slightly more outer canvas. Keep the art block dominant and avoid any narrow metadata columns.                                                                             |
| Short viewport | Keep the art block visually protagonist while reducing vertical gaps and title scale only as needed. Do not shrink the portrait below a proud gallery-frame footprint.                                              |

Mobile structural rules:

- Abolish the two-column mobile grid and any narrow metadata track.
- Set `.invitation-hero__content` to one column with explicit grid areas: `label`, `title`, `art`,
  `rule`, `details`.
- Place `.invitation-hero__portrait` as the dominant art block: `width: min(88vw, 24rem)`,
  `max-width: 100%`, `aspect-ratio: 4 / 5`, and centered or slightly off-center through
  `justify-self`/`margin-inline`.
- Place `.invitation-hero__details` as a horizontal typographic belt below the art frame or at the
  base of the hero: `display: flex`, `flex-wrap: wrap`, `justify-content: center`, and no
  column-constrained text.
- Keep `.invitation-hero__details p` readable as small uppercase editorial metadata:
  `white-space: nowrap`, `letter-spacing: 0.2em`, and restrained separators/rules.
- Add dimensional couture layering by letting `.invitation-hero__label` or
  `.invitation-hero__divider` overlap the portrait edge using transform/margins. This overlap must
  be intentional and must not hide Valentina's face or create horizontal overflow.

## Property Modification Requirements

| Area              | Required property changes                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cover shadows     | Remove `text-shadow` from the editorial-magazine cover headline and Valentina event cover overrides.                                                                               |
| Hero shadows      | Remove `text-shadow` from Valentina mobile `.invitation-hero__title`; achieve contrast through surface, scrim, and layout.                                                         |
| CTA               | Replace pill/fill emphasis with transparent text/rule styling, wide tracking, and subtle transform/opacity hover.                                                                  |
| Cover exit        | Keep wrapper and container moving upward together; max wrapper visual glide should feel smooth, not abrupt.                                                                        |
| Mobile hero frame | Replace thumbnail-like sizing with `width: min(88vw, 24rem)`, `aspect-ratio: 4 / 5`, and gallery-wall margins.                                                                     |
| Mobile metadata   | Replace narrow stacked metadata with a horizontal belt: flex row, wrapping allowed between whole items only, `white-space: nowrap`, `letter-spacing: 0.2em`, and no word-crushing. |
| Mobile layering   | Allow label/divider overlap over the outer art-frame edge through transform-only positioning; keep it within viewport bounds.                                                      |
| Header            | Force opacity `0` and pointer-events `none` during the local reveal phase; reveal only after hero impact.                                                                          |
| Overflow          | Add or preserve `overflow: hidden` on fixed-format hero/cover containers and use `minmax(0, ...)` grid tracks.                                                                     |

## Reveal State Contract

| Phase     | Global `data-reveal-state` | Local `data-editorial-reveal-phase`      | Behavior                                                                                                              |
| --------- | -------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Sealed    | `sealed`                   | absent                                   | Cover visible and interactive; hero prepared but visually subordinate; header suppressed by existing sealed behavior. |
| Revealing | `sealed`                   | `revealing` on cover and invitation root | Cover exits upward; hero atmosphere and elements enter in staggered sequence; header remains invisible.               |
| Complete  | `revealed`                 | absent                                   | Cover hidden; hero is visible and focused if needed; header begins delayed reveal.                                    |

## Motion Specification

Use only `opacity` and `transform` for primary choreography. Avoid animating `width`, `height`,
`padding`, `top`, `left`, `right`, `bottom`, or font sizes.

### Easing

| Token / Use                         | Function                         |
| ----------------------------------- | -------------------------------- |
| Editorial expo reveal               | `cubic-bezier(0.16, 1, 0.3, 1)`  |
| Soft fade/supporting layers         | `cubic-bezier(0.33, 1, 0.68, 1)` |
| Existing cover fallback if retained | `cubic-bezier(0.19, 1, 0.22, 1)` |

### Choreography table

| Time          | Selector / element                                             | Initial state                                 | Final state                               | Duration      | Easing                           |
| ------------- | -------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------- | ------------- | -------------------------------- |
| T+0ms         | Hero canvas/background                                         | `opacity: 0` or subdued sealed atmosphere     | `opacity: 1`                              | `700ms`       | `cubic-bezier(0.33, 1, 0.68, 1)` |
| T+0ms         | `.editorial-cover-wrapper`                                     | `opacity: 1; transform: translateY(0)`        | `opacity: 0; transform: translateY(-14%)` | `1200-1600ms` | `cubic-bezier(0.16, 1, 0.3, 1)`  |
| T+150ms       | `.invitation-hero__divider`, `.invitation-hero__label`         | `opacity: 0; transform: translateY(10px)`     | `opacity: 1; transform: translateY(0)`    | `520ms`       | `cubic-bezier(0.16, 1, 0.3, 1)`  |
| T+300ms       | `.invitation-hero__portrait` art frame                         | `opacity: 0; transform: translateY(20px)`     | `opacity: 1; transform: translateY(0)`    | `760ms`       | `cubic-bezier(0.16, 1, 0.3, 1)`  |
| T+450ms       | `.invitation-hero__title`, `.invitation-hero__details`         | `opacity: 0; transform: translateY(14px)`     | `opacity: 1; transform: translateY(0)`    | `680ms`       | `cubic-bezier(0.16, 1, 0.3, 1)`  |
| T+1050-1250ms | `#event-header.header-base[data-variant='editorial-magazine']` | `opacity: 0; transform: translateY(-0.45rem)` | `opacity: 1; transform: translateY(0)`    | `620-700ms`   | `cubic-bezier(0.16, 1, 0.3, 1)`  |

### Header suppression

- During `.event-theme-wrapper[data-editorial-reveal-phase='revealing']`, header opacity must be
  `0`, transform may be `translateY(-0.45rem)`, and pointer events must be disabled.
- During `.event-theme-wrapper[data-reveal-state='revealed']`, header reveal delay must start only
  after the hero art frame and byline have begun. Target delay: `1.05s` minimum.
- Under reduced motion, the header should be immediately visible once the page is revealed.

## Implementation Blueprint

### 1. Cover reveal component

File: `src/components/invitation/EditorialCoverReveal.astro`

- Preserve the existing custom element and binary reveal state.
- Keep local phase setting/clearing as-is unless a bug is found.
- Update CTA copy only if done in markup logic:
  - `coverEdition ? 'ENTRAR A LA EDICIÓN' : 'DESCUBRIR'`
  - UI-visible text remains Spanish.
- Do not add new global state or body classes.

### 2. Cover SCSS

File: `src/styles/invitation/_editorial-cover.scss`

- Remove editorial-magazine cover `text-shadow`.
- Rework `.editorial-cover__cta` and editorial-magazine CTA overrides into a text/rule interaction:
  - transparent background,
  - no heavy box-shadow,
  - border/rule emphasis,
  - wide tracking,
  - focus-visible outline preserved.
- Keep `data-editorial-reveal-phase='revealing'` and `.is-opening` selectors aligned.
- Use `--ec-exit-duration` and the editorial expo easing for wrapper/container exit.
- Keep reduced-motion block immediate and clean.

### 3. Generic editorial-magazine hero

File: `src/styles/themes/sections/hero/_editorial-magazine.scss`

- Make the base editorial-magazine variant capable of an asymmetric feature-spread composition.
- Keep changes useful for future editorial-magazine invitations:
  - structural asymmetry,
  - stable art-frame portrait sizing,
  - decompressed title scale,
  - generic motion sequence.
- Do not hardcode Valentina-only colors or slug-specific values here.
- Remove base hero title `text-shadow`.
- Re-enable `.invitation-hero__divider` only if the rule is visually restrained.

### 4. Header editorial-magazine SCSS

File: `src/styles/themes/sections/header/_editorial-magazine.scss`

- Keep theme token overrides.
- Enforce absolute header suppression during `data-editorial-reveal-phase='revealing'`.
- Delay revealed animation until after hero impact; target delay no earlier than `1.05s`.
- Preserve reduced-motion immediate revealed state.

### 5. Valentina event-scoped overrides

File: `src/styles/themes/sections/_xv-valentina-hernandez.scss`

- Keep Valentina-only palette inside `.event--valentina-hernandez.theme-preset--editorial-magazine`.
- Remove cover and hero `text-shadow` overrides.
- Apply Valentina-specific hero spread tuning:
  - blush/paper surface,
  - charcoal text where the hero is light,
  - photo frame placement and focal point,
  - mobile-safe title/details sizing,
  - no horizontal overflow at 390px and 414px.
- Do not move these one-off event values into the generic editorial-magazine preset.

## Reduced Motion

Under `prefers-reduced-motion: reduce`:

- Do not run staged cover or hero animations.
- Complete reveal immediately through the existing JS path.
- Force hero elements to `opacity: 1`, `transform: none`, `animation: none`.
- Header is visible in the revealed state and hidden only while sealed/revealing.
- No infinite bounce or shimmer should be introduced.

## Validation Plan

### Required after spec-only change

- `pnpm agent:git-safety:check`
- `pnpm agent:git-safety:end`

### Required after implementation

- `pnpm lint:styles:changed`
- `pnpm type-check`
- `pnpm build`
- `pnpm agent:git-safety:check`
- `pnpm agent:git-safety:end`

### Visual QA after implementation

- Start `pnpm dev`.
- Verify `/xv/valentina-hernandez?forceEnvelope=true` at:
  - `390px`
  - `414px`
  - desktop width around `1440px`
- Inspect:
  - sealed cover,
  - CTA focus and activation,
  - mid-transition hero atmosphere,
  - first revealed hero frame,
  - header delay,
  - reduced-motion reveal.
- Spot-check a non-Valentina editorial-magazine route such as `/xv/demo-xv-editorial-magazine` when
  shared editorial-magazine styles change.

## Acceptance Criteria

- Cover and hero no longer present the same large uppercase-name hierarchy back-to-back.
- Cover typography has no visible `text-shadow`.
- Hero title/name is reduced to a byline/signature role.
- Hero composition is asymmetric and uses a large art-frame photo with intentional negative space.
- Header remains invisible throughout the revealing phase.
- Motion follows the specified T+0/T+150/T+300/T+450 sequence and uses the expo easing.
- No horizontal overflow appears at 390px or 414px.
- Reduced-motion users get an immediate clean reveal.
- The global reveal state remains strictly binary.
- No staging, commits, deploys, production DB operations, or broad architecture refactors occur.

## Stop Conditions

- The required visual result needs schema or database payload changes.
- The implementation requires a broad hero architecture rewrite beyond the allowed local scope.
- Validation failure cannot be attributed to this pass.
- Visual QA shows worse mobile legibility, overflow, inaccessible focus, or a blank transition
  frame.
- Git safety reports unexpected staged-state or HEAD drift.

## Rollback Notes

- Revert only this spec and the allowed implementation files listed in scope.
- No database rollback is required.
- Do not run destructive git cleanup commands automatically.

## Valentina Editorial Feature Hero Pivot

### Why the Current Hero Fails

1. **Layout Symmetrical Redundancy**: The previous layout is too symmetric, mirroring a typical
   digital card poster. It lacks the dynamic tension, negative space, and offset hierarchy of
   high-end fashion magazine spreads.
2. **Text-Shadow Clutter**: The use of heavy drop shadows degrades the typographic purity and feels
   dated. Premium editorial design uses high-contrast surface pairing (blush paper & deep charcoal
   ink) to maintain readability.
3. **Repeated Visual Weight**: Using the same portrait image for both the cover backdrop and the
   hero portrait creates a back-to-back mirror effect. Decoupling the images (Cover using the wide
   photo `hero.jpg`, Hero using the portrait-focused `portrait.jpg`) is essential.
4. **CSS-Only Limitations**: Standardizing or forcing the layout solely via SCSS overrides within
   the existing `Hero.astro` HTML limits the semantic layout adjustments. A dedicated component
   allows for a cleaner, semantically rich editorial layout.

### Chosen Structural Approach

We will create a dedicated local component `EditorialMagazineHero.astro` under
`src/components/invitation/`. The main `Hero.astro` will conditionally delegate to it when
`variant === 'editorial-magazine'`. This:

- Keeps the core `Hero.astro` clean and regression-free for other themes.
- Allows the new hero to have a custom layout structure (split desktop, vertical museum frame on
  mobile, distinct folio metadata tracks, and an editorial deck).
- Preserves props compatibility.

### AI Image Generation Plan

To explore top-premium visual excellence, we will generate 2-4 candidate images using the
`generate_image` tool.

- **Reference**: Real Valentina client images (`hero.jpg`, `portrait.jpg`).
- **Safety Constraints**: Keep facial/body characteristics authentic, do not distort proportions, do
  not make her look older, do not add text/logos inside the image.
- **Output Drafts**: Save to `.agent/tmp/visual-explorations/valentina-hero/`.
- **Integration**: Document recommendations but do not overwrite production assets without explicit
  approval.

### Motion/Reveal Plan

- **T+0ms**: Cover wrapper exits upward (`translateY(0) -> translateY(-14%)`, opacity `1 -> 0`) over
  1200ms with `cubic-bezier(0.16, 1, 0.3, 1)`. The hero solid blush/paper background transitions to
  full opacity.
- **T+150ms**: Chapter concept label (`Capítulo XV`) and rule animate in (`translateY(10px) -> 0`,
  opacity `0 -> 1`) over 520ms.
- **T+300ms**: Dominant portrait frame slides up (`translateY(20px) -> 0`, opacity `0 -> 1`) over
  760ms.
- **T+450ms**: Typography (byline signature, editorial deck, folio metadata) enters
  (`translateY(14px) -> 0`, opacity `0 -> 1`) over 680ms.
- **T+1050ms**: Header suppress ends, sliding down smoothly.
- **Reduced Motion**: Skip all animations; show the final state immediately.

### Accessibility Requirements

- High-contrast text on blush paper background (exceeds WCAG 2.1 AA contrast ratios).
- Focus outlines preserved and visible.
- Screen readers read the content in standard semantic order.
- Respect `prefers-reduced-motion: reduce`.

### Validation Plan

- `pnpm lint` and `pnpm lint:styles:changed`
- `pnpm type-check`
- `pnpm build`
- `pnpm agent:git-safety:check`
- `pnpm agent:git-safety:end`

### Rollback Notes

- To revert, delete `EditorialMagazineHero.astro`, restore the modified styles and `Hero.astro`.

### Stop Conditions

- Stop if AI image generation fails to preserve Valentina's identity or distorts characteristics.
- Stop if git safety check reveals unexpected HEAD drift.

## Top Premium Art Direction Pass

### Current Visual Problems

1. **Cover Scrim Flattening**: The cover background image uses a heavy global brightness filter
   (`brightness(0.58)` and `brightness(0.62)`), which flattens the image tones and makes the cover
   look muddy or dark grey. We need localized gradients to keep text contrast while letting the
   image shine at higher brightness.
2. **Repeating Visual Hierarchy**: The cover and hero layouts mirror each other too closely with
   centered big uppercase text and similar photo weight. The hero must be transformed into an
   asymmetric, light-filled editorial spread.
3. **Typography & Shadows**: Heavy text-shadows on cover/hero names look dated. Contrast must be
   achieved through layout structure, local scrims, and negative space.
4. **Mobile Layout Cramping**: Mobile hero layout has small thumbnail-like images and narrow
   metadata columns. We need a proud single-column gallery art block with a horizontal metadata
   belt.

### Exact Implementation Scope

- Modify `src/components/invitation/EditorialCoverReveal.astro` to refine layout details and text
  copy.
- Modify `src/styles/invitation/_editorial-cover.scss` to remove cover text shadows, adjust CTA
  rules, and improve background overlay with localized gradients.
- Modify `src/styles/themes/sections/hero/_editorial-magazine.scss` to structure base asymmetry,
  adjust typography, and define the entrance animation choreography.
- Modify `src/styles/themes/sections/header/_editorial-magazine.scss` to ensure proper header
  suppression during the reveal phase.
- Modify `src/styles/themes/sections/_xv-valentina-hernandez.scss` to apply the specific
  blush/paper/charcoal palette, crop/focal point, and asymmetric layouts.

### Non-Goals

- No changes to schemas, database, payload, adapter, or asset registry.
- No addition of third global reveal states.
- No new third-party dependencies or animation libraries.

### Reveal/Motion Contract

- Only `opacity` and `transform` properties are animated. No layout-heavy property animation.
- A binary global reveal state is maintained: `data-reveal-state="sealed"` and
  `data-reveal-state="revealed"`.
- A local transition phase class/attribute `data-editorial-reveal-phase="revealing"` handles the
  exit/entrance synchronization.

### Accessibility Requirements

- Semantic HTML tags (`<button>`, `<header>`, etc.) must be preserved.
- `:focus-visible` styles must remain prominent and high-contrast.
- Respect `prefers-reduced-motion: reduce` by disabling transitions and showing the revealed state
  immediately.

### Acceptance Criteria

- Cover has no muddy global filters; uses localized charcoal gradients.
- Hero has no text shadows; is an asymmetric layout on desktop and single-column gallery layout on
  mobile.
- Header is hidden during revealing and delayed by at least 1.05s after revealing completes.
- No horizontal overflow at 390px or 414px mobile widths.

### Validation Plan

- Run `pnpm lint:styles:changed`, `pnpm type-check`, `pnpm build`, and tests.
- Verify visually on local dev server at 390px, 414px, and 1440px desktop width.

## Valentina Hero Editorial Upgrade Plan

### 1. Current-State Findings

- **Cover**: Uses `portrait.jpg` as the full-screen background with global `brightness(0.62)`
  filter, which flattens contrast. Has text-shadows on headers. CTA button is simple rule-based.
  Mobile version hides some cover lines.
- **Transition**: Governed by `ds-editorial-cover` custom element using
  `data-editorial-reveal-phase="revealing"`. The cover wrapper and container slide up and out of the
  viewport.
- **Hero**: Uses `hero.jpg` as background at 14% opacity multiply and `portrait.jpg` (repeating the
  cover image) as the portrait frame, creating a visual mirror effect.
- **Image Assets**: Low-resolution WhatsApp JPEGs (~60-80 KB). Duplicate usage of `portrait.jpg` on
  cover and hero portrait. Interludes use placeholder client photos with faces.
- **Motion/Header**: Header suppressed during opening. Header reveal is delayed by 1.05s after
  transition completes.
- **Accessibility/Reduced Motion**: Transitions are skipped immediately if
  `prefers-reduced-motion: reduce` is active. Focus outlines are visible.
- **Mobile (390px/414px)**: Single column with margins and details belt. No overflow.
- **Desktop (1440px)**: Two columns showing portrait and metadata.

### 2. Problem Diagnosis

- **Visual repetition**: Reusing `portrait.jpg` for both cover background and hero portrait destroys
  the editorial rhythm.
- **Text-shadow clutter**: Dated CSS text-shadows on names/brand look unrefined.
- **Global scrim muddying**: Darkening images globally with filters lowers contrast.
- **Prose lack**: The hero block lacks narrative prose or intro headings to separate it from the
  cover name stack.

### 3. Recommended Direction

"Cover as premium magazine jacket; Hero as first interior feature spread." Decouple assets: Cover
background uses `hero.jpg` (wide shot), hero portrait uses `portrait.jpg` (gallery frame). Hero
background is a solid blush paper surface. The name is styled as a quiet byline signature.

### 4. Implementation Options

- **Option 1: CSS-Only Refinement**: Refines colors/margins but cannot decouple cover and hero
  backgrounds since asset mapping is hardcoded. Quality ceiling is medium.
- **Option 2: Minimal Markup Extension & SCSS**: Prioritize `backgroundImage` over `portrait` on the
  cover in `EditorialCoverReveal.astro`. Decouples assets and allows asymmetric layout. High
  quality.
- **Option 3: New Hero Image / AI-Assisted Hero Asset plus Markup & SCSS (Recommended)**: Swaps
  asset mapping and integrates high-end AI exploratory drafts to prove top-premium quality. Highest
  quality.

### 5. Final Recommendation

Option 3 is recommended. We decoupling the image assets (Cover uses `hero.jpg`, Hero uses
`portrait.jpg`) and provide exploratory AI drafts to show editorial excellence.

### 6. Proposed File Scope

- `src/components/invitation/EditorialCoverReveal.astro`
- `src/styles/invitation/_editorial-cover.scss`
- `src/styles/themes/sections/hero/_editorial-magazine.scss`
- `src/styles/themes/sections/header/_editorial-magazine.scss`
- `src/styles/themes/sections/_xv-valentina-hernandez.scss`
- Safe draft image folder: `.agent/tmp/visual-explorations/valentina-hero/`

### 7. Non-Goals

No changes to schemas, database, production payload, routes, or other sections. No new dependencies.

### 8. Motion Plan

1. **T+0ms**: Cover slides up, hero background fades in to `opacity: 1` over 700ms.
2. **T+150ms**: Hero label and divider enter (`translateY(10px) -> 0`, opacity 0 -> 1) over 520ms.
3. **T+300ms**: Gallery-framed portrait enters (`translateY(20px) -> 0`, opacity 0 -> 1) over 760ms.
4. **T+450ms**: Byline and details enter (`translateY(14px) -> 0`, opacity 0 -> 1) over 680ms.
5. **T+1050ms**: Header slides down (`translateY(-0.45rem) -> 0`, opacity 0 -> 1) over 700ms.

### 9. Hero Composition Plan

- **Desktop**: Asymmetric layout with portrait frame on the left, name as quiet byline and details
  on the right with wide margins.
- **Mobile**: Single-column gallery layout with a proud vertical portrait, overlapping labels, and
  flex-wrap details.

### 10. AI Asset Plan

- Exploratory candidates generated based on client photos.
- Saved in `.agent/tmp/visual-explorations/valentina-hero/` as drafts:
  - `valentina_editorial_portrait.png` (Direction A)
  - `valentina_bg_texture.png` (Direction D)
- Checklist: Do not wire into production assets until client/human approval is received.

### 11. Accessibility Requirements

Semantic HTML preserved, focus visible, no keyboard trap, immediate reduced-motion path, cover
hidden after reveal.

### 12. Acceptance Criteria

Cover and hero use distinct images. No text shadows. Choreographed entry. Suppressed header. No
mobile overflow. Immediate reduced motion.

### 13. Validation Plan

- `pnpm lint:styles:changed`
- `pnpm type-check`
- `pnpm build`
- `pnpm test -- tests/unit/editorial-cover-reveal-contract.test.ts`
- `pnpm agent:git-safety:check`
- `pnpm agent:git-safety:end`
- Visual QA at 390px, 414px, and 1440px.

### 14. Stop Conditions

Stop if visual quality needs new client assets, or if git safety baseline drifts.
