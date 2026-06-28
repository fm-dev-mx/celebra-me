---
title: Editorial Reveal CTA & Responsive Plan — Valentina
status: draft
type: diagnostic
created: 2026-06-28
updated: 2026-06-28
autonomy: 'Level 0 — Report only. No changes of any kind.'
related_skills:
  - frontend-design
  - animation-motion
  - accessibility
  - theme-architecture
related_docs:
  - .agent/plans/active/valentina-premium-reveal-transition.spec.md
  - .agent/plans/active/editorial-magazine-theme.spec.md
  - .agent/plans/active/valentina-mobile-hero-full-bleed.spec.md
  - docs/domains/theme/typography.md
  - docs/domains/theme/architecture.md
---

# Editorial Reveal CTA & Responsive Plan — Valentina

## 1. Summary of Current Problems

### CTA Discoverability

- The current CTA label `ENTRAR A LA EDICIÓN` reads visually as editorial metadata or a section
  divider, not an interactive action.
- The CTA is styled as a transparent button with only top/bottom border rules — no background, no
  fill, no pill — making it indistinguishable from the metadata rows above.
- The icon is a down-chevron (`▾`), which visually signals "scroll down" or "accordion toggle", not
  "open invitation".
- The CTA sits in grid column 3 (right sidebar) of the editorial cover grid, visually isolated from
  the main content column.
- `min-height: 2.85rem` (~45.6px) falls below the WCAG-recommended 48px mobile tap target.
- Only the `<button>` element itself is tappable (`openButton` click listener, line 290); the
  wrapper is not clickable.

### Responsive Layout Failure

- The editorial-magazine variant sets `--ec-masthead-size: clamp(4.4rem, 15vw, 12rem)` and
  `--ec-headline-size: clamp(4.8rem, 14vw, 11rem)` — massive bounds.
- At 768px: masthead ≈ 115px, headline ≈ 108px → two rows occupy >220px vertical, leaving cramped
  space for photo visibility, CTA, metadata, framing.
- At 1024px: masthead ≈ 154px, headline ≈ 143px → the name block alone is ~300px; combined with
  masthead ≈ 500px.
- No intermediate breakpoints exist between `≤640px` (Valentina mobile) and full desktop; the
  640–992px range has no dedicated handling.
- The grid container uses `min-height: 100svh` — at wider viewports the masthead+name overflow their
  grid cells, overlap the portrait, or force the CTA/metadata out of the viewport.

---

## 2. Files Inspected

| File                                                              | Status                | Purpose                                                                     |
| ----------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `src/components/invitation/EditorialCoverReveal.astro`            | Read                  | Reveal component; owns CTA rendering and JS reveal state machine            |
| `src/styles/invitation/_editorial-cover.scss`                     | Read (883 lines)      | All cover layout, typography, CTA styles; base + editorial-magazine variant |
| `src/styles/themes/sections/_xv-valentina-hernandez.scss`         | Read (1869 lines)     | Valentina-scoped overrides; cover, hero, section-by-section                 |
| `src/styles/themes/sections/hero/_editorial-magazine.scss`        | Read (562 lines)      | Hero section variation for editorial-magazine preset                        |
| `src/styles/themes/presets/_editorial-magazine.scss`              | Read                  | Theme preset tokens (ink, paper, red, fonts, etc.)                          |
| `src/styles/global/_mixins.scss`                                  | Read                  | Mixin utilities (respond-to, respond-below, reduced-motion, short-viewport) |
| `src/styles/tokens/_spacing.scss`                                 | Read                  | `$breakpoints` (xs:480, sm:640, md:768, lg:992, xl:1200)                    |
| `src/pages/[eventType]/[slug].astro`                              | Read                  | Page route showing reveal rendering, `EditorialCoverReveal` integration     |
| `src/styles/themes/header/_editorial-magazine.scss`               | Referenced from plans | Header editorial-magazine SCSS                                              |
| `src/lib/invitation/page-data.ts`                                 | Read                  | Page context builder, envelope data construction                            |
| `tests/unit/editorial-cover-reveal-contract.test.ts`              | Read                  | Unit tests for reveal contract, CTA copy, choreography, text-shadow         |
| `tests/e2e/visual-qa-editorial-magazine.spec.ts`                  | Read                  | E2E visual QA test (mobile 430px only)                                      |
| `tests/e2e/valentina-face-audit.spec.ts`                          | Read                  | Face audit E2E across 7 viewports (360, 390, 430, 768, 1024, 1366, 1440)    |
| `.agent/plans/active/valentina-premium-reveal-transition.spec.md` | Read                  | Existing reveal transition spec — covers CTA, motion, cover exit            |
| `.agent/plans/active/editorial-magazine-theme.spec.md`            | Read                  | Theme SDD — covers editorial-magazine implementation baseline               |
| `.agent/plans/active/valentina-mobile-hero-full-bleed.spec.md`    | Read                  | Mobile hero full-bleed spec                                                 |

