---
title: Valentina Hernández XV — Section Transitions Visual Analysis
status: active
plan_type: analysis
autonomy_level: 0 — Read-only analysis; no implementation
created: 2026-06-27
updated: 2026-06-27
related_plans:
  - .agent/plans/active/valentina-premium-reveal-transition.spec.md
  - .agent/plans/active/valentina-editorial-accent-pass.spec.md
  - .agent/plans/active/editorial-magazine-theme.spec.md
  - .agent/plans/active/valentina-editorial-magazine-real-invitation.spec.md
related_rules:
  - .agent/rules/gatekeeper.md
  - docs/domains/theme/architecture.md
related_skills:
  - theme-architecture
  - frontend-design
  - animation-motion
---

# Valentina Hernández XV — Section Transitions Analysis

## 1. Current State

### 1.1 Section Order (rendered sequence)

The `/xv/valentina-hernandez` invitation renders components in this order from
`src/pages/[eventType]/[slug].astro`:

| Render position | Component                     | Background        | Section type         |
| --------------- | ----------------------------- | ----------------- | -------------------- |
| Overlay         | `EditorialCoverReveal.astro`  | Dark/ink gradient | Cover overlay        |
| Overlay         | `EventHeader.astro`           | Transparent→dark  | Fixed navigation     |
| Standalone      | `EditorialMagazineHero.astro` | Blush/paper       | Full-screen hero     |
| Section 1       | `Quote.astro`                 | Dark/ink          | Editorial quote      |
| Section 2       | `Family.astro`                | Blush/paper       | Family credits       |
| Section 3       | `Countdown.astro`             | White             | Countdown timer      |
| Section 4       | `Itinerary.astro`             | Blush/paper       | Program              |
| Section 5       | `EventLocation.astro`         | Blush/paper       | Venues + indications |
| Section 6       | `Gallery.astro`               | Blush/paper       | Photo spread         |
| Section 7       | `Gifts.astro`                 | Blush/paper       | Gift guide           |
| Section 8       | `PersonalizedAccess.astro`    | Blush/paper       | VIP credential       |
| Section 9       | `RSVP.tsx`                    | Dark/ink          | Confirmation form    |
| Section 10      | `ThankYou.astro`              | Dark/ink          | Closing / back cover |
| Footer          | `Footer.astro`                | Dark/ink          | Colophon / WhatsApp  |

Source: `sectionOrder` in `.agent/plans/active/xv-valentina-hernandez-db-payload.json` lines 16–27.

### 1.2 Components and SCSS Files Inspected

**Components (rendering layers):**

- `src/components/invitation/EditorialMagazineHero.astro` — 204 lines, standalone hero with folio
  header, portrait grid, credits
- `src/components/invitation/InvitationSections.astro` — 63 lines, section render loop via
  `buildInvitationSectionRenderDescriptors()`
- `src/pages/[eventType]/[slug].astro` — page layout, mounts Hero → InvitationSections → Footer

**Preset theme tokens:**

- `src/styles/themes/presets/_editorial-magazine.scss` — 123 lines, all CSS variables (ink, paper,
  white, red, muted, section sizes)

**Section-level SCSS files (all `data-variant='editorial-magazine'`):**

- `src/styles/themes/sections/hero/_editorial-magazine.scss` — 562 lines (hero layout, reveal
  animations, full-screen spread)
- `src/styles/themes/sections/quote/_editorial-magazine.scss` — 53 lines (dark bg, red accent rule,
  serif italic)
- `src/styles/themes/sections/countdown/_editorial-magazine.scss` — 93 lines (border-block edges,
  grid segments)
- `src/styles/themes/sections/family/_editorial-magazine.scss` — 185 lines (column layout, thin
  dividers)
- `src/styles/themes/sections/location/_editorial-magazine.scss` — 186 lines (venue cards, NOTA
  counters)
- `src/styles/themes/sections/gallery/_editorial-magazine.scss` — 141 lines (Fig. counter captions,
  spread grid)
- `src/styles/themes/sections/gifts/_editorial-magazine.scss` — 132 lines (flat catalog grid with
  border rules)
- `src/styles/themes/sections/rsvp/_editorial-magazine.scss` — 162 lines (dark bg, underline inputs,
  radio cards)
- `src/styles/themes/sections/thank-you/_editorial-magazine.scss` — 117 lines (dark back-cover,
  signature block)
- `src/styles/themes/sections/header/_editorial-magazine.scss` — 86 lines (fixed nav, reveal
  animation)
- `src/styles/themes/sections/footer/_editorial.scss` — 143 lines (dark bg, WhatsApp CTA)
- `src/styles/themes/sections/personalized-access/_editorial-magazine.scss` — 205 lines (barcode,
  credential card)

**Cover reveal:**

- `src/styles/invitation/_editorial-cover.scss` — 883 lines (cover overlay, reveal animation)

**Valentina-scoped overrides:**

- `src/styles/themes/sections/_xv-valentina-hernandez.scss` — 931 lines (blush/charcoal palette,
  section accents, editorial labels)

**Section rendering logic:**

- `src/lib/invitation/section-render-data.ts` — 385 lines, descriptor builder for InvitationSections

### 1.3 Existing Theme/Preset Hooks Available

**CSS variable system:** The editorial-magazine preset defines these key section-level tokens (from
`_editorial-magazine.scss`):

```scss
--section-padding-block: clamp(5rem, 13vw, 9rem);
--section-card-radius: 0;
--section-card-border: 1px solid rgb(var(--editorial-magazine-ink-rgb) / 88%);
--section-title-font: var(--font-display);
--section-title-size: clamp(3.2rem, 10vw, 8.5rem);
```

