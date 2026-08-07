---
title: Premium Motion System
status: implemented
created: 2026-07-27
updated: 2026-07-27
related_skills:
  - animation-motion
  - frontend-design
  - accessibility
  - theme-architecture
related_docs:
  - docs/domains/theme/motion.md
  - .agent/plans/archived/demo-xv-celestial-blue-motion-audit.md
  - .agent/plans/archived/motion-reveal-remediation.md
supersedes: []
---

# Premium Motion System — design (no implementation yet)

## Current state after regression fix

**Kept / safe**

- Scroll-reveal contract: SSR visible; hide only under `.has-motion:not(.is-visible)`; IO reveal;
  fail-open.
- Section entrances: opacity + translateY transitions.
- Gallery items: same safe reveal contract (`_gallery.scss` pending under
  `has-motion:not(.is-visible)`, 0.08s stagger) + richer per-item in-view emphasis (`filter` /
  `scale` via `data-in-view`).
- Hero timeline under `[data-reveal-state='revealed']`.
- Envelope open visuals.

**Removed / flattened**

- Scroll parallax on interludes.
- Stacked hero wrapper delays (celestial / enchanted).
- Long itinerary staggers; keyframe-vs-static flash risks.
- Hard post-envelope scroll jump.

**Net effect:** correct but flat. No depth, no ambient life, weak scene change, little visible
choreography.

## Invariants the premium system must keep

1. Content never depends on JS/motion to become readable.
2. Hide only under `.has-motion:not(.is-visible)`.
3. GPU props: `transform`, `opacity` (+ optional short `filter: blur` only with `no-preference`).
4. No scroll-linked parallax; one transform owner per element.
5. No keyframe/static-opacity flash patterns.
6. Reduced motion: instant visibility; ambient disabled.
7. Timing bands: reveal ~0.4–1.2s; stagger ≤100ms step; cap ~0.5s.
8. Single API; presets only tune tokens.

## Layered model

| Layer | Name           | Runs when                         | Visual role                        | Motion source                                     |
| ----- | -------------- | --------------------------------- | ---------------------------------- | ------------------------------------------------- |
| L0    | Scene          | Envelope / route handoff          | Luxury transition between “scenes” | `data-reveal-state` timeline                      |
| L1    | Section reveal | `is-visible` added                | Content arrives with presence      | transition (tokens)                               |
| L2    | Stagger        | Inside L1                         | Order / editorial rhythm           | transition-delay (capped)                         |
| L3    | Ambient        | While `.is-visible`               | Life / depth without gating        | CSS-only loop (no scroll math)                    |
| L4    | Micro          | Hover / focus / gallery `in-view` | Premium feedback                   | existing transitions + gallery image filter/scale |

Rules:

- L3 never hides content; it only adds subtle continuous life after reveal.
- L1 must remain visible and premium even if L3 is disabled.
- Gallery is both L1+L2 (item reveal + stagger) and L4 (in-view emphasis, hover); do not add
  competing transforms.

## Motion recipe tokens (proposed addition to semantic motion layer)

Semantic recipe names (values live in system + preset overrides):

- `--motion-reveal-distance` (e.g. 12–24px)
- `--motion-reveal-duration` (`--duration-premium` / `--duration-reveal`)
- `--motion-reveal-ease` (`--ease-premium`)
- `--motion-reveal-blur` (0–8px, only `no-preference`)
- `--motion-stagger-step` (≤0.1s)
- `--motion-stagger-cap` (≤0.5s)
- `--motion-ambient-scale-to` (e.g. 1.03–1.05)
- `--motion-ambient-duration` (10–20s)
- `--motion-scene-fade` (200–500ms envelope→hero hold/crossfade)

## Per-preset recipes (examples, not exhaustive)