---

## 3. Existing Mixins / Tokens / Breakpoints Found

### Breakpoints (from `_spacing.scss`)

| Name | Value  | Mixin (min)      | Mixin (max)                   |
| ---- | ------ | ---------------- | ----------------------------- |
| xs   | 480px  | `respond-to(xs)` | `respond-below(xs)` = ≤479px  |
| sm   | 640px  | `respond-to(sm)` | `respond-below(sm)` = ≤639px  |
| md   | 768px  | `respond-to(md)` | `respond-below(md)` = ≤767px  |
| lg   | 992px  | `respond-to(lg)` | `respond-below(lg)` = ≤991px  |
| xl   | 1200px | `respond-to(xl)` | `respond-below(xl)` = ≤1199px |

### Mixins Available

- `respond-to($bp)` / `respond-below($bp)` — responsive min-width / max-width
- `reduced-motion` — `prefers-reduced-motion: reduce`
- `short-viewport` — `orientation: landscape` AND `height <= 500px`
- `corner-brackets($color, $size)` — decorative corner framing
- `typography($variant)` — uses `$authoring-scale` from typography tokens
- `focus-ring` / `focus-glow` — focus outline styles

### Available CSS Custom Property Patterns

- The project uses `clamp(min, preferred, max)` extensively for fluid typography.
- The editorial cover uses `--ec-*` custom properties (masthead-size, headline-size, etc.) set on
  `.editorial-cover-wrapper`.
- Valentina overrides these via `[data-variant='editorial-magazine']` scoping.
- Theme tokens use `--editorial-magazine-*` and `--v-*` (Valentina-specific) tokens.

### Existing Test Coverage

- `editorial-cover-reveal-contract.test.ts` — unit tests for: local reveal phase, guard activation,
  CTA copy (`ENTRAR A LA EDICIÓN`), styling of revealing phase, choreography timing/easing, no
  text-shadow.
- `valentina-face-audit.spec.ts` — E2E screenshots at 7 viewports covering cover+hero+sections.
- `visual-qa-editorial-magazine.spec.ts` — E2E screenshots at 430px mobile.

---

## 4. Root-Cause Analysis: CTA Issue

### 4.1 Visual Design of CTA

```scss
// _editorial-cover.scss:409-431
.editorial-cover__cta {
  display: inline-flex;
  // ...
  min-height: 2.85rem;
  padding: 0.72rem 0;
  border: 0;
  border-top: 1px solid var(--ec-rule); // ← matches metadata row border
  border-bottom: 1px solid var(--ec-rule); // ← matches metadata row border
  background: transparent; // ← no background fill
  color: var(--ec-accent-strong);
  font-size: var(--ec-cta-font-size); // ← same size as metadata
  font-weight: 800;
  letter-spacing: 0.2em; // ← same letter-spacing as metadata
  // ...
}
```