**Section-specific hooks (CSS variables scoped per section):**

- `--countdown-bg`, `--countdown-title-color`, `--countdown-value-color`
- `--family-bg`, `--family-text-primary`, `--family-image-filter`
- `--location-bg`, `--location-card-bg`
- `--gifts-bg`, `--gifts-title-color`
- `--rsvp-bg`
- `--quote-bg`, `--quote-text-color`
- Plus `--hero-*` variables

**Wrapper and attribute hooks:**

- Each section renders inside `<div class="invitation-section-wrapper">` in
  `InvitationSections.astro`
- The wrapper has `data-section-id="section-{index}-{component}"` and `data-after-interlude`
  attributes
- Hero uses `data-variant="editorial-magazine"`
- Section components use `data-variant` matching the section variant
- The theme wrapper has `data-reveal-state` (sealed/revealed) and `data-editorial-reveal-phase`

**Important: There is NO existing section transition mechanism.** The `invitation-section-wrapper`
has zero transition/dividing styling. Sections stack directly with nothing between them except their
natural `padding-block`.

**Pseudo-element editorial labels already present** (from Valentina overrides):

- Gallery header `::after`: `'DESLIZAR EDICIÓN ──›'` (mobile)
- Gallery `::before`: `'COLECCIÓN DE RETRATOS / EDICIÓN XV'`
- Family `::before`: `'CRÉDITOS DE FAMILIA / EDICIÓN XV'`
- Location `::before`: `'CRÓNICA Y LOGÍSTICA / EDICIÓN XV'`
- Gifts `::before`: `'GUÍA DE REGALOS / SUGERENCIAS'`
- RSVP `::before`: `'CONFIRMACIÓN DE ASISTENCIA / R.S.V.P.'`
- Footer `::after`: `'EDICIÓN XV — MMXXVI'`
- Family header `::before` (internal): `'N.º 02'`

### 1.4 Existing Valentina-Specific Overrides Summary

The `_xv-valentina-hernandez.scss` file (931 lines) already handles:

- Remapping editorial-magazine tokens to pink/blush/charcoal/silver palette
- Cover reveal overrides (background gradients, CTA, typography)
- Hero full override (background texture, portrait sizing, colors, mobile layout)
- Family section accents (chapter mark `N.º 02`, message border-left)
- Itinerary editorial counters (01, 02, 03... with accent color)
- Location venue card polish and indications styling
- Gallery scrollable carousel with accent scrollbar
- Gifts card styling with blush gradient
- RSVP outline frame and editorial label
- Footer colophon (`EDICIÓN XV — MMXXVI`)
- Responsive adjustments at 480px and below

**What is NOT present:** Any section divider, clip-path, SVG transition, or overlapping panel
mechanism.

---

## 2. Visual Findings

### 2.1 Section-by-Section Critique

#### Cover → Hero (already handled)

- **Status:** Currently the strongest transition. The editorial cover reveal handles this with the
  wrapper-upward animation, timed choreography of hero elements, and staged entrance.
- **Verdict:** Do not modify. Already refined per `valentina-premium-reveal-transition.spec.md`.

#### Hero → Quote ⚠️ **MOST ABRUPT**

- **Current behavior:** Hero spans full viewport with blush/paper background. At its bottom, the
  hero simply ends — the user must scroll to reveal the quote section. Quote starts with a solid
  dark/ink background (`--editorial-magazine-ink`) and a red accent rule
  (`::before { background: var(--editorial-magazine-red) }`).
- **Problem:** The transition from light/blush full-screen hero to solid black quote is jarring. No
  visual cue bridges the two sections. The hero's `::before` border (white internal frame) ends at
  the hero boundary. Quote's dark background appears suddenly as the user scrolls.
- **Abruptness rating:** 9/10 — highest priority.
- **Improvement opportunity:** Strong candidate for `editorial-cut` (subtle diagonal or asymmetric
  ending on the hero) or `thin-rule-transition` (a fine editorial separator that acknowledges the
  background shift). A `layered-panel` where the quote section slightly overlaps the hero could work
  but risks overlapping the hero content.

#### Quote → Family ⚠️ **SECOND MOST ABRUPT**

- **Current behavior:** Quote ends with dark/ink background. Family starts with blush/paper
  (`--editorial-magazine-paper` mapped to blush for Valentina). The red accent rule at the top of
  the quote section (`::before { width: 3.5rem; height: 2px; }`) is an opening gesture, not a
  closing one.
- **Problem:** The dark-to-light shift is as abrupt as hero→quote but in reverse. Quote has no
  bottom transition or closing gesture. The family section's light appearance after the intense dark
  quote is disorienting.
- **Abruptness rating:** 8/10 — second priority.
- **Improvement opportunity:** Good candidate for `layered-panel` — the quote's dark background
  could extend slightly into the next section, creating a paper-overlay effect. Alternatively,
  `editorial-cut` on the quote bottom edge.

#### Family → Countdown

- **Current behavior:** Both light/paper backgrounds. Family has editorial `N.º 02` chapter mark.
  Countdown has explicit `border-block: 1px solid rgb(var(--editorial-magazine-ink-rgb) / 22%)`.
- **Problem:** The countdown's `border-block` creates a visible border between the two sections that
  feels unintended. The family section ends with a `border-bottom: 1px solid` on its last
  `.family__group` and then the countdown adds another border. This creates a double-line visual.
  The gap between sections is just natural padding.
