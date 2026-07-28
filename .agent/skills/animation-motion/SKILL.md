---
name: animation-motion
description:
  Implement or review invitation entrances, reveals, interactions, ambient decoration, and reduced
  motion through the canonical invitation motion contract.
domain: frontend
version: 1.1.0
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
4. Prefer opacity/transform for ordinary motion and CSS for item staggering.
5. Do not add an animation library, section-owned observer, scroll listener, or scroll-position
   animation loop.
6. Verify ordinary and reduced computed styles, rendered geometry, no-JavaScript readability,
   observer counts, console output, overflow, and layout stability.

Use the accessibility skill for broader keyboard, focus, form, and announcement verification.