The CTA is intentionally editorial (transparent, border-rules). But this makes it **visually
identical** to the surrounding metadata rows (issue metadata in `.editorial-cover__metadata` lines
226-256, details in `.editorial-cover__details` lines 335-367). A user scanning the cover sees three
bordered rows: edition data, event date/venue, and the CTA — all with the same border treatment,
typography scale, and letter-spacing. The CTA does not visually "pop" as the primary action.

### 4.2 Down Chevron Icon

```astro
<svg class="editorial-cover__cta-icon" ...>
  <path d="m6 9 6 6 6-6"></path>
</svg>
```

Down chevrons in web UI are strongly associated with: accordion toggles, dropdown menus, and "scroll
down" hints. This contradicts the reveal intent (it opens the full invitation, not a dropdown).

### 4.3 Grid Positioning

The CTA sits in column 3 of the cover grid (`.editorial-cover__action { grid-column: 3 }`), the same
column that holds the issue metadata sidebar (VOL./NÚM./EDICIÓN). This visual proximity reinforces
the "metadata row" reading.

### 4.4 Tap Target

`min-height: 2.85rem` ≈ 45.6px at 16px base — below the 48px WCAG 2.5.5 minimum tap target (though
exempted for inline text when the target is within a sentence, which this is not).

### 4.5 Interaction Scope

Only the `<button>` has click listener (line 290), not the wrapper. `event.stopPropagation()`
prevents any parent handler. The cover wrapper itself (`<ds-editorial-cover>`) is not tappable.

---

## 5. Root-Cause Analysis: Responsive Issue

### 5.1 Typography Scaling

The primary driver of the responsive failure is the editorial-magazine variant's typography bounds:

```scss
// _editorial-cover.scss:830-831
--ec-masthead-size: clamp(4.4rem, 15vw, 12rem);
--ec-headline-size: clamp(4.8rem, 14vw, 11rem);
```

**Growth across viewports:** | Viewport | 15vw → masthead | 14vw → headline | Combined vertical
(approx) | |----------|-----------------|------------------|---------------------------| | 390px |
58.5px | 54.6px | ~113px | | 640px | 96px | 89.6px | ~186px | | 768px | 115.2px | 107.5px | ~223px |
| 840px | 126px | 117.6px | ~244px | | 995px | 149.3px | 139.3px | ~289px | | 1024px | 153.6px |
143.4px | ~297px | | 1200px | 180px | 168px | ~348px | | 1280px | 192px (clamped by 12rem) | 179.2px
| ~371px | | 1440px | 192px (clamped by 12rem) | 201.6px | ~394px |

At 768–1024px, the CELEBRA·ME masthead + VALENTINA HERNANDEZ headline consume 223–297px of vertical
space, leaving ~400–600px for the photo, CTA, metadata, framing borders, and grain overlay. This
causes:

1. **Photo vertical squeeze**: The background image is pushed down or cropped away from Valentina's
   face.
2. **CTA push-out**: The grid may overflow its `100svh` container, pushing the CTA below the fold or
   hidden behind `overflow: hidden`.
3. **Hierarchy collapse**: The massive typography dominates the frame, destroying the premium
   editorial composition.

### 5.2 Missing Intermediate Breakpoints

The current responsive architecture has **three layers** with a critical gap:

| Layer                         | Viewport Range                           | File                                           |
| ----------------------------- | ---------------------------------------- | ---------------------------------------------- |
| Valentina mobile overrides    | ≤640px                                   | `_xv-valentina-hernandez.scss` (lines 131-178) |
| Base editor-magazine variant  | All widths (no intermediate constraints) | `_editorial-cover.scss` (lines 817-883)        |
| Editorial cover mobile layout | ≤639px (respond-below sm)                | `_editorial-cover.scss` (lines 635-760)        |

The editorial-cover `respond-below(sm)` block (lines 635-760) restructures the grid to single-column
at ≤639px. But the Valentina mobile overrides at ≤640px change typography CSS variables that apply
**only within** `[data-variant='editorial-magazine']`. These don't use the mixin system but raw
`@media (width <= 640px)`.

