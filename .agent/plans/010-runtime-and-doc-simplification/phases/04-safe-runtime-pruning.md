# Phase 04: Safe Runtime Pruning

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Repair objectively broken or dangling internal runtime surface without widening the
pass into aesthetic or architectural simplification work that is not yet proven safe.

**Weight:** 10% of total plan

---

## Completed Work

- Removed the dangling `HeroParallaxBehavior` dependency from the live hero component tree.
- Kept the premium parallax behavior local to `Hero.astro` instead of reviving a dead wrapper file.
- Deferred other one-consumer behavior wrappers because they still participate in the live runtime.

---

## Acceptance Criteria

- The runtime no longer references internal files that are already absent from the tree.
- Safe pruning remains narrow and evidence-driven.
- Premium interaction quality is preserved.
