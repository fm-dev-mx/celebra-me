---
title: Motion Audit — demo-xv-celestial-blue
status: final
created: 2026-07-27
updated: 2026-07-27
related_skills:
  - animation-motion
  - frontend-design
  - accessibility
related_docs:
  - docs/domains/theme/motion.md
  - .agent/templates/creative/creative-qa-report.md
  - .agent/agents/celebra-qa.yaml
  - .agent/plans/active/motion-reveal-remediation.md
supersedes: []
---

# Creative QA Report — Motion Audit

## Item Under Review

| Field                    | Value                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| **Campaign**             | demo-xv-celestial-blue transition regression                          |
| **Asset type**           | Invitation / Demo                                                     |
| **Brand**                | Celebra-me                                                            |
| **Reviewer**             | celebra-qa (code audit)                                               |
| **Date**                 | 2026-07-27                                                            |
| **Brief**                | Transitions feel cheap/glitchy: pop-in, jumps after recent changes    |
| **Baseline**             | Shared scroll-reveal contract in `docs/domains/theme/motion.md`       |
| **Post-change evidence** | Static code audit (no screenshot pass in this session)                |
| **Required viewports**   | Mobile-first + desktop (visual Pass/Fail Blocked pending capture)     |

## Skills and roles used

| Load | Path | Role in this audit |
| ---- | ---- | ------------------ |
| Role `celebra-qa` | `.agent/agents/celebra-qa.yaml` | Primary READ-ONLY reviewer |
| Optional `celebra-visual-director` | `.agent/agents/celebra-visual-director.yaml` | Premium-feel judgment (checklist only) |
| Skill `animation-motion` | `.agent/skills/animation-motion/SKILL.md` | GPU props, durations, IO, antipattern bans |
| Skill `frontend-design` | `.agent/skills/frontend-design/SKILL.md` | Reveal-gated / layout-property bans; polish #8 |
| Skill `accessibility` | `.agent/skills/accessibility/SKILL.md` | Reduced-motion and content without JS |
| Template `creative-qa-report` | `.agent/templates/creative/creative-qa-report.md` | Report structure |
| Doc `motion.md` | `docs/domains/theme/motion.md` | SSR-visible + `has-motion` fail-open contract |

### Explicitly not used

| Skill | Why skipped |
| ----- | ----------- |
| `client-invitation-audit` | Real-invitation Lane A/B discovery; not demo motion regression |
| `theme-architecture` | Token/preset ownership; no token redesign in this audit |
| `staged-code-review` | Requires staged diffs; not runtime motion QA |
| `demo-content-consistency` | Date/data flicker; not CSS/JS section transitions |
| `celebra-builder` / apply skills | Remediation out of scope |

### `animation-motion` verification checklist (code)

| Check | Result | Notes |
| ----- | ------ | ----- |
| GPU-only (`transform` / `opacity`) | Pass (props) | Layout props not animated for these reveals |
| Durations 150–800ms by type | Fail | Hero delays 0.8–1.4s; premium 1s; itinerary stagger up to ~2.4s |
| Easing via tokens | Pass | Uses `--ease-*` / `--duration-*` |
| `prefers-reduced-motion` | Partial | JS skips `has-motion`; some CSS paths incomplete vs hide rules |
| IntersectionObserver (not scroll) for section reveal | Pass | `initSectionReveal` / `createIntersectionObserver` |
| No parallax / infinite loops / auto carousels | Fail | Interlude parallax in `interlude-observer.ts`; hero specular glint loops (out of F1–F8 scope) |
| Content not reveal-gated | Fail | F1–F4 gate visibility behind motion classes |

---

## Copy QA

| Check                            | Pass/Fail | Notes                          |
| -------------------------------- | --------- | ------------------------------ |
| Spanish language throughout      | N/A       | Motion-only audit              |
| Formal "usted" register          | N/A       |                                |
| No English in guest-facing text  | N/A       |                                |
| Tone consistent with brand brief | N/A       |                                |
| CTA is clear and actionable      | N/A       |                                |
| No invented client data          | N/A       |                                |
| Appropriate for event type       | N/A       |                                |
| No spelling or grammar errors    | N/A       |                                |

## Visual QA (images)

| Check                                     | Pass/Fail | Notes             |
| ----------------------------------------- | --------- | ----------------- |
| No plastic-looking skin                   | N/A       | Motion-only audit |
| Natural lighting and shadows              | N/A       |                   |
| Composition is balanced                   | N/A       |                   |
| Colors match brand palette                | N/A       |                   |
| No artifacts or deformities               | N/A       |                   |
| Resolution sufficient for intended use    | N/A       |                   |
| Style consistent with other assets in set | N/A       |                   |

## UI / Invitation Visual QA

Register: **Persuade** (guest-facing invitation demo).

