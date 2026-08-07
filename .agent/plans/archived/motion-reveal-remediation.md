---
title: Motion Reveal Remediation
status: implemented
created: 2026-07-27
updated: 2026-07-27
related_skills:
  - animation-motion
  - frontend-design
  - accessibility
related_docs:
  - docs/domains/theme/motion.md
  - .agent/plans/archived/demo-xv-celestial-blue-motion-audit.md
  - .agent/templates/creative/creative-qa-report.md
supersedes: []
---

# Motion Reveal Remediation Plan

## Objective

Fix the shared scroll-reveal / envelope / hero antipatterns that make invitation transitions feel
cheap (pop-in, jumps, competing transforms), starting from the validated
`demo-xv-celestial-blue` regression and rolling out through all surfaces that share the same code.

**Out of scope until a later task:** new motion features, preset visual redesigns, graphify refresh,
production DB work.

## Evidence validation (completed 2026-07-27)

Artifacts under `temp/motion-audit/` (local, gitignored): `runtime-evidence.json`,
`celestial-open-probe.json`, PNG probes. Browser + Playwright against
`http://localhost:4321/xv/demo-xv-celestial-blue` and `.../demo-xv-enchanted-rose`.

| ID | Code audit | Runtime validation | Result |
| -- | ---------- | ------------------ | ------ |
| F1 | Unsafe `.has-motion` hide without `:not(.is-visible)` | Gifts cards early `opacity: 0` with `hasMotion+isVisible`; thank-you message/signature early `opacity: 0` while section visible | **Confirmed** |
| F2 | Gifts header keyframe after `:not` drop | Gifts header early uses `animation: motion-fade-in-up` while opacity rising from ~0.2 | **Confirmed** |
| F3 | Location instant hide + keyframe | Location card early `opacity ~0.12` via `invitation-location-fade-in-up-soft`; transition omits opacity on celestial path | **Confirmed** |
| F4 | Stacked hero + celestial `__title-wrapper` 1s delay | Sealed state: wrap opacity animates toward 1 while title stays 0; at reveal (~3.5s) title still ~0.47 / label ~0.82. Sealed CSS does **not** reset `__title-wrapper` | **Confirmed (worse than audit)** |
| F5 | `scrollIntoView({ behavior: 'auto' })` | At top of page scrollY stayed 0 (no jump measurable); hard jump remains a risk when letter/scroll offset ≠ hero | **Partially confirmed** — keep fix; low severity when already at `#inicio` |
| F6 | Interlude hide + parallax | Mobile (390px): pending interludes `mediaOp: 0` + `has-motion`; mid-reveal media ~0.43–0.51 with scale/translate. Desktop CDP earlier: `--interlude-parallax-offset: -283px`. Parallax disabled ≤768px | **Confirmed** (hide/compete always; parallax desktop) |
| F7 | Celestial itinerary stagger 0.12s×N | Rows delays 0.12–0.60s; early all `opacity: 0` despite `isVisible`; at +900ms row4 still 0 | **Confirmed** |
| F8 | 8s fail-open snap | Not re-timed in this pass; keep as optional harden | **Deferred** |

Enchanted-rose replicates F1–F3 section behavior and F6 interlude mid-reveal. Its hero also ships a
1s delayed entrance (`themes/sections/hero/_enchanted-rose.scss`), same family as F4.

## Approach (chosen)

One shared motion contract, applied in phases:

1. **Pending hide only under** `.has-motion:not(.is-visible)`.
2. **Reveal via transition on opacity/transform** (not hide-static + keyframe flash).
3. **Hero entrances only under** `[data-reveal-state='revealed']`; remove stacked wrapper delays.
4. **Envelope handoff:** soft scroll or no-op when hero already in view.
5. **Interludes:** one transform owner; remove scroll parallax (skill ban).
6. **Stagger cap:** ≤100ms step, max ~0.5s total (animation-motion).

## Blast radius

| Layer | Surfaces |
| ----- | -------- |
| Shared invitation SCSS/JS | All demos/invitations using Family, Location, Gallery, Gifts, ThankYou, Countdown, Quote, Itinerary, Interlude, Envelope |
| Celestial-blue preset | `demo-xv-celestial-blue`, `demo-xv-xareni-profile`, `demo-baby-shower-celestial`, Xareni / América Johana / Leah Lexa, Abril itinerary celestial |
| shared-light envelope | celestial-blue, enchanted-rose, jewelry-box, jewelry-box-wedding |
| Hero delay twins | celestial-blue + enchanted-rose (+ audit angelic/editorial if they stack similarly) |

Primary QA demos after each phase: **celestial-blue**, **enchanted-rose**, one jewelry-box demo.
Spot-check Abril itinerary after F7.

## Implementation units

### Phase 1 — F1 selector unification (Critical)

**Files**

- [`src/styles/invitation/_thank-you.scss`](src/styles/invitation/_thank-you.scss)
- [`src/styles/invitation/_gifts.scss`](src/styles/invitation/_gifts.scss) (cards)
- [`src/styles/invitation/_event-location.scss`](src/styles/invitation/_event-location.scss) (cards)
- Review [`_family.scss`](src/styles/invitation/_family.scss) for leftover `.has-motion &` without `:not`

**Change**

Replace pending hides:

```scss
.has-motion & { opacity: 0; ... }
.is-visible & { opacity: 1; ... }
```

with:

```scss
.has-motion:not(.is-visible) & { opacity: 0; transform: ...; transition: opacity/transform tokens; }
.has-motion.is-visible & { opacity: 1; transform: none; }
```

Keep celestial thank-you signature override aligned (already safe) so it does not fight base.

**Verify:** Playwright probe — with `hasMotion+isVisible`, child opacity must not stay 0 beyond transition; SSR without `has-motion` remains visible.