- **Abruptness rating:** 5/10 — medium. The border overlap creates unintended visual noise.
- **Improvement opportunity:** `thin-rule-transition` could unify the boundary cleanly.
  Alternatively, remove the countdown's `border-block` and use a cleaner editorial separator.

#### Countdown → Itinerary

- **Current behavior:** Countdown has both `border-block` (top and bottom). Itinerary uses
  light/paper background with the `editorial` variant (not `editorial-magazine` — no dedicated SCSS
  file exists for `_editorial-magazine.scss` under itinerary).
- **Problem:** The countdown's bottom border creates a framed box effect, then the itinerary section
  starts fresh with its own padding. The transition feels like two independent widgets rather than a
  flowing editorial publication.
- **Abruptness rating:** 4/10 — moderate. The countdown's framed appearance actually makes it feel
  contained, which is better than a full blend, but the itinerary's lack of editorial integration
  weakens the flow.
- **Improvement opportunity:** Consider whether this boundary needs a transition at all. The
  countdown's self-contained frame may be acceptable. If changed, use `thin-rule-transition` to
  separate cleanly.

#### Itinerary → Location

- **Current behavior:** Both light/paper sections with no visual divider. Itinerary uses
  `_editorial.scss` which carries different styling cues. Location uses `_editorial-magazine.scss`
  properly.
- **Problem:** These sections visually blend together with no separation. The itinerary title and
  location cards touch the same white/blush background without any visual boundary.
- **Abruptness rating:** 3/10 — low-medium. The blend is not harmful but creates a generic
  stacked-template feel.
- **Improvement opportunity:** Optional. A `thin-rule-transition` would help differentiate these
  sections editorially.

#### Location → Gallery

- **Current behavior:** Both light/paper sections. Location ends with indication items (thin
  bordered list items). Gallery starts with its header (eyebrow + title + Fig. counter).
- **Problem:** These blend together completely. The location indications' last border item is
  followed by the gallery header with no visual separation.
- **Abruptness rating:** 3/10 — same as itinerary→location.
- **Improvement opportunity:** Low priority. The gallery's editorial label
  (`COLECCIÓN DE RETRATOS / EDICIÓN XV` via `::before`) serves as a weak divider.

#### Gallery → Gifts

- **Current behavior:** Gallery (light/paper, horizontal scroll on mobile) → Gifts (light/paper,
  grid layout).
- **Problem:** No visual separation. The gallery's scrollable carousel on mobile makes this boundary
  feel even more abrupt because the scroll interaction stops and the gifts grid starts.
- **Abruptness rating:** 4/10 — moderate on mobile due to interaction mode shift.
- **Improvement opportunity:** Low priority. The gifts editorial label
  (`GUÍA DE REGALOS / SUGERENCIAS`) helps some.

#### Gifts → PersonalizedAccess

- **Current behavior:** Gifts (light/paper) → PersonalizedAccess (light/paper with `::before` top
  rule: `height: 1px; width: min(20rem, 80%)` centered).
- **Problem:** The PA's built-in top rule helps create a visual boundary. However, the rule is very
  thin (1px) and centered (not full-width), which feels like a weak editorial separator.
- **Abruptness rating:** 3/10 — PA's top rule provides some separation already.
- **Improvement opportunity:** The existing `::before` rule could be extended or enhanced. Low
  priority.

#### PersonalizedAccess → RSVP ⚠️ **NOTABLE CONTRAST SHIFT**

- **Current behavior:** PersonalizedAccess (light/paper with thin rule) → RSVP (dark/ink background,
  `outline` frame in Valentina override).
- **Problem:** The contrast shift from light to dark is sudden. No transition bridges it. The PA
  section's thin rule at top is not echoed at the bottom.
- **Abruptness rating:** 7/10 — high. The dark RSVP is the second major dark section. It appears
  after 6 consecutive light sections, so the shift is dramatic.
- **Improvement opportunity:** Strong candidate for `layered-panel` where the PA section's
  background subtly overlaps into the RSVP boundary. Or an `editorial-cut` at the PA bottom.

#### RSVP → ThankYou

- **Current behavior:** Both dark/ink backgrounds. RSVP uses `--rsvp-bg: var(--v-ink)`. ThankYou
  uses `background: var(--editorial-magazine-ink)`.
- **Problem:** These visually blend together. The RSVP form area ends, then the ThankYou section
  starts with the same dark background. No visual separation.
- **Abruptness rating:** 2/10 — low. The dark continuity actually works editorially — it creates a
  "closing pages" feeling.
- **Improvement opportunity:** Do NOT add a transition here. The continuity is desirable for the
  closing sequence.

#### ThankYou → Footer

- **Current behavior:** Both dark/ink backgrounds. Footer has
  `border-top: 1px solid rgb(var(--color-action-accent-rgb) / 40%)` with a subtle gradient.
- **Problem:** The ThankYou and Footer are right next to each other with the same dark background.
  The only visual cue is the footer's accent border-top and its `box-shadow`.
- **Abruptness rating:** 3/10 — low. The closing sequence can be cohesive. The accent border already
  provides some separation.
- **Improvement opportunity:** Consider whether the `thin-rule-transition` could make the colophon
  feel more deliberate. Low priority.

### 2.2 White/Blank Space Assessment

- **Padding between sections** is handled uniformly via
  `--section-padding-block: clamp(5rem, 13vw, 9rem)`. This creates consistent vertical breathing
  room.