| Preset          | Reveal character                   | Ambient                                                             | Stagger    |
| --------------- | ---------------------------------- | ------------------------------------------------------------------- | ---------- |
| celestial-blue  | float + soft blur, distance ~20px  | very slow interlude scale 1→1.035; gallery in-view image lift ~1.02 | 0.08s step |
| enchanted-rose  | warmer slower fade, distance ~18px | candle-gold sheen on hero title only                                | 0.08s step |
| jewelry-box*    | premium fade-up (existing family)  | subtle light sweep accents, not sections                            | 0.08s step |
| hacienda family | minimal drift, no blur             | texture only, no movement loops                                     | 0.06s step |

Gallery per preset: reuse `--motion-reveal-*` + `--motion-stagger-*` for entrance; keep existing
`--gallery-item-image-filter/scale-*` as the premium in-view layer (do not animate layout or overlay
opacity in a way that gates captions).

Presets change **tokens**, not selector structure.

## Shared primitives (design)

1. **Recipe mixin (SCSS)**
   - Pending:
     `opacity: 0; transform: translateY(var(--motion-reveal-distance)); filter: blur(var(--motion-reveal-blur))`
     only under `no-preference` + `has-motion:not(.is-visible)`.
   - Visible: opacity 1, transform none, blur 0.
   - Transition: opacity/transform/filter with reveal tokens.

2. **Ambient interlude (CSS-only)**
   - `.invitation-interlude.is-visible .invitation-interlude__image { animation: interlude-ambient ... infinite alternate; }`
   - Keyframes: `transform: scale(1) → scale(var(--motion-ambient-scale-to))` (single transform
     owner: `__image`).
   - Under reduced-motion: `animation: none; transform: none`.
   - No scroll listeners.

3. **Hero scene choreography**
   - Only under `[data-reveal-state='revealed']`.
   - Tight delays: label ~0.15s, title ~0.25s, details ~0.45s; no wrapper animation while sealed.
   - Optional envelope→hero crossfade/hold via `--motion-scene-fade` instead of hard cut perception.

4. **Stagger utility**
   - `@for` with `--motion-stagger-step` and `--motion-stagger-cap`.
   - Gallery uses the same step/cap; keep its item-level emphasis as L4 only (filter/scale on `img`,
     not a second entrance transform).

5. **IO tuning**
   - Prefer `rootMargin: 0px 0px -15% 0px` (or equivalent) so reveals start when visible, not after.
   - Gallery already uses `rootMargin: '0px 0px -8% 0px'` + `threshold: 0.18`; evaluate alignment
     with the shared reveal feel.

## What stays banned (regression guards)

- `.has-motion` hide without `:not(.is-visible)`
- Keyframe reveal that starts after static hide drops (flash)
- Parent + child competing transforms
- Scroll-driven transform on content
- Delay >1s for entrance choreography
- Motion that blocks reading or depends on JS

## Implementation sequence (future authorized work)

1. Tokens: add recipe vars to semantic motion + preset overrides (no behavior change).
2. Refactor shared section reveals (incl. gallery items) to consume recipe tokens (keep current
   look).
3. Upgrade reveal recipe: blur + distance + premium ease on celestial + enchanted (+ jewelry family
   where appropriate).
4. Hero scene pass under `revealed` (celestial + enchanted).
5. Interlude ambient CSS-only (replace removed parallax with safe life).
6. Gallery premium pass: keep entrance reveal aligned to recipe; strengthen in-view emphasis via
   existing filter/scale tokens (no extra transform conflicts).
7. IO threshold/rootMargin tuning + QA probes.
8. QA: creative-qa motion rows, mobile-first, reduced-motion pass, demos celestial/enchanted/jewelry
   spot-checks.

## Acceptance criteria (design level)

- Any premium motion can be disabled via reduced-motion without content loss.
- Runtime probes show no stuck-hidden at `has-motion + is-visible`.
- No new parallax / scroll math listeners.
- Presets differentiate via tokens only.
- Gallery: entrance uses the shared recipe; in-view emphasis remains L4-only (image filter/scale),
  with captions/overlay never reveal-gated.
- Changes pass stylelint + animation tests and keep fail-open contract.