| Area                                                                         | Status  | Affected section / viewport        | Evidence and notes |
| ---------------------------------------------------------------------------- | ------- | ---------------------------------- | ------------------ |
| Register named (Persuade vs Operate)                                         | Pass    | Demo invitation                    | Persuade           |
| Reference fidelity and approved deviations                                   | N/A     | —                                  | No visual brief in scope |
| Responsive behavior and reflow                                               | Blocked | mobile / desktop                   | No capture run     |
| Content legibility, contrast, and focus                                      | N/A     | —                                  | Not motion scope   |
| Typography hierarchy and consistency                                         | N/A     | —                                  |                    |
| Image resolution, crop, focal point, and treatment                           | N/A     | —                                  |                    |
| Layout rhythm, alignment, and spacing                                        | N/A     | —                                  |                    |
| Component, token, preset, and theme consistency                              | Fail    | thank-you / gifts / location       | Incomplete `:not(.is-visible)` migration vs safer sections |
| Structural anti-slop (no side-tabs, nested/ghost cards, eyebrow scaffolding) | N/A     | —                                  | Not motion scope   |
| Accessibility-relevant visual behavior and reduced motion                    | Fail    | scroll-reveal + interludes         | Reveal-gated hide; parallax banned by skill |
| Cross-page, cross-section, or sibling-preset regressions                     | Fail    | shared invitation SCSS             | F1–F3/F5/F6 replicate beyond celestial |
| Rendered technical defects, overflow, broken assets, or interaction failures | Fail    | envelope → hero; interludes        | Hard `scrollIntoView`; pop-in patterns |
| Production UI contains no temporary placeholder assets                       | N/A     | —                                  |                    |
| `frontend-design` polish checklist completed                                 | Fail    | #8 Motion                          | Reveal-gated content ban violated |

**Overall motion verdict: Fail** (code evidence). Visual viewport Pass/Fail remains **Blocked** until screenshot/browser evidence is collected.

---

## UI / Invitation Findings

Severity: `Critical` blocks safe delivery or core use; `Important` fails an approved criterion or
causes a material regression; `Minor` is observable but does not block acceptance.

| ID | Severity | Status | Section / viewport | Source file / line | Criterion | Expected | Actual | Evidence | Remediation or blocking reason | Revision owner |
| -- | -------- | ------ | ------------------ | ------------------ | --------- | -------- | ------ | -------- | ------------------------------ | -------------- |
| F1 | Critical | Fail | ThankYou, Gifts cards, Location cards / all viewports | `src/styles/invitation/_thank-you.scss` 139–150, 177–189, 213–225, 256–264; `_gifts.scss` 151–169; `_event-location.scss` 524–532 | `frontend-design` reveal-gated; `motion.md` hide only while pending | Hide only under `.has-motion:not(.is-visible)`; visible when `.is-visible` | `.has-motion` alone forces `opacity: 0%`; reveal depends on source-order sibling `.is-visible` rules | Incomplete migration vs countdown/quote/gallery/interlude safe pattern | Unify selectors to `:not(.is-visible)` — **not authorized this task** | celebra-builder (when authorized) |
| F2 | Important | Fail | Gifts header | `_gifts.scss` 51–58 | No flash; transition or single mechanism | Pending hide + same-property transition to visible | Hide via `:not` then keyframe reveal → possible one-frame flash at `opacity: 100%` before keyframe `from` | Same pattern also in enchanted-rose gifts/location overrides | Prefer transition on opacity/transform, or keep hide rule until animation fill applies — **not authorized** | celebra-builder |
| F3 | Important | Fail | Location cards | `_event-location.scss` 524–532 | Smooth reveal; no instant hide | Transitioned hide/show or safe `:not` + transition | Instant `opacity: 0` on `.has-motion`; reveal via animation `both` | Competes if animation interrupted | Align with safe family/gallery pattern — **not authorized** | celebra-builder |
| F4 | Important | Fail | Hero after envelope / celestial | `_hero.scss` 74–140; `themes/sections/hero/_celestial-blue.scss` 94–97; demos skip envelope persist (`reveal-manager.ts` 43) | Premium delayed entrance without pop-from-nowhere; skill duration bands | Coordinated single entrance after reveal | Base opacity-0 + delays 0.8–1.4s **plus** celestial `__title-wrapper` 1s delayed animation; sealed→revealed restarts | Worst on demos (always envelope) | Remove stacked delay / coordinate with envelope open — **not authorized** | celebra-builder |
| F5 | Important | Fail | Envelope open → hero | `EnvelopeReveal.astro` 250–256 | Smooth handoff; no layout jump | Soft scroll or no forced jump while hero still opacity 0 | `scrollIntoView({ behavior: 'auto' })` hard jump | Combines with F4 | Soften or defer until hero entrance starts — **not authorized** | celebra-builder |
| F6 | Important | Fail | Interludes (demo has 4) | `_interlude.scss` 66–95; `interlude-observer.ts` 28–62 | `animation-motion` bans parallax; no competing transforms | Opacity/transform on one layer; no parallax | `__media` hide/show + `__image` parallax `translate3d` | Demo JSON interludes ×4 | Disable/reduce parallax; single transform owner — **not authorized** | celebra-builder |
| F7 | Important | Fail | Itinerary celestial | `themes/sections/itinerary/_celestial-blue.scss` 236–245 | Stagger 50–100ms per skill | Short stagger within premium duration | `nth-child * 0.12s` up to 20 → ~2.4s late pop-in | Also Abril Michelle itinerary reuse | Cap stagger / lower delay — **not authorized** | celebra-builder |
| F8 | Minor | Fail | Any section using `initSectionReveal` | `src/utils/animations.ts` 69, 89–97 | Fail-open without jarring snap when possible | Graceful reveal | 8s timeout removes `has-motion` → sudden snap | Recovery path by design; edge-case feel | Document only unless threshold/rootMargin tuned — **not authorized** | celebra-builder |

