---
name: animation-motion
description:
  Implement or review invitation entrances, reveals, interactions, ambient decoration, and reduced
  motion through the canonical invitation motion contract.
domain: frontend
version: 1.2.0
when_to_use:
  - Designing or modifying transitions, reveals, or animated interactions
  - Reviewing motion performance or reduced-motion handling
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
inputs:
  - Components, SCSS animations, and interaction requirements
outputs:
  - Contract-aligned motion implementation and verification
related_skills:
  - accessibility
related_docs:
  - docs/domains/theme/motion.md
  - docs/domains/theme/section-intersections.md
---

# Animation and Motion

Load [`docs/domains/theme/motion.md`](../../../docs/domains/theme/motion.md) before changing
invitation motion. It is the sole normative authority for categories, timing, reveal recipes, hero
roles, observation, ambient decoration, and reduced motion. This skill intentionally duplicates no
normative values.

Implementation workflow:

1. Classify the behavior using the canonical categories.
2. Reuse the documented recipe, semantic token, hero role, or intersection family.
3. Keep SSR content visible and preserve the coordinator's fail-open lifecycle.
4. Prefer opacity/transform for ordinary motion and CSS for item staggering. When
   `theme.motion: 'editorial'` is active, use the native scroll-driven primitives in `motion.md` and
   `section-intersections.md` (`animation-timeline: view()`, `view-timeline`, `timeline-scope`,
   `ScrollScene.astro`, `SplitWords.astro`, and `folio` / `stack` intersections).
5. Do not add third-party WebGL/GSAP animation libraries or section-owned observers/scroll listeners
   outside the canonical coordinators (`motion-coordinator.ts`, `scroll-scene.ts`, and desktop-only
   `smooth-scroll.ts`).
6. Verify ordinary and reduced computed styles, rendered geometry, no-JavaScript readability,
   observer counts, console output, overflow, and layout stability.

Use the accessibility skill for broader keyboard, focus, form, and announcement verification.

## Approved High-End Motion Benchmarks (Non-Authoritative Inspiration)

Use these owner-calibrated references when interpreting or proposing scroll-driven editorial
choreography (never flat e-cards or static template catalogs):

- [Awwwards — Susie & Jay: A Journey of Love](https://www.awwwards.com/sites/susie-jay-a-journey-of-love)
- [Awwwards — Wedding Invitation | Y & T](https://www.awwwards.com/sites/wedding-invitation-y-t)
- [Awwwards — Zane & Zoe](https://www.awwwards.com/sites/zane-zoe)
- [Awwwards — Wedding Invitation (NganoYoshihiro)](https://www.awwwards.com/sites/wedding-invitation)
- [Wedfully — Editorial Wedding Invitation](https://wedfully.framer.website/)
- [Aveluna — Luxury Editorial Wedding Invitation](https://aveluna.framer.website/)