**The gap is 640px–991px**: Above 640px, the Valentina mobile typography overrides stop, but the
editorial-cover grid hasn't reverted to desktop layout yet (the grid layout override is ≤639px via
`respond-below(sm)`). At 640-767px, the grid is still mobile (single-column, from the sm media
query) but the typography jumps from Valentina's `clamp(2.25rem, 9.8vw, 3.35rem)` masthead and
`clamp(3.05rem, 13.2vw, 4.55rem)` headline, to the base editorial-magazine values of
`clamp(4.4rem, 15vw, 12rem)` and `clamp(4.8rem, 14vw, 11rem)`.

This creates a **sharp 2x+ typography jump** at 641px.

### 5.3 Grid and Aspect Ratio

The `.editorial-cover-container` uses:

```scss
grid-template-rows: auto minmax(0, 1fr) auto auto;
grid-template-columns: minmax(clamp(1rem, 5vw, 4rem), 0.55fr) minmax(0, 1.55fr) minmax(
    6.5rem,
    0.58fr
  );
```

The `minmax(0, 1fr)` middle row is supposed to grow/shrink with content, but the massive
headline+cover-lines can push beyond the available vertical space (especially on shorter viewports
or wider screens where typography grows aggressively).

### 5.4 Background Image Visibility

The `.editorial-cover__background` has
`filter: grayscale(0.06) saturate(0.94) contrast(1.02) brightness(0.85)` (Valentina override) and
uses `object-position: var(--cover-focal-point-mobile, var(--cover-focal-point, center))` — but at
intermediate widths, the object-position may crop Valentina's face as the typography pushes content
and the aspect ratio changes.

---

## 6. Proposed Implementation Strategy

### Phase 1: CTA Clarity (high priority, isolated change)

1. **Replace CTA label**
   - Change `ctaText` from `'ENTRAR A LA EDICIÓN'` to `'ABRIR INVITACIÓN'` when `coverEdition` is
     present.
   - Keep `'DESCUBRIR'` as fallback for non-edition covers.
   - Update unit test that asserts `ENTRAR A LA EDICIÓN` (line 29 in contract test).

2. **Replace CTA icon**
   - Replace the down-chevron SVG with a right-arrow (→) or an open-book/reveal icon.
   - The SVG should be a simple arrow-right path: `M5 12h14M12 5l7 7-7 7`.
   - Remove the `hover` transform `translateY(2px)` that moves the icon down (line 503,
     `_editorial-cover.scss`).

3. **Increase CTA visual weight**
   - Add an optional restrained background fill at the editorial-magazine variant level (e.g.,
     `rgba(255 255 255 / 8%)` with `backdrop-filter: blur(4px)`).
   - OR: increase the accent-rule emphasis: make the top border thicker (2px) and more opaque.
   - OR: add a subtle horizontal glow/pulse on the bottom border that triggers once on page load
     (CSS animation, respects reduced-motion).
   - Preferred: `background: rgb(255 255 255 / 6%)` + `backdrop-filter: blur(4px)` — keeps editorial
     feel but provides a subtle visual differentiation from metadata rows.

4. **Increase tap target**
   - Change `min-height: 2.85rem` → `min-height: 3rem` (48px).

5. **Consider making the cover wrapper tappable**
   - Add click handler to `<ds-editorial-cover>` element that delegates to the same reveal logic.
   - The CTA button remains as the secondary activation point.
   - This makes the entire cover a tap target (common magazine UX: "tap anywhere to open").

6. **Optional attention cue**
   - A very restrained shimmer or pulse on the CTA bottom border:
     `animation: ctaPulse 3s ease-in-out infinite` with opacity oscillation between 60%–100%.
   - Must wrap in `@media (prefers-reduced-motion: no-preference)`.

### Phase 2: Responsive Typography (medium priority)