- **The hero has no bottom padding** — it's full-viewport, which means there's zero transition space
  between hero and quote.
- **Countdown has `border-block`** which adds 1px lines at its top and bottom, creating unintended
  visual interruptions within the padding zone.
- **All light sections** (family through gifts) use the same paper background, which causes them to
  visually merge into one continuous block with only typography changes as boundaries.
- **Mobile:** On narrow viewports, the `padding-block: clamp(5rem, 13vw, 9rem)` scales down but
  remains generous. The visual blending is more apparent on mobile where less screen real estate
  means fewer cues per viewport.

### 2.3 Strong Areas (Do NOT Touch)

- **Cover → Hero transition:** Already refined, editorial-grade. Leave as-is.
- **Quote section interior:** The red accent rule and italic serif typography are strong editorial
  gestures.
- **Countdown self-contained frame:** The bordered box works well as a contained editorial module.
- **RSVP interior styling:** The outline frame and editorial label are well-executed.
- **ThankYou dark back-cover feel:** The drop-cap, calligraphy signature, and dark background read
  as a deliberate closing page.
- **Footer colophon:** The `EDICIÓN XV — MMXXVI` accent is well-placed.
- **Hero internal border frame:** The `::before` white-border inset is a strong editorial detail. Do
  NOT extend it beyond the hero boundary.

### 2.4 Where Adding Transitions Would Improve Premium Perception

1. **Hero → Quote** (high priority): Adds editorial page-turn feel
2. **Quote → Family** (high priority): Prevents dark-to-light whiplash
3. **Light sections (Family through Gifts)** (medium priority): Creates rhythm in an otherwise
   uniform light block
4. **RSVP entry** (medium priority): Makes the CTA feel more intentional
5. **Closing sequence (ThankYou → Footer)** (low priority): Optional colophon refinement

### 2.5 Where Adding Transitions Would Create Visual Noise

- **Between every section** — would create a decorative template feel, exactly what we want to avoid
- **RSVP → ThankYou** — the dark continuity is editorially valuable as-is
- **Within the dark closing sequence** — adding dividers inside the closing pages would fragment the
  back-cover effect
- **After the footer** — no section follows, irrelevant

---

## 3. Recommended Transition Map

### 3.1 Technique Definitions

Each recommended technique is defined in practical implementation terms:

**`thin-rule-transition`**

- Implementation: A full-width `1px` hairline border with `14–22%` opacity of `--v-ink-rgb` or
  `--v-white-rgb` (for dark sections), placed either as `::after` on the preceding section or as
  `border-top` on the wrapper.
- CSS-only: Yes — `::before` or `::after` on `invitation-section-wrapper`.
- Theme-scoped via Valentina override or editorial-magazine base.
- Mobile-first: Scales naturally within existing padding.
- No schema changes needed.
- Vercel/build-safe: Pure CSS, no imports.

**`editorial-cut`**

- Implementation: A subtle diagonal or asymmetric section ending using `clip-path: polygon(...)` on
  the section container or a `::before` overlay element that creates a bevel cut. The cut angle
  should be very shallow (max 2–3° or ~8–12px vertical displacement) to avoid feeling decorative.
- CSS-only: Yes — `clip-path` property. Must include `clip-path` value that keeps all content
  visible.
- Must be scoped to the section wrapper, not the inner content wrapper, to avoid clipping text.
- Mobile-first: On narrow viewports, reduce or remove the cut displacement to preserve vertical
  space.
- Risk: `clip-path` with `section-padding-block` can create overflow issues. Requires
  `overflow: hidden` on parent.
- No schema changes needed.
- Safety: Must not clip important content at any breakpoint.

**`layered-panel`**

- Implementation: The preceding section ends with `margin-bottom: -Xrem` (negative margin) and the
  following section starts with a `::before` panel that overlays the gap. The panel surface uses
  `background: var(--v-paper)` or `var(--v-white)` with a subtle `box-shadow` to create a
  paper-over-paper effect.
- CSS-only: Yes. Use `position: relative` and `z-index` layering on the wrapper elements.
- Mobile-first: The overlap amount must be smaller on mobile (`1–1.5rem` vs `2–3rem` desktop).
- Risk: Negative margins can cause layout shifts if not carefully contained. Must test at all
  breakpoints.
- No schema changes needed.
- Safety: Must not cause content overlap or z-index stacking issues with headers/footers.

**`photo-mask-transition`**

- Implementation: Not recommended for this pass. It would require the interlude image to bleed into
  a section boundary, which is more complex and may not improve the editorial feel. Deferred to
  future analysis.

**`soft-arc`**

- Implementation: SVG `<path>` with a shallow bezier curve (~4–8px max sagitta) used as a section
  divider via CSS `background-image` or inline SVG. Creates a subtle undulation between sections.
- CSS-only: Yes (data URI SVG). Or inline SVG via Astro component (acceptable for editorial-magazine
  if scoped).
- Must be very subtle — a wave of max 8px amplitude, not a decorative flourish.
- Risk: Overuse creates the romantic/wedding-template look we must avoid.
- Use ONLY at the hero→quote boundary if `editorial-cut` proves too aggressive.
- No schema changes needed.

**`layered-wave`** ❌ **EXCLUDED**

- Not recommended. While waves are popular in wedding templates, they directly contradict the
  editorial fashion direction. A hard no unless the analysis overwhelmingly justifies it — it does
  not.

### 3.2 Recommended Transition Table