---

## Antipattern detail (F1–F8)

### F1 — Critical: `.has-motion` hide without `:not(.is-visible)`

While `has-motion` is present, children stay at `opacity: 0%` even after `is-visible` is added unless a later equal-specificity rule wins. Safer sections already use:

```scss
&.has-motion:not(.is-visible) { /* hide */ }
&.is-visible { /* show */ }
```

Unsafe remaining call sites are listed in the findings table. Celestial thank-you signature overrides with the safe form in `themes/sections/thank-you/_celestial-blue.scss` 202–214 while **base** thank-you still uses the unsafe form — competing specificity.

### F2 — Important: static hide + keyframe reveal flash

`_gifts.scss` header: default visible → `.has-motion:not(.is-visible)` hides → `.is-visible` starts `animation: motion-fade-in-up`. Dropping the `:not` rule can paint full opacity for a frame before the keyframe `from` applies.

### F3 — Important: location instant hide

No transition on the pending state; cards hard-hide under `.has-motion`, then animate in under `.has-motion.is-visible`.

### F4 — Important: stacked hero entrances

Base hero children start `opacity: 0` with long delays. Celestial adds another `motion-fade-in-up` on `__title-wrapper` with `1s` delay. Envelope sealed→revealed restarts animations; demos always show the envelope (`RevealManager` skips localStorage persist for demos).

### F5 — Important: hard scroll after envelope

```ts
hero.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' });
```

Reads as a jump, especially while hero content is still opacity-gated (F4).

### F6 — Important: interlude hide + parallax

`__media` uses opacity/transform transitions; `__image` applies `--interlude-parallax-offset` via scroll listener. Violates `animation-motion` parallax ban. `demo-xv-celestial-blue.json` defines four interludes.

### F7 — Important: long celestial itinerary stagger

Safe `:not(.is-visible)` hide, but delays `0.12s * n` feel like late pop-in when the observer fires late.

### F8 — Minor: fail-open snap

`createIntersectionObserver` schedules fail-open at 8000ms; fallback removes `has-motion`, which can snap content visible.

---

## Replication matrix

| Antipattern | demo-xv-celestial-blue | Other celestial demos / profiles | Enchanted-rose / jewelry-box envelope | Shared invitation base |
| ----------- | ---------------------- | -------------------------------- | ------------------------------------- | ---------------------- |
| F1 thank-you / gifts / location | Yes | Yes (`demo-xv-xareni-profile`, `demo-baby-shower-celestial`, Xareni, América Johana, Leah Lexa) | Yes via shared `_thank-you` / `_gifts` / `_event-location` | Yes — almost all invitations with those sections |
| F2 gifts header keyframe flash | Yes | Yes | Enchanted-rose has additional gifts/location motion overrides | Yes — `_gifts.scss` |
| F3 location instant hide | Yes | Yes | + preset polish on top of base | Yes — `_event-location.scss` |
| F4 hero stack + celestial 1s delay | Yes (worst) | Yes — celestial hero SCSS | Base delays if preset does not override | Partial — base `_hero.scss` delays |
| F5 `scrollIntoView` auto | Yes (demos always envelope) | Yes | shared-light variants: celestial-blue, enchanted-rose, jewelry-box, jewelry-box-wedding | All envelope users via `EnvelopeReveal.astro` |
| F6 interlude + parallax | Yes (×4 interludes) | Content-dependent | Content-dependent | Any invitation with interludes + `interlude-observer.ts` |
| F7 itinerary stagger | Yes | Abril Michelle reuses celestial itinerary; other celestial itinerary users | Own itinerary motion where overridden | No — celestial itinerary SCSS |
| F8 fail-open 8s | Yes | Yes | Yes | Yes — `animations.ts` |

