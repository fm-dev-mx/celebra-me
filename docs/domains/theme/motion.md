# Invitation Motion System

**Status:** Sole normative authority for invitation motion **Last updated:** 2026-10-19

This document owns invitation motion categories, timing limits, reveal recipes, observer behavior,
ambient decoration, hero sequencing, and reduced motion. Operational skills and other domain docs
may link here but must not repeat normative values. Archived plans and reports are historical
evidence only.

## Categories and limits

| Category             | Purpose                                      | Limit                                                                           |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| Initial entrance     | Introduce the first hero composition         | Each role ≤ 900 ms; complete sequence ≤ 1.6 s                                   |
| In-view reveal       | Introduce a below-fold section once          | 400–700 ms                                                                      |
| Interaction feedback | Confirm hover, focus, press, or RSVP state   | ≤ 250 ms                                                                        |
| Ambient decoration   | Give non-semantic media slow visual life     | 14 s default; an established theme token may use an equivalent compatible value |
| Reduced motion       | Present the complete final state immediately | No geometric motion, loops, or stagger delay                                    |

The essential hero title and event information must be visible within one second. Ambient motion is
decorative, conveys no required information, and runs only under
`prefers-reduced-motion: no-preference`.

## Semantic implementation

Motion belongs to the semantic token layer in `src/styles/tokens/semantic/_motion.scss`.

- Use `--motion-interaction-duration` for direct feedback.
- Use `--motion-reveal-duration`, `--motion-reveal-distance`, and `--motion-reveal-ease` for section
  recipes.
- `--motion-reveal-distance` defaults to 18px (`src/styles/invitation/_motion-system.scss`). A
  section entering through an atmospheric-blend boundary may reduce it to 10–13px, because the blend
  already introduces the arrival.
- Use `--motion-stagger-step` and `--motion-stagger-cap` only for CSS item staggering.
- Use `--motion-ambient-duration` and `--motion-ambient-scale-to` only for decorative ambient media.
- Hero role variables own duration and delay for `media`, `eyebrow`, `title`, `details`, and
  `affordance`.

Themes may override semantic values within the limits above. They do not own reveal selector
structure, observer creation, or reduced-motion mechanics.

## Reveal recipes

The closed recipe set is:

- `none`: no entrance motion; content remains in its final state.
- `fade`: opacity-only section reveal.
- `fade-up`: opacity plus a small vertical entrance.
- `media-scale`: one-time media reveal followed by optional ambient decoration.
- `stagger-group`: one observed section whose marked items use CSS delays.
- `editorial`: opt-in per invitation with `theme.motion: 'editorial'`; every section uses it and
  each marked item is observed on its own (see [Editorial recipe](#editorial-recipe)).

### Stagger placement rule

Assign `stagger-group` to at most one section in any consecutive pair. Two adjacent sections with
`stagger-group` create compounded visual noise. Place at least one section using a different recipe
between any two stagger groups.

`InvitationSections.astro` publishes the selected recipe as `data-reveal`. Shared mechanics live in
`src/styles/invitation/_motion-system.scss`. Sections may provide tokens and `data-reveal-item`
markers, but must not create observers.

## Document-scoped observation contract

`src/lib/invitation/motion-coordinator.ts` is the only invitation reveal coordinator. Every section
recipe except `editorial` uses one documented observer signature:

```text
threshold: 0.12
rootMargin: 0px 0px -12% 0px
once: true
```

The contract is mandatory:

1. SSR and no-JavaScript content is visible.
2. The coordinator adds `has-motion` only after `observe()` succeeds.
3. Intersection adds `is-visible`, reveals marked items, and unobserves the wrapper.
4. Missing or throwing observation removes pending motion and reveals everything. Once observation
   registers successfully, an off-screen section remains pending until it intersects; elapsed time
   alone must never consume its entrance.
5. Reduced motion reveals immediately without constructing the reveal observer.
6. Item staggering is CSS-only; items are not independently observed.
7. Invitation motion does not use scroll listeners or animation-frame scroll loops, except the two
   editorial exceptions below (smooth wheel scrolling and the scroll-scene fallback).

The `editorial` recipe is the documented exception to rules 3, 5 and 6; its contract follows.

## Editorial recipe

`theme.motion: 'editorial'` (theme schema, optional) makes `section-render-data.ts` assign
`editorial` to every section. Invitations without the field render exactly as before.

- **Second observer.** The coordinator creates one more observer, `threshold: 0`,
  `rootMargin: 0px 0px -15% 0px`, once per item, so an item starts when its top crosses 85 % of the
  viewport. It observes each `data-reveal-item` and `data-reveal-role` (`label`, `title`, `lede`,
  `media`, `item`) element; a section without marked items is observed as one block. Observation
  starts only after `[data-reveal-state]` reaches `revealed`, so nothing animates behind the
  envelope. Observed targets carry `data-reveal-pending` until they enter; missing or throwing
  observation reveals everything (rules 1, 2 and 4 hold).
- **Order.** Items entering in one batch get `--reveal-order`, counted per role and capped at 8.
- **Timing.** One curve, `cubic-bezier(0.16, 1, 0.3, 1)`. Label 600 ms; title words 900 ms,
  `80 ms + 60 ms × word index` (`SplitWords.astro` emits the spans with `--i`; the accessible name
  stays on the heading); lede 700 ms after `--reveal-delay` (240 ms); media 1200 ms clip; items 600
  ms, `300 ms + 70 ms × order`. These longer entrances belong to this recipe only; the in-view limit
  in the table applies to the other recipes.
- **Reduced motion.** The observer still runs, and every editorial entrance becomes a 200 ms opacity
  fade with no blur, scale, clip, translation or delay. Ambient lanterns rest in place and the
  envelope send-off is skipped.
- **Ambient lanterns.** Layers of `StorybookLanternSky` with `scene="ambient"` that a profile
  displays loop only while on screen (`data-ambient='running'` from an observer in the coordinator);
  hidden layers are never observed.
- **Scroll-linked exceptions.** Three effects tie motion to scroll position, all only under
  `prefers-reduced-motion: no-preference`:
  - `itinerary.stacked-cards` uses CSS scroll-driven animations (`view-timeline`), inside
    `@supports (animation-timeline: view())`. There is no script; without support the cards stay as
    a plain list.
  - Smooth wheel scrolling (`src/lib/invitation/smooth-scroll.ts`, the `lenis` package) runs an
    animation-frame loop. It is loaded with a dynamic import after the reveal, only on
    `pointer: fine`, so phones never download it. Native touch scrolling is unchanged, and `#` links
    scroll to their target below the fixed header.
  - Scroll scenes (next section).
- **Budget.** Nothing new loads on first paint except CSS. At most about 12 elements animate at
  once.

## Scroll scenes

A scroll scene pins one stage to the viewport while the page scrolls through a taller section, and
its children change with scroll position instead of time. Scenes belong to the `editorial` recipe
only; elsewhere the same markup renders as a normal section.

- **Primitive.** `ScrollScene.astro` renders `.scroll-scene[data-scroll-scene]` with
  `data-scene-length` 2–5 (viewport heights, including the pinned screen; default 3) and an optional
  `data-scene-steps`. Its `.scroll-scene__stage` is `position: sticky`, `100svh` tall, with
  `overflow: clip`. Use `svh`, never `vh`, for scene geometry.
- **Engines.** Under `prefers-reduced-motion: no-preference` inside `[data-motion="editorial"]`:
  - _Timeline:_ where `animation-timeline: view()` is supported, the scene declares the view
    timeline `--scroll-scene`; children animate with `animation-timeline: --scroll-scene` and ranges
    within `contain 0%` … `contain 100%` (the pinned span). No script runs.
  - _Script:_ elsewhere `src/lib/invitation/scroll-scene.ts` sets `data-scene-engine="script"` and
    writes `--scene-progress` (0–1) from one passive scroll listener, at most one frame per scroll,
    plus `data-scene-step` when steps are declared.

  Consumers style children through the `timeline`, `scripted` and `pinned` mixins of
  `src/styles/invitation/_scroll-scene.scss`.

- **Resting layout.** Reduced motion, a non-editorial invitation, or no engine leaves the stage in
  normal flow. Every scene's default (unmixed) styles are its complete static layout: all content
  visible, nothing at `opacity: 0`. The reduced-motion contract applies unchanged.
- **Properties.** Animate only `transform`, `opacity`, `scale`, `translate`, `rotate` and
  `clip-path`. Small inline SVG strokes (`stroke-dashoffset`) and motion paths (`offset-distance`)
  are allowed for decorative drawings.
- **Content and focus.** All text and controls stay in the DOM in reading order; decorative layers
  are `aria-hidden`. A control that is transparent at the current progress must become visible on
  `:focus-within`. Links and buttons inside a scene (for example «Cómo llegar») stay operable at
  every progress.
- **Ancestors.** Nothing between the scene and the viewport may set `overflow: hidden` or `auto`;
  use `overflow: clip` to clip, which keeps `sticky` working.
- **Budget.** At most two scenes per invitation and no more than 35 % of the page's scroll height
  pinned at a 390 × 844 viewport. Two scenes are never adjacent; a normal section sits between them.
  A scene never traps scrolling: no scroll snapping, no wheel or touch interception.

Other product surfaces may use the generic utilities in `src/utils/animations.ts`; they are not
invitation section owners and do not change this contract.

## Hero timing roles

Every standard invitation hero maps its animation to these roles:

| Role         | Content                                   |
| ------------ | ----------------------------------------- |
| `media`      | Background image and decorative overlay   |
| `eyebrow`    | Event label                               |
| `title`      | Celebrant/event title                     |
| `details`    | Date, time, venue, and supporting divider |
| `affordance` | Scroll cue                                |

Theme/profile choreography may change token values but must keep the individual and complete
sequence limits. The title and details remain the priority; ambient glints or bounce never delay
them.

## Reduced-motion contract

Under `prefers-reduced-motion: reduce`:

- disable translation, scale, rotation, tilt, bounce, parallax-like effects, stagger delays, and
  ambient loops;
- set animation and transition delays to zero;
- show hero and reveal content in its final readable state;
- permit only immediate non-geometric feedback such as color, border, outline, or a static shadow;
- do not depend on `has-motion` or another runtime class for the override;
- preserve focus visibility, validation, announcements, and interaction semantics.

Computed styles and rendered geometry are browser-tested on both audited invitations. A reduced
motion hover must not change an audited element's bounding box or transform matrix.

## Intersection relationship

Section intersections are static composition primitives governed by
[`section-intersections.md`](section-intersections.md). Motion is optional and never required to
understand an intersection. Ambient image scaling is not parallax. The only scroll-position
transforms are the editorial exceptions above, scroll scenes included.