| Boundary                                                    | Recommended technique                                                                                         | Reason                                                                                                                                                                                                                                                                                                                                                                   | Risk                                                                                                                                                                              | Priority |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **Hero → Quote**                                            | `editorial-cut` (primary) or `layered-panel` (fallback)                                                       | The hero is full-viewport with no bottom transition zone. A subtle diagonal cut at the hero bottom would create an editorial page-turn effect. The quote's dark background will visually "slide in" behind the cut. An `editorial-cut` with `clip-path: polygon(0 0, 100% 0, 100% calc(100% - 1.25rem), 0 100%)` on the hero section would create an asymmetric bevel.   | **MEDIUM** — `clip-path` must not clip hero content; hero is currently `min-height: 100svh`. Must clip only the container, not inner text. Mobile: reduce or zero the cut offset. | **P1**   |
| **Quote → Family**                                          | `layered-panel`                                                                                               | The dark quote ends abruptly and the light family starts. A `layered-panel` where the quote's dark background extends `2.5rem` into the family section, with the family paper surface appearing as an overlaid card, creates a paper-stack editorial feel. The quote section gets `margin-bottom: -2.5rem` and the family wrapper gets `position: relative; z-index: 2`. | **MEDIUM** — Negative margin risks layout oscillation with long content. Must set `overflow: hidden` on the theme wrapper and test with both short and long quote text.           | **P1**   |
| **Family → Countdown ⚡**                                   | `thin-rule-transition` (remove countdown's `border-block` and replace with a single clean separator)          | Currently the countdown's `border-block` creates a double-line visual where family's last group border meets countdown's top border. Replace countdown `border-block: 1px solid` with a single `::after` rule on the family wrapper (or `::before` on countdown wrapper) for a clean editorial separation.                                                               | **LOW** — Removes existing noise. The countdown still has `border: 1px solid` on its timer grid for internal structure.                                                           | **P2**   |
| **Light sections (Itinerary → Location → Gallery → Gifts)** | Optional — consider `thin-rule-transition` only on **one** boundary (recommended: Gifts → PersonalizedAccess) | These sections all share the same blush/paper background. Adding dividers between each would create a generic template feel. However, one well-placed separator before the PA section creates a "new chapter" feel before the RSVP sequence. The PA already has a thin `::before` rule — this can be extended/refined.                                                   | **LOW** — Enhancing an existing rule is low-risk.                                                                                                                                 | **P3**   |
| **PersonalizedAccess → RSVP**                               | `layered-panel` (enhanced)                                                                                    | PA (light) → RSVP (dark) is a strong contrast shift. A layered panel where the PA's paper surface extends `1.5rem` below, over the dark RSVP background, creates a deliberate "card insertion" feel before the functional CTA area.                                                                                                                                      | **LOW-MEDIUM** — The PA section already uses `position: relative` and has a `::before` rule. Extending with negative margin is manageable. Must not overlap the RSVP content.     | **P2**   |
| **RSVP → ThankYou**                                         | ❌ **NO TRANSITION**                                                                                          | Both dark backgrounds. The continuity creates a natural editorial closing sequence (RSVP insert → closing back cover). Adding a divider would fragment this.                                                                                                                                                                                                             | N/A — excluded                                                                                                                                                                    | —        |
| **ThankYou → Footer**                                       | `thin-rule-transition` (optional refinement)                                                                  | The footer's existing `border-top` already provides separation. Replace the footer `border-top` with a thinner, more editorial rule (`1px solid rgb(var(--v-accent-rgb) / 28%)`) and remove the heavy `box-shadow`. This is already partially planned in the editorial accent pass.                                                                                      | **LOW** — Refinement of existing styling.                                                                                                                                         | **P4**   |

### 3.3 Summary of Section Visual Map

```
Cover ──→ Hero ──→ Quote ──→ Family ──→ Countdown ──→ Itinerary ──→ Location ──→ Gallery ──→ Gifts ──→ PA ──→ RSVP ──→ ThankYou ──→ Footer
         ✓refined  ✂ editorial-cut  📄 layered-panel  ─ thin-rule  (no change)  (no change)  (no change)  (no change)  ─ thin-rule  📄 layered-panel  (skip—dark continuity)  ─ thin-rule (optional)
```

Legend: ✓ = already refined, ✂ = editorial-cut, 📄 = layered-panel, ─ = thin-rule-transition

**Total transitions added:** 2–4 (boundaries 2, 3, optionally 9, optionally 12). **Total transitions
skipped:** 7 boundaries deliberately left as-is. **Result:** Sparing, targeted, premium editorial
pacing.

---

## 4. Technique Implementation Specifications

### 4.1 `editorial-cut` — Hero → Quote

```scss
// Applied to .invitation-hero[data-variant='editorial-magazine']
// Creates a subtle diagonal bevel at the bottom of the hero section
.invitation-hero[data-variant='editorial-magazine'] {
  // Add a bottom clip that creates editorial asymmetry
  // The cut rises 0.75rem on the right side, creating a subtle page-edge feel

  --cut-offset: 0.75rem;

  clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--cut-offset)), 0 100%);

  // On mobile, reduce or remove the cut to preserve vertical space
  @media (max-width: 640px) {
    --cut-offset: 0.35rem;
  }

  // Under reduced motion, no cut (clip-path is not an animated property)
  @media (prefers-reduced-motion: reduce) {
    clip-path: none;
  }
}
```

**Critical constraints:**

- `clip-path` applies to the hero container, which has `overflow: hidden` already — safe.
- Hero content uses `z-index: 4` so it is above the clip background.
- Must maintain the `::before` border inset — the clip should not visually cut into the internal
  frame.
- Theme-scoped in Valentina overrides only
  (`.event--valentina-hernandez.theme-preset--editorial-magazine .invitation-hero[data-variant='editorial-magazine']`).
- The hero's existing `padding: 0` and `min-height: 100svh` ensures the clip doesn't affect content
  layout.
- The quote section's dark background will be visible through the clipped area — intentional and
  desirable.

### 4.2 `layered-panel` — Quote → Family

```scss
// Quote section gets negative bottom margin
// Family panel gets elevated z-index to overlay

// On the quote wrapper (or .quote-section)
.quote-section[data-variant='editorial-magazine'] {
  position: relative;
  z-index: 1;
  margin-bottom: -2rem; // Pulls family section up by 2rem
}

// On the family wrapper
.family[data-variant='editorial-magazine'] {
  position: relative;
  z-index: 2; // Appears above the quote's "bleed"

  // A subtle shadow on the family panel creates the paper-over-paper effect
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    box-shadow: 0 -4px 16px rgb(var(--v-ink-rgb) / 6%);
    pointer-events: none;
  }
}

// Mobile: reduce overlap
@media (max-width: 640px) {
  .quote-section[data-variant='editorial-magazine'] {
    margin-bottom: -1rem;
  }
}
```

**Critical constraints:**

- The theme wrapper `event-theme-wrapper` must have `overflow: visible` in the overflow direction
  (or no overflow clamping that would cut the effect).
- The quote's dark background will appear behind the family's paper surface — this is the desired
  layered effect.
- The `box-shadow` on family must be very subtle (6% opacity) to avoid a floating-card look.
- Must test with short quote content and long quote content.
- Must NOT overlap or hide family section content like the `N.º 02` chapter mark.

### 4.3 `thin-rule-transition` — Generic editorial separator

```scss
// Applied via Valentina override to the invitation-section-wrapper
// that precedes the target section. Creates a clean 1px editorial rule.

.invitation-section-wrapper[data-section-id$='-countdown']::after {
  content: '';
  display: block;
  position: absolute;
  // Not absolute — use block within the flow
  width: 100%;
  height: 1px;
  background: rgb(var(--v-ink-rgb) / 14%);
  margin-top: calc(var(--section-padding-block) * -1 + 1px);
}

// Simpler approach: apply as border-top on the section that opens
.family[data-variant='editorial-magazine'] {
  border-bottom: 1px solid rgb(var(--v-ink-rgb) / 14%);
  margin-bottom: 0;
  padding-bottom: var(--section-padding-block);
}
```

**Preferred approach:** Instead of adding a separator between family and countdown, **remove the
countdown's `border-block`** and let the padding do the separation naturally. The countdown's timer
grid already has internal `border: 1px solid` — the outer `border-block` is redundant.

```scss
.countdown-section[data-variant='editorial-magazine'] {
  // Remove the outer border-block — it creates double-line conflicts
  border-block: none;
}
```

### 4.4 `layered-panel` — PersonalizedAccess → RSVP (enhanced)

```scss
// Extend the existing PA section styling to overlap into RSVP
.personalized-access[data-variant='editorial-magazine'] {
  margin-bottom: -1.5rem;
  position: relative;
  z-index: 2;
}

// RSVP gets a subtle z-index to ensure its content isn't overlapped
.rsvp[data-variant='editorial-magazine'] {
  position: relative;
  z-index: 1;
  padding-top: calc(var(--section-padding-block) + 1.5rem);
}
```

Same constraints as quote→family. The PA section already has `position: relative`.

---

## 5. Implementation Scope Proposal

### 5.1 Phase 1: Local Valentina/Editorial-Magazine Proof of Concept

**Scope:** Implement only the top 2–3 boundaries in the Valentina override file.

**Target boundaries:**

1. Hero → Quote: `editorial-cut` (in `_xv-valentina-hernandez.scss` only)
2. Quote → Family: `layered-panel` (in `_xv-valentina-hernandez.scss` only)
3. Countdown `border-block` fix (in `_xv-valentina-hernandez.scss` only)

**File changes exclusively within:**

- `src/styles/themes/sections/_xv-valentina-hernandez.scss`
- No new files, no component changes, no schema changes.

**Validation:**

- `pnpm type-check`
- `pnpm build`
- Visual QA on `/xv/valentina-hernandez?forceEnvelope=true` at 390px and desktop
- Confirm no content clipping, overflow, or layout shift

**Stop conditions:**

- `clip-path` causes hero frame/content to appear cut
- Negative margins cause layout oscillation or overflow
- Reduced-motion users see broken layout
- Mobile viewport has less than 60vh of visible hero content after clip

### 5.2 Phase 2: Reusable Preset-Level Section Transition System

**Only if Phase 1 proves useful AND the visual improvement is measurable.**

**Scope:**

- Add a `--section-transition-*` variable system to `_editorial-magazine.scss`
- Define transition types as CSS custom properties:
  `--section-transition-type: none | thin-rule | layered-panel | editorial-cut`
- Each section SCSS file reads the transition type variable and renders the appropriate
  `::before`/`::after` content
- Section transition variables could live in `sectionStyles.*.transition` in the content schema
  (future)

**Deferred to Phase 2:**

- Schema changes to add `sectionStyles.*.transition` field
- Preset-level default transition configuration
- Demo route updates
- Documentation for theme authors

---

## 6. Non-Goals

This analysis and any subsequent Phase 1 implementation explicitly excludes:

- ❌ **Broad theme refactor** — transitions stay within Valentina's override file. No changes to
  editorial-magazine base files unless fixing a proven bug.
- ❌ **Schema or content model changes** — no new `sectionStyles.*.transition` fields until Phase 2
  is justified.
- ❌ **New dependencies** — no npm packages, no D3, no GSAP, no new fonts.
- ❌ **JS animation systems** — only CSS transitions (transform, opacity, clip-path). No
  IntersectionObserver, no scroll-driven animations, no JavaScript choreography.
- ❌ **Copying the reference template literally** — the `mevoyacasar.com.mx/ejemplo-plata/` uses
  different design language. We extract editorial language, not visual copying.
- ❌ **Changes to unrelated invitations** — no touching celestial-blue, enchanted-rose,
  luxury-hacienda, or other presets.
- ❌ **Reveal contract changes** — the `data-editorial-reveal-phase` system remains untouched. Hero
  entrance animations are not part of this pass.
- ❌ **Section order changes** — no reordering sections, no new interlude insertion for transition
  purposes.
- ❌ **Photo-mask transitions** — deferred because they require image asset changes and create
  complexity that doesn't match the editorial restraint goal.
- ❌ **Decorative waves or flourishes** — explicitly filtered out as romantic/wedding-template
  language.
- ❌ **Global configurable transition system** — not until Phase 2 is justified.

---

## 7. Acceptance Criteria

### Visual Criteria

- [ ] The Hero → Quote boundary feels like a deliberate editorial page turn, not an accidental color
      switch.
- [ ] The Quote → Family boundary feels like a paper card being overlaid onto the dark editorial
      spread.
- [ ] The transition is NOT noticed as a "decoration" — it should feel structurally intentional, not
      ornamental.
- [ ] The countdown section no longer has conflicting `border-block` edges.
- [ ] Remaining section boundaries (11 of 13 total) feel naturally separated by typography rhythm
      and padding, not by added decoration.
- [ ] Premium editorial feel is preserved — the invitation reads as a curated publication, not a
      themed template.
- [ ] No section feels overloaded, gimmicky, or disconnected.

### Technical Criteria

- [ ] No JS animations introduced.
- [ ] No new SCSS files — changes confined to `_xv-valentina-hernandez.scss` (Phase 1).
- [ ] `clip-path` on hero does not clip hero text, portrait, or internal frame border.
- [ ] Negative margins do not cause layout oscillation or content overlap.
- [ ] No horizontal overflow introduced (test especially at 390px and 414px).
- [ ] `prefers-reduced-motion: reduce` does not show broken or misaligned transitions.
- [ ] No layout shift visible during section transition (CSS-only, no reflow).
- [ ] Existing hero reveal animations remain intact.
- [ ] `pnpm type-check` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm lint:styles:changed` passes.

### Edge Cases

- [ ] Short quote text (single line) does not break the `layered-panel` overlap.
- [ ] Long quote text (multi-paragraph) does not cause excessive negative margin overlap.
- [ ] Hero with very tall background image still shows the `editorial-cut` correctly.
- [ ] Mobile landscape orientation does not clip hero content due to `clip-path`.
- [ ] Desktop 1440px+ shows the cut as a subtle design detail (not invisible, not exaggerated).
- [ ] All viewports remain responsive after transition styling.

---

## 8. Validation Plan

### 8.1 Viewport Targets

| Viewport         | Width     | Device target    | Key concern                                 |
| ---------------- | --------- | ---------------- | ------------------------------------------- |
| Mobile narrow    | 390px     | iPhone 14 Pro    | Hero cut offset, panel overlap, no overflow |
| Mobile wide      | 414px     | iPhone XR / 11   | Same as above                               |
| Mobile landscape | 844×390px | iPhone landscape | Hero clip in landscape hero                 |
| Tablet           | 768px     | iPad             | Panel overlap scaling                       |
| Desktop standard | 1440px    | MacBook Pro      | Cut visibility, overall pacing              |
| Desktop wide     | 1920px    | External monitor | Cut exaggeration check                      |

### 8.2 Routes to Validate

- **Primary:** `/xv/valentina-hernandez?forceEnvelope=true` — real content after cover reveal
- **Demo regression:** `/xv/demo-xv-editorial-magazine` — if any editorial-magazine base file was
  touched (Phase 1 does NOT touch base files, but verify)
- **Non-editorial regression:** `/xv/demo-xv-jewelry-box` — confirm no global SCSS side-effects

### 8.3 Validation Commands

```bash
# Before implementation
pnpm agent:git-safety:check

# After implementation
pnpm lint:styles:changed
pnpm type-check
pnpm build

# Verify hero clipping
# In browser console after hero renders:
document.querySelector('.invitation-hero')?.style.clipPath

# Verify panel overlap
document.querySelector('.invitation-section-wrapper[data-section-id$="-quote"]')?.style.marginBottom

# Verify no overflow
document.documentElement.scrollWidth <= window.innerWidth  // should be true
```

### 8.4 Screenshots to Capture

1. Hero bottom edge — confirm clip-path bevel is visible and intentional
2. Quote → Family boundary — panel overlap visible on scroll
3. Family → Countdown — no double-line border artifact
4. Full-page scroll recording (desktop) — visual pacing of section transitions
5. Full-page scroll recording (mobile 390px) — same, with narrower context
6. Reduced-motion mode — transitions disabled, no broken layout

---

## 9. Recommended Transition Map (Summary)

| #   | Boundary                       | Technique                                                | Priority | Scope                       | Risk       |
| --- | ------------------------------ | -------------------------------------------------------- | -------- | --------------------------- | ---------- |
| 1   | **Hero → Quote**               | `editorial-cut` (clip-path)                              | P1       | Valentina override only     | MEDIUM     |
| 2   | **Quote → Family**             | `layered-panel` (negative margin)                        | P1       | Valentina override only     | MEDIUM     |
| 3   | **Family → Countdown**         | Remove countdown `border-block` + `thin-rule` or nothing | P2       | Valentina override only     | LOW        |
| 4   | **Gifts → PersonalizedAccess** | Extend existing PA `::before` rule (optional)            | P3       | Valentina override only     | LOW        |
| 5   | **PersonalizedAccess → RSVP**  | `layered-panel` (enhanced)                               | P2       | Valentina override only     | LOW-MEDIUM |
| 6   | **ThankYou → Footer**          | Refine footer `border-top` (already in accent pass)      | P4       | Editorial base or Valentina | LOW        |

## 10. Top 3 Implementation Priorities

1. **Hero → Quote `editorial-cut`** — The single highest-impact boundary. A subtle diagonal clip on
   the hero bottom is the editorial magazine equivalent of a page-turn. Implementation is ~15 lines
   of CSS in the Valentina override. The hero already has `overflow: hidden`, so `clip-path` is
   safe. Must set `--cut-offset: 0.75rem` desktop, `0.35rem` mobile, `0` in reduced motion.

2. **Quote → Family `layered-panel`** — Second highest impact. The dark-to-light transition
   currently feels like two independent templates glued together. A `margin-bottom: -2rem` on the
   quote section and `z-index: 2` on the family wrapper creates a paper-stack editorial feel. Must
   test with short and long quote content.

3. **Countdown `border-block` cleanup** — Low effort, immediate visual improvement. The current
   double-border visual (family group border + countdown outer border) creates unintended noise.
   Removing `border-block` from countdown (`_xv-valentina-hernandez.scss` override) costs 2 lines
   and eliminates a visible artifact.

## 11. Risks and Conflicts

### 11.1 Current Code Conflicts with Desired Direction

1. **Hero `min-height: 100svh` + `clip-path`:** If `clip-path` is applied to the hero which has
   `min-height: 100svh`, the visual cut will be below the viewport bottom after the user scrolls.
   The user must scroll slightly for the cut to be visible. This is actually desirable — the cut
   acts as a scrolled-reveal detail rather than an on-load visual. However, on short-content
   viewports the cut might not be visible at all. **Mitigation:** Test at multiple content lengths.

2. **Quote `::before` red accent rule:** The quote section opens with a `::before` red rule (3.5rem
   wide, 2px height). This element creates a visual "top" for the quote section. If we add
   `margin-bottom: -2rem` to the quote, the red rule at the top is unaffected. **No conflict.**

3. **Hero internal `::before` frame:** The hero uses `inset: clamp(0.9rem, 3vw, 2rem)` for an
   internal white border. With `clip-path`, this internal frame will be clipped too. We must ensure
   the clip offset doesn't visibly cut into the frame. **Mitigation:** The `--cut-offset` must be >=
   the frame `inset` bottom value, or we must exclude the frame from the clip. Preferred: let the
   frame clip with the hero — the frame ending slightly before the edge is actually editorial and
   intentional.

4. **Valentina hero `background` uses multi-layered gradients:** The hero background in
   `_xv-valentina-hernandez.scss` uses `repeating-linear-gradient` textures. `clip-path` will clip
   these gradients cleanly. **No conflict.**

5. **Section `padding-block` and `border-block` interaction:** The countdown section has explicit
   `border-block`. This creates visible border lines at the top and bottom of its wrapper. When
   stacked between two sections that also have padding, the `border-block` sits inside the padding
   zone, not at the section boundary edge. **Issue:** The border is inside the section padding, not
   at the section boundary. **Fix:** Remove `border-block` and use the padding as the separator.

### 11.2 General Risks

| Risk                                                    | Likelihood | Mitigation                                                                                                                                                                                                     |
| ------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clip-path` on hero causes content to appear cut        | Low        | Content sits on `z-index: 4`. Clip only the container, which has `overflow: hidden` already. Test at all breakpoints.                                                                                          |
| Negative margins cause layout oscillation               | Low-Medium | Use fixed `margin-bottom` (`-2rem`) not percentage-based. The quote content height is bounded.                                                                                                                 |
| Reduced-motion users see broken `clip-path`             | Low        | Under `prefers-reduced-motion`, set `clip-path: none`. This is standard practice.                                                                                                                              |
| `clip-path` causes hero `::before` frame to look broken | Low        | The frame is clipped identically to the container — this creates a deliberate edge detail, not a bug.                                                                                                          |
| Panel overlap hides content                             | Low        | The overlap is at the boundary between sections. Content near the bottom of quote (author line) has `margin-top: clamp(2rem, 6vw, 3.5rem)` plus `padding-top`. The `-2rem` overlap won't reach author content. |
| Mobile layout breaks due to reduced `padding-block`     | Very Low   | The `padding-block` is `clamp(5rem, 13vw, 9rem)`. On 390px that's ~5rem. A `-1rem` margin still leaves 4rem padding.                                                                                           |
| Future section reordering breaks transition assumptions | Low        | Transitions are scoped to specific section pairs by `data-variant`. If order changes, the transitions need recalculating. Acceptable for Phase 1 since Valentina section order is stable.                      |