### Celestial-blue surface inventory (same section / envelope stack)

- Demos: `demo-xv-celestial-blue`, `demo-xv-xareni-profile`, `demo-baby-shower-celestial`
- Profiles / clients on celestial-blue: Xareni Iyarit, América Johana, Leah Lexa; Abril Michelle (itinerary celestial variant)
- Envelope shared-light: `reveal/_shared-light.scss` variants listed above

### Shared scroll-reveal infrastructure (not celestial-only)

- JS: `src/utils/animations.ts` (`initSectionReveal`), `src/lib/invitation/interlude-observer.ts`, `src/lib/invitation/reveal-manager.ts`
- Sections calling reveal: Family, EventLocation, PhotoGallery, ThankYou, Gifts, Countdown, Quote, Itinerary, Interlude
- Safer migrated patterns already present in: countdown, quote, gallery, interlude media, family reveal (progressive), celestial thank-you signature override

---

## Technical QA

| Check                                | Pass/Fail | Notes |
| ------------------------------------ | --------- | ----- |
| Generation parameters logged         | N/A       | Not generative assets |
| Seed recorded for reproducibility    | N/A       | |
| File format and size appropriate     | N/A       | |
| Aspect ratio matches target platform | N/A       | |
| Code paths cited with line evidence  | Pass      | F1–F8 above |
| Remediation applied                  | N/A       | Explicitly out of scope |

---

## Issues Found

### Critical (must fix before delivery)

1. **F1** — Incomplete `.has-motion:not(.is-visible)` migration on thank-you, gifts cards, and location cards causes pop-in / flash / stuck-hide risk across nearly all invitations.

### Important (should fix)

1. **F2** — Gifts header keyframe reveal can flash one frame.
2. **F3** — Location cards hard-hide without transition.
3. **F4** — Hero + celestial stacked delayed entrances after envelope.
4. **F5** — Envelope `scrollIntoView({ behavior: 'auto' })` hard jump.
5. **F6** — Interlude parallax + competing transforms (skill ban); amplified by 4 interludes on this demo.
6. **F7** — Celestial itinerary stagger delays too long.

### Minor (nice to have)

1. **F8** — 8s fail-open can snap content visible.

---

## Overall Assessment

| Verdict | Description |
| ------- | ----------- |
| Fail    | Motion criteria fail on code evidence (reveal-gated content, parallax, hard jump, stacked/long delays). Viewport screenshot Pass/Fail is Blocked until a capture pass. |

---

## Notes / Recommendations

- **No code changes in this audit.** Remediation requires explicit authorization.
- Suggested fix order when authorized: **F1 → F3/F2 → F5 → F4 → F6 → F7** (F8 optional).
- Follow-up evidence: mobile + desktop captures of (1) envelope → hero, (2) first interlude enter, (3) location / gifts / thank-you reveal, (4) compare `demo-xv-enchanted-rose` (same shared-light stack).
- `graphify-out/` is stale vs HEAD and has no motion hubs; not used as authority.
- Regression window context: shared scroll-reveal introduction + incomplete `:not(.is-visible)` migration, amplified by celestial envelope/wax refresh commits (`363c02b5`, `0a09f47f`, `2a2949c8`, `2b1e5b87`, `a0b59c31`, envelope wax series).

## Scope confirmation

- SCSS/JS: **unchanged**
- Git stage/commit: **none**
- Status of this artifact: **final** (audit complete; remediation is a separate authorized task)

---

## Evidence revalidation (2026-07-27)

Runtime probes against local `localhost:4321` (Playwright + browser CDP). Artifacts in
`temp/motion-audit/` (gitignored). Comparison demo: `demo-xv-enchanted-rose`.

| ID | Visual / runtime status | Notes |
| -- | ----------------------- | ----- |
| F1 | Confirmed | Gifts cards / thank-you children at opacity 0 while `hasMotion+isVisible` |
| F2 | Confirmed | Gifts header uses `motion-fade-in-up` during reveal |
| F3 | Confirmed | Location cards mid-animation from ~0.12 opacity |
| F4 | Confirmed (worse) | `__title-wrapper` animates while sealed; title stays 0 until ~3.5s reveal |
| F5 | Partial | No scrollY jump when already at top; hard `scrollIntoView` still code risk |
| F6 | Confirmed | Pending interludes mediaOp 0; mid-reveal compete; desktop parallax −283px earlier |
| F7 | Confirmed | Itinerary delays 0.12–0.60s; late rows still opacity 0 at +900ms |
| F8 | Deferred | Not re-timed |

Remediation plan: [`.agent/plans/active/motion-reveal-remediation.md`](../active/motion-reveal-remediation.md).