1. **Add tablet/intermediate typography breakpoints**
   - In `_editorial-cover.scss`, within the `[data-variant='editorial-magazine']` block, add:

   ```scss
   @media (width >= 641px) and (width <= 991px) {
     --ec-masthead-size: clamp(2.8rem, 6.5vw, 4.4rem);
     --ec-headline-size: clamp(3.2rem, 7.5vw, 5.2rem);
   }
   ```
   - This prevents the sharp jump and keeps typography proportional on tablets.

2. **Tighten the Valentina mobile override**
   - The Valentina `≤640px` block already handles mobile well. Ensure the `--ec-*` variable
     overrides at ≤640px use more restrained max values:
   - `--ec-masthead-size: clamp(2rem, 8.5vw, 2.6rem)` — prevent 3rem+ on larger phones.
   - `--ec-headline-size: clamp(2.3rem, 11vw, 3.2rem)` — keep headline readable but not
     overwhelming.

3. **Add responsive masthead line-height**
   - At ≤640px: `line-height: 0.72` for masthead; at 641-991px: `line-height: 0.78`.

4. **Add Valentina-specific intermediate overrides**
   - In `_xv-valentina-hernandez.scss`, within the `[data-variant='editorial-magazine']` cover
     block, add override for intermediate widths:
   ```scss
   @media (width >= 641px) and (width <= 991px) {
     --ec-masthead-size: clamp(2.8rem, 6.5vw, 4rem);
     --ec-headline-size: clamp(3.2rem, 7.5vw, 4.8rem);
     .editorial-cover__cover-lines {
       display: none;
     }
     .editorial-cover__metadata {
       opacity: 62%;
     }
     .editorial-cover__footer {
       display: none;
     }
   }
   ```

### Phase 3: Cover Framing & Layout (medium priority)

1. **Review container grid column sizing at desktop breakpoints**
   - The current `grid-template-columns` uses
     `minmax(clamp(1rem, 5vw, 4rem), 0.55fr) minmax(0, 1.55fr) minmax(6.5rem, 0.58fr)`.
   - At widths > 1200px, the center column (1.55fr) and right column (0.58fr) may create too much
     horizontal space.
   - Add `max-width: min(1200px, 100%)` to `.editorial-cover-container` to prevent overstretching.

2. **Improve background image focal point across viewports**
   - Ensure `--cover-focal-point` and `--cover-focal-point-mobile` (passed from page data via
     `hero.focalPoint` / `hero.focalPointMobile`) are set for Valentina.
   - The Valentina payload has specific focal values; ensure they're used.

3. **Review inset frame positioning**
   - The `::before` pseudo-element on `.editorial-cover-container` uses
     `inset: clamp(1rem, 3vw, 2.35rem)`. At 768px this is ~23px inner margin, which is fine.
   - The wrapper `::before`/`::after` corner brackets use `clamp(1.25rem, 4vw, 3rem)`. At 768px:
     ~31px. These are the top-left/bottom-right corner decorations. They feel fine.

### Phase 4: Grid Structure for Wide Viewports

1. **Responsive grid reorganization**
   - At ≥992px (lg): Consider a more generous layout where the headline can use the full width and
     the metadata moves to a bottom rail.
   - The existing `respond-below(sm)` mobile layout collapses to single column. A complementary
     `respond-to(lg)` block could expand the headroom.

2. **Safe area padding**
   - Use `padding: clamp(...)` consistently: the existing `clamp(1.25rem, 4.5svh, 3.3rem)` for
     top-padding is good — use `svh` units to adapt to viewport height.

---

## 7. Exact Files Likely to Change

