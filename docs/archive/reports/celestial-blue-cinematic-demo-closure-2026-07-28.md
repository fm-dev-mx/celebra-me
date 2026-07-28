# Celestial Blue cinematic demo closure

**Date:** 2026-07-28
**Scope:** `demo-xv-celestial-blue` flagship treatment; no content, route, RSVP, or section-order change.

## Outcome

Celestial Blue now has a visibly cinematic normal-motion presentation while retaining the unified
invitation motion system and its two approved non-neutral intersections. The active motion and
intersection authorities remain [`motion.md`](../../domains/theme/motion.md) and
[`section-intersections.md`](../../domains/theme/section-intersections.md); this pass adds no new
motion family, observer, animation dependency, or section boundary.

## Changed files

| File | Purpose |
| --- | --- |
| `src/styles/invitation-profiles/demo-xv-celestial-blue.scss` | Demo-scoped cinematic profile: hero role values, ink-blue veil, silver constellation, portrait-safe typography treatment, location portal, and RSVP atmospheric peak. |
| `src/styles/themes/sections/hero/_celestial-blue.scss` | Uses the semantic media-role duration instead of an out-of-contract hardcoded `1.1s` content animation. |
| `tests/e2e/invitation-motion-system.spec.ts` | Restores five-width overflow coverage and proves the cinematic hero, both approved pivots, timing budget, and reduced-motion removal. |

## Final motion and intersection mapping

| Moment | Static composition | Normal-motion behavior | Reduced-motion behavior |
| --- | --- | --- | --- |
| Hero | Full-bleed portrait, directional ink-blue veil, silver constellation, grouped title and details | One `0.86s` media reveal, then a tokenized slow portrait breath and constellation drift | Final image and typography state; no constellation or media animation |
| Location → interlude | Deep-blue self-clipping `arch` with a localized silver thread | The thread visibly ignites once as the pivot becomes visible | Static arch and image; no geometric or ambient motion |
| RSVP → interlude | Deep asymmetric `atmospheric-blend` with silver-blue halo | The halo visibly opens once as the pivot becomes visible | Static blend and image; no geometric or ambient motion |

Celestial retains exactly two non-neutral intersections:

1. `location → interlude`: `arch`.
2. `RSVP → interlude`: `atmospheric-blend`.

All remaining boundaries are neutral. The hero title and event information remain visible within the
documented one-second limit; each hero role is at or below `900ms`, and interaction/reveal limits
remain unchanged.

## Accessibility and runtime boundaries

- The profile uses decorative pseudo-elements only; they have no semantic content and do not
  intercept input.
- The portrait breath and constellation drift use the shared ambient-duration token and run only
  with normal motion; the two pivot arrivals use the shared reveal duration.
- Reduced motion removes every constellation, media, and pivot animation and resets image
  transform/scale.
- The shared coordinator remains the only invitation reveal observer owner and stays fail-open.
- Abril's locked public RSVP remains server-only; Celestial retains its lazy interactive RSVP island.
- No JavaScript, React, Framer Motion, observer, or route behavior was added to the new profile.

## Evidence

- Visual section captures: `output/playwright/celestial-cinematic-after/` at `360×740`, `390×844`,
  `430×932`, `768×1024`, and `1440×1200`.
- Full-page `320×800` capture:
  `output/playwright/celestial-cinematic-after/celestial-320-full.png`.
- Manual review: the `390px` and desktop hero show a readable left-side type stack, clear portrait
  separation, and an unmistakably darker cinematic composition; the two approved pivots remain the
  only emphasized section transitions.
- The screenshot utility generated all planned image artifacts. Its audit-only animation
  normalization produces a pre-existing RSVP hydration warning by changing SSR classes before the
  island hydrates; normal-route motion E2E, including complete observer scrolling, passed with no
  captured console errors.

## Validation results

| Command | Result |
| --- | --- |
| `pnpm exec playwright test tests/e2e/invitation-motion-system.spec.ts --workers=1 --reporter=line` | 21 passed |
| `pnpm test:e2e:ci` | 36 passed |
| `pnpm test -- --runInBand --silent` | 339 suites passed, 1 skipped; 4,138 tests passed, 1 skipped |
| `pnpm type-check` | 0 errors, 0 warnings, 0 hints |
| `pnpm lint` | passed |
| `pnpm lint:styles` | passed |
| `pnpm validate:structure` | passed |
| `pnpm validate:ui-governance` | passed |
| `pnpm validate:event-parity` | passed |
| `pnpm validate:no-pii` | passed |
| `pnpm ops check-links` | passed |
| `pnpm build` | Astro SSR and Vercel build passed |
| `pnpm agent:git-safety:check` | passed; index and HEAD unchanged from this task's baseline |

The production build emitted 52 client JavaScript files totaling 1,186,341 bytes, unchanged from
the prior unified-motion baseline. This pass is CSS and test coverage only; no client JavaScript
chunk was added.

## Finding disposition

| Finding | Disposition |
| --- | --- |
| F-01 contradictory guidance | Resolved |
| F-02 reduced-motion transforms | Resolved |
| F-03 theme/effect conflation | Resolved |
| F-04 observer fan-out | Resolved |
| F-05 static RSVP hydration | Resolved |
| F-06 brittle Abril intersections | Resolved |
| F-07 nonexistent parallax terminology | Resolved |
| F-08 neutral-only Celestial transitions | Resolved — the two approved pivots are now intentionally prominent. |
| F-09 Abril overflow boundary | Resolved |
| F-10 unnamed hero sequencing | Resolved |

No files were staged or committed by this task.
