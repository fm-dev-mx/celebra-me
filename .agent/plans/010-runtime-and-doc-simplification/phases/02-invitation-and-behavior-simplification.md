# Phase 02: Invitation and Behavior Simplification

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Reduce owner-local invitation behavior indirection without changing invitation
contracts, personalization flow, or premium motion.

**Weight:** 25% of total plan

---

## Completed Work

- Removed the redundant `EnvelopeSyncBehavior` wrapper from the invitation route.
- Kept reveal-state ownership inside `EnvelopeReveal`, which already owns localStorage-backed
  envelope state and the `invitation-revealed` body class.
- Renamed the live route-facing variable from `presenter` to `pageData` to match the current
  `src/lib/invitation/page-data.ts` architecture.
- Inlined the hero parallax behavior into `Hero.astro` and removed the single-owner React behavior
  wrapper.
- Simplified the hero background class/style coupling while preserving the visual effect.

---

## Acceptance Criteria

- Invitation route URLs and canonical redirect logic remain unchanged.
- Envelope reveal behavior still respects persisted state and reduced-motion handling.
- Hero parallax remains premium and does not add a separate owner-local behavior component.