| File                                                      | What Changes                                                                                                                                                                                              | Priority |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `src/components/invitation/EditorialCoverReveal.astro`    | CTA text logic (line 48), CTA icon SVG (line 167), optional wrapper click handler                                                                                                                         | P0       |
| `src/styles/invitation/_editorial-cover.scss`             | CTA visual weight (lines 409-503), icon transform (line 503), min-height (line 416), editorial-magazine variant (lines 817-883), add intermediate breakpoint (lines 879-882 area), optional wrapper-hover | P0       |
| `src/styles/themes/sections/_xv-valentina-hernandez.scss` | Valentina-specific mobile typography overrides (lines 131-178), add intermediate breakpoint 641-991px                                                                                                     | P1       |
| `tests/unit/editorial-cover-reveal-contract.test.ts`      | Update CTA copy assertion (line 29)                                                                                                                                                                       | P0       |
| `tests/e2e/visual-qa-editorial-magazine.spec.ts`          | Add viewport coverage for 768px and 1024px                                                                                                                                                                | P2       |
| `tests/e2e/valentina-face-audit.spec.ts`                  | Already covers 7 viewports; may add CTA visibility assertions                                                                                                                                             | P2       |

---

## 8. Markup Changes Needed

### Yes — `EditorialCoverReveal.astro`

1. **Line 48**: Change the CTA text logic. The current logic
   `coverEdition ? 'ENTRAR A LA EDICIÓN' : 'DESCUBRIR'` must become
   `coverEdition ? 'ABRIR INVITACIÓN' : 'DESCUBRIR'`.

   Rationale: "ABRIR INVITACIÓN" is more action-oriented and unmistakably a CTA. "ENTRAR A LA
   EDICIÓN" reads like a chapter label. The existing plan spec (valentina-premium-reveal-transition)
   still references "ENTRAR A LA EDICIÓN" — this plan supersedes that text choice.

2. **Line 167–169**: Replace the down-chevron SVG with a right-arrow or open-icon:

   ```svg
   <path d="M5 12h14M12 5l7 7-7 7"/>
   ```

   This changes the visual cue from "scroll/expand" to "proceed/enter".

3. **Optional — Line 290+**: Add a click handler on `<ds-editorial-cover>` that activates the same
   reveal logic. This makes the full cover tappable.

### No — No new components needed

All changes can remain within the existing component structure.

---

## 9. Styling Can Remain Valentina-Scoped

Yes. The CTA styling changes and typography scaling changes can remain within:

- `_editorial-cover.scss` — for `[data-variant='editorial-magazine']` scoping (shared by all
  editorial-magazine invitations, not Valentina-specific)
- `_xv-valentina-hernandez.scss` — for Valentina-specific typography overrides and breakpoints

**Scope boundary**: Keep generic editorial-magazine improvements (CTA icon, visual weight, layout
max-width) in `_editorial-cover.scss`. Keep Valentina-specific typography clamp values and hide/show
decisions in `_xv-valentina-hernandez.scss`.

**Do not create new mixins.** All responsive patterns already exist via `respond-to`/`respond-below`
or raw `@media` queries consistent with the existing usage in these files.

---

## 10. Test and Validation Plan

### Pre-Implementation Validation

- [x] Git safety: `pnpm agent:git-safety:start` (done)
- [ ] Current build: `pnpm build` (run after plan approval, before implementation)

### Post-Implementation Validation

- [ ] `pnpm type-check` — Astro type check
- [ ] `pnpm lint` — ESLint
- [ ] `pnpm lint:styles:changed` — SCSS lint
- [ ] `pnpm test` — unit tests (especially `editorial-cover-reveal-contract.test.ts`)
- [ ] `pnpm build` — full production build
- [ ] `pnpm agent:git-safety:check` — verify no staged state drift
- [ ] `pnpm agent:git-safety:end` — close session

### Visual QA (requires `pnpm dev`)

- Navigate to `/xv/valentina-hernandez?forceEnvelope=true`
- Capture screenshots (or manual inspection) at:
  - 320×568 (small phone)
  - 360×740 (Android)
  - 390×844 (iPhone 14)
  - 430×932 (iPhone 15 Pro Max)
  - 640×960 (small tablet portrait)
  - 768×1024 (iPad portrait)
  - 834×1112 (iPad Pro portrait)
  - 995×768 (tablet landscape)
  - 1024×768 (iPad landscape)
  - 1280×800 (laptop)
  - 1440×900 (desktop)

### Verification Checklist