### Phase 2 — F2 + F3 transition-only reveals (Important)

**Files**

- `_gifts.scss` header (drop keyframe reveal; use same transition pattern as Phase 1)
- `_event-location.scss` cards (remove animation-only reveal; add opacity to transition; pending only under `:not(.is-visible)`)
- Check enchanted-rose location/gifts overrides still compose

**Change:** one mechanism: transition opacity/transform. No `animation: motion-fade-in-up` that starts after hide rule drops.

**Verify:** early probe after scrollIntoView shows opacity interpolating; no one-frame flash to 1 then back to 0.

### Phase 3 — F5 envelope handoff (Important)

**File:** [`src/components/invitation/EnvelopeReveal.astro`](src/components/invitation/EnvelopeReveal.astro)

**Change:** After reveal, if `#inicio` is already within viewport (IntersectionObserver or rect check), skip scroll. Otherwise use `behavior: 'smooth'` only when `prefers-reduced-motion: no-preference`; keep `auto` under reduced-motion.

**Verify:** Open celestial from sealed at scrollY=0 — no layout thrash; open after letter-hold offset — soft move to hero.

### Phase 4 — F4 hero coordination (Important)

**Files**

- [`src/styles/invitation/_hero.scss`](src/styles/invitation/_hero.scss) — sealed block must also zero/reset `__title-wrapper` animation
- [`src/styles/themes/sections/hero/_celestial-blue.scss`](src/styles/themes/sections/hero/_celestial-blue.scss) — remove standalone 1s wrapper animation; rely on revealed-state label/title timeline
- [`src/styles/themes/sections/hero/_enchanted-rose.scss`](src/styles/themes/sections/hero/_enchanted-rose.scss) — same 1s delayed entrance removal/alignment

**Change:** Hero child entrances fire only under `[data-reveal-state='revealed']`. No parallel animation on `__title-wrapper` that runs while sealed. Keep delays inside revealed timeline ≤ ~0.55s for details (existing revealed block is already closer to skill bands than the old base 0.8–1.4s path).

**Verify:** Open probe — while sealed, wrapOpacity stays 0; after revealed, title/label opacity rise together without wrapper racing ahead.

### Phase 5 — F6 interludes (Important)

**Files**

- `src/lib/invitation/interlude-observer.ts` (deleted) — remove parallax scroll listeners / offset writes
- [`src/styles/invitation/_interlude.scss`](src/styles/invitation/_interlude.scss) — keep pending hide on `__media` only via `:not(.is-visible)`; stop competing transform on `__image` for parallax

**Change:** Delete parallax path (animation-motion ban). Interlude reveal = opacity + single translate on `__media`.

**Verify:** Desktop width >768 — no `--interlude-parallax-offset` updates; pending interludes mediaOp 0 only when `has-motion:not(.is-visible)`; mid-reveal no dual transform fight.

### Phase 6 — F7 stagger caps (Important)

**Files**

- [`src/styles/themes/sections/itinerary/_celestial-blue.scss`](src/styles/themes/sections/itinerary/_celestial-blue.scss)
- [`src/styles/themes/sections/itinerary/_enchanted-rose.scss`](src/styles/themes/sections/itinerary/_enchanted-rose.scss) (same 0.12s pattern)

**Change:** `transition-delay: min((n-1) * 0.08s, 0.48s)` (or equivalent `@for` with 0.08s step and cap). Keep `:not(.is-visible)` pending hide.

**Verify:** Celestial + Abril itinerary — last visible row reaches opacity ~1 within ~0.6s of section reveal.

### Phase 7 — F8 optional harden (Minor)

**File:** [`src/utils/animations.ts`](src/utils/animations.ts)

Only if Phases 1–2 still leave snap reports: on fail-open, add `is-visible` without a hard class removal flash, or shorten timeout after first successful observe. Do not weaken fail-open content safety.

## Rollout order and commits

Suggested conventional commits (when authorized to implement):

1. `fix(invitation): unify scroll-reveal pending selectors to :not(.is-visible)` — Phase 1
2. `fix(invitation): use transition-only reveals for gifts and location` — Phase 2
3. `fix(envelope): soften post-open hero scroll handoff` — Phase 3
4. `fix(hero): gate entrances to revealed state and drop stacked wrapper delay` — Phase 4
5. `fix(interlude): remove parallax and competing transforms` — Phase 5
6. `fix(itinerary): cap celestial/enchanted stagger delays` — Phase 6

Do not mix preset art refreshes into these commits.

## Verification matrix

| Check | Command / method |
| ----- | ---------------- |
| Structure / styles | `pnpm lint:styles:changed` or `pnpm lint:styles` on touched SCSS |
| Unit / related | `pnpm test:changed` if JS (`animations.ts`, interlude-observer) changes |
| Runtime probe | Re-run `temp/motion-audit/open-probe.mjs` pattern (or promote a focused e2e later) |
| Visual QA demos | Mobile 390 + desktop: celestial-blue, enchanted-rose; spot jewelry-box envelope |
| A11y | `prefers-reduced-motion: reduce` — content visible, no parallax, envelope scroll auto |
| Gatekeeper | Per `.agent/rules/gatekeeper.md` for the touch surface (styles + optional focused tests) |

Acceptance (creative-qa motion rows):

- No reveal-gated stuck hide after `is-visible`
- No sealed-state hero wrapper animation
- No desktop interlude parallax offset
- Itinerary stagger ≤ skill band
- Envelope open does not hard-jump when hero already in view

## Authorization gate

This plan is **ready to implement** but must not be executed until the repository owner explicitly
authorizes remediation. Audit artifact remains
[`.agent/plans/archived/demo-xv-celestial-blue-motion-audit.md`](../archived/demo-xv-celestial-blue-motion-audit.md).
