# Invitation Motion System

**Status:** Sole normative authority for invitation motion
**Last updated:** 2026-07-27

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

`InvitationSections.astro` publishes the selected recipe as `data-reveal`. Shared mechanics live in
`src/styles/invitation/_motion-system.scss`. Sections may provide tokens and `data-reveal-item`
markers, but must not create observers.

## Document-scoped observation contract

`src/lib/invitation/motion-coordinator.ts` is the only invitation reveal coordinator. Every current
recipe uses one documented observer signature:

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
7. Invitation motion does not use scroll listeners or animation-frame scroll loops.

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
understand an intersection. Ambient image scaling is not parallax; no scroll-position transform is
part of the invitation system.