- [ ] CTA reads as "ABRIR INVITACIÓN" (not "ENTRAR A LA EDICIÓN")
- [ ] CTA icon is a right-arrow (not down-chevron)
- [ ] CTA has visible tap affordance (background or thicker rule)
- [ ] CTA tap target ≥ 48px (3rem)
- [ ] At 320–430px: cover feels premium, legible, tappable
- [ ] At 640–768px: no sharp typography jump, portrait visible
- [ ] At 995–1024px: masthead and name do not overflow or collide
- [ ] At 1280–1440px: cover is intentional, centered, not poster-like
- [ ] Valentina's face is visible and recognizable at all sizes
- [ ] No horizontal overflow at any tested size
- [ ] Full-cover tap (if implemented) triggers reveal
- [ ] Keyboard Tab → Enter/Space reveals the invitation
- [ ] Reduced-motion: no animations, immediate reveal

---

## 11. Accessibility Validation Plan

### Keyboard

- Tab navigates to `.editorial-cover__cta` button (already a `<button>`, test passes)
- Pressing Enter or Space on the CTA triggers `click` event → reveal (already works via native
  button behavior)
- If wrapper-tap is added: ensure it does not intercept keyboard events meant for other focusable
  elements inside the cover
- After reveal: focus moves to `#inicio` (already implemented in `completeReveal`, line 246-251)
- `focus-visible` outline on CTA must remain visible and high-contrast (already present at line
  469-474)

### Screen Reader

- `aria-label={microcopy}` on the CTA button (line 164) provides screen reader context — preserve
- The down-chevron SVG has `aria-hidden="true"` — preserve for the new icon
- Cover is a live region during reveal — no change needed
- After reveal: `this.hidden = true` removes cover from accessibility tree

### Touch Target

- Increase `min-height` to `3rem` (48px) — WCAG 2.5.5 minimum
- If wrapper-tap is added: ensure `.editorial-cover-wrapper` has `cursor: pointer` styling

### Motion

- `prefers-reduced-motion: reduce` is already handled:
  - In `_editorial-cover.scss` lines 601-633 (mixins.reduced-motion)
  - In component JS line 263:
    `const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)').matches;`
  - In component JS lines 305-308: immediate `completeReveal()` when motion reduced
- Any new shimmer/pulse animation must be wrapped in
  `@media (prefers-reduced-motion: no-preference)` or in the existing `reduced-motion` mixin with
  `animation: none; opacity: 100%;`

### Contrast

- CTA current colors: `color: var(--ec-accent-strong)` on transparent background over the cover
  image. For Valentina, `--ec-accent-strong: var(--v-white)` → white text on photo. If a subtle
  backdrop-filter or background is added, ensure it doesn't reduce contrast below WCAG AA.
- Pass (contrast is not degraded by current plan).

---

## 12. Risks and Rollback Notes

### Risks

1. **CTA over-design**: Adding too much visual weight (background fill, strong border) could cheapen
   the editorial aesthetic. Mitigation: start minimal (6% white bg + blur) and review before adding
   stronger cues.
2. **Wrapper tap interferes with interior buttons**: If the wrapper is made tappable, interior
   elements (metadata, selectable text) could accidentally activate reveal. Mitigation: Only fire
   wrapper click when the target is the wrapper itself or a non-interactive descendant (use
   `event.target.closest('button, a, input, [data-editorial-open]')` check).
3. **Typography changes affect other editorial-magazine covers**: The base `_editorial-cover.scss`
   changes touch the shared variant. Mitigation: Keep Valentina-specific overrides in
   `_xv-valentina-hernandez.scss`; the base changes should be generically safe.
4. **Intermediate breakpoint risks**: Adding a new `641px-991px` breakpoint creates a third
   responsive band. Ensure it doesn't conflict with existing `respond-below(md)` (≤767px) or
   `respond-below(sm)` (≤639px) blocks.
5. **Unit test failure**: The contract test asserts `ENTRAR A LA EDICIÓN` exists. Any text change
   will break this test — must be updated in the same pass.
6. **Build failure**: Test `pnpm build` after each phase to catch build errors early.

### Rollback Plan

- **Phase 1 (CTA)**: Revert `EditorialCoverReveal.astro` line 48 and SVG; revert
  `_editorial-cover.scss` CTA styles section (lines 409-503); revert test assertion.
- **Phase 2 (Typography)**: Revert `--ec-*` variable changes in `_editorial-cover.scss` lines
  830-831 and in `_xv-valentina-hernandez.scss` lines 131-133; remove added intermediate
  breakpoints.
- **Full rollback**:
  `git checkout -- src/components/invitation/EditorialCoverReveal.astro src/styles/invitation/_editorial-cover.scss src/styles/themes/sections/_xv-valentina-hernandez.scss tests/unit/editorial-cover-reveal-contract.test.ts`
- No database rollback required.
- Do not use destructive git commands automatically; revert changes via working-tree edits.

---

## 13. Acceptance Criteria

### Must Pass

- [ ] The CTA text reads `ABRIR INVITACIÓN` (or `DESCUBRIR` for non-edition covers).
- [ ] The CTA icon is a right-arrow or reveal icon (not a down-chevron).
- [ ] The CTA is visually distinct from the metadata rows above it (via background, border weight,
      or backdrop-filter).
- [ ] The CTA tap target is ≥48px (3rem).
- [ ] At 320–430px: the cover feels premium, legible, and the CTA is clearly tappable.
- [ ] At 640–768px: no sharp typography jump from mobile to larger sizes; the cover does not feel
      oversized.
- [ ] At 995–1024px: masthead and name do not overflow, collide, or push content off-screen.
- [ ] At 1280–1440px: the cover is visually intentional, centered, and not poster-like.
- [ ] Valentina's face remains visible and recognizable at all tested viewports.
- [ ] No horizontal overflow at any tested viewport width.
- [ ] Keyboard Tab → Enter/Space reveals the invitation correctly.
- [ ] Reduced-motion users get an immediate clean reveal (no animations).
- [ ] The global reveal state contract (`data-reveal-state=sealed→revealed`,
      `data-editorial-reveal-phase=revealing`) remains intact.
- [ ] `pnpm build` passes.
- [ ] `pnpm test` passes (all unit tests, including updated contract test).
- [ ] `pnpm lint` and `pnpm lint:styles:changed` pass.

### Should Pass

- [ ] Full wrapper tap (if implemented) reveals the invitation.
- [ ] Existing non-Valentina editorial-magazine covers (demos) are not visually regressed.
- [ ] CTA has a restrained, optional attention cue (pulse/shimmer) that respects
      `prefers-reduced-motion`.
- [ ] E2E tests (valentina-face-audit) capture CTA visibility at each viewport.

### Non-Goals

- No changes to the reveal state machine, binary state contract, or the hero section.
- No changes to database, content payloads, schemas, or adapters.
- No new dependencies, mixins, or CSS frameworks.
- No changes to `src/pages/[eventType]/[slug].astro` or the overall rendering architecture.
- No staging, committing, pushing, deploying, or production operations.

---

## Implementation Sequence (When Approved)

```
Phase 1: CTA changes
  1. Edit EditorialCoverReveal.astro (CTA text + icon)
  2. Edit _editorial-cover.scss (CTA visual weight + min-height)
  3. Edit editorial-cover-reveal-contract.test.ts (update assertion)
  4. Run pnpm test, pnpm lint, pnpm build

Phase 2: Responsive typography
  5. Edit _editorial-cover.scss (intermediate breakpoint for editorial-magazine variant)
  6. Edit _xv-valentina-hernandez.scss (tighten mobile + add intermediate breakpoint)
  7. Run pnpm build, pnpm lint:styles:changed

Phase 3: Visual polish
  8. Edit _editorial-cover.scss (grid max-width, container constraints)
  9. Run full validation suite
  10. Visual QA across all specified viewports
```
