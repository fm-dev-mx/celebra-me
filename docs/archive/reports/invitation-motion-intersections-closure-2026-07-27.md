# Invitation motion and intersections implementation closure

**Closure date:** 2026-07-27 **Case studies:** `abril-michelle-becerra-rea` and
`demo-xv-celestial-blue` **Implementation status:** complete and verified **Authority:**
point-in-time implementation evidence; active rules remain in the canonical docs linked below

## Outcome

Celebra-me now has one accessible invitation reveal coordinator and one explicit
section-intersection contract. Abril and Celestial use the system without content,
information-architecture, or visual identity changes. The public locked Abril RSVP is server-only;
the Celestial demo keeps its lazy interactive RSVP island.

The active authorities are:

- [`docs/domains/theme/motion.md`](../../domains/theme/motion.md) for motion categories, timing,
  reveal recipes, hero roles, observer behavior, progressive enhancement, and reduced motion.
- [`docs/domains/theme/section-intersections.md`](../../domains/theme/section-intersections.md) for
  the closed intersection family and render metadata.
- [`docs/domains/theme/architecture.md`](../../domains/theme/architecture.md) for behavior-named
  section variants and the `timeline-paper` compatibility policy.
- [`docs/core/architecture.md`](../../core/architecture.md) for the render-plan, reveal-coordinator,
  and locked-RSVP server/client boundaries.

Operational skills now link to those authorities instead of restating conflicting values. Archived
plans and audits are explicitly non-authoritative historical evidence.

## Implementation map

### Shared runtime

- `src/lib/invitation/motion-coordinator.ts` owns one invitation reveal observer signature:
  `threshold: 0.12`, `rootMargin: 0px 0px -12% 0px`.
- The coordinator preserves SSR visibility, applies `has-motion` only after successful observer
  registration, reveals once, unobserves completed sections, fails open on missing/throwing
  observers, and has an eight-second fail-open timeout.
- `src/styles/invitation/_motion-system.scss` implements the closed recipe set: `none`, `fade`,
  `fade-up`, `media-scale`, and `stagger-group`.
- Item staggering is CSS-driven through `data-reveal-item`; no item creates its own observer.
- `InvitationSections.astro` initializes the coordinator once for the document.

### Explicit intersections

`src/lib/invitation/intersection-profiles.ts` maps composition-profile IDs and rendered boundaries
to render-plan metadata. `render-plan.ts` and `section-render-data.ts` carry that metadata to stable
wrapper attributes:

- `data-section-kind`
- `data-intersection`
- `data-intersection-source`
- `data-reveal`

`src/styles/invitation/_section-intersections.scss` owns reusable `neutral`, `arch`, `overlap`, and
`atmospheric-blend` mechanics. Profiles supply art-direction tokens and scoped surface treatments;
they do not infer structure from slugs, `nth-*`, screenshot order, or sibling adjacency.

Celestial intentionally publishes exactly two non-neutral treatments:

| Rendered boundary    | Family              | Source     |
| -------------------- | ------------------- | ---------- |
| location → interlude | `arch`              | `location` |
| RSVP → interlude     | `atmospheric-blend` | `rsvp`     |

All other Celestial boundaries are neutral. Abril retains its approved editorial overlap, blend, and
arch language through explicit profile mappings.

### Behavior variants

The reusable paper itinerary is now named `timeline-paper`. New content, including the Abril
provision definition, uses that behavior ID. `celestial-blue` remains a thin stored-content and SCSS
compatibility alias, and both names resolve to the same structure during migration. Celestial no
longer imports a location treatment owned by another invitation; Leah owns its own location import.

### RSVP boundary

`LockedRsvpPreview.astro` renders public `personalized-only` RSVP content when no guest context is
available. That branch contains no `astro-island`, does not import React or Framer Motion, and uses
the static `locked` state. Demo and guest-backed RSVP states keep the existing lazy React island and
short bounded state transitions.

## Reduced-motion result

The final accessibility layer is rooted in stable invitation/component selectors, not `has-motion`.
Under `prefers-reduced-motion: reduce`:

- entrance and ambient animations are disabled;
- all reveal content is in its final visible state;
- transition and animation delays are zero;
- location, countdown, gallery, music, and related hover targets do not translate, scale, or tilt;
- immediate non-geometric feedback remains available;
- gallery keyboard opening, close-button focus, Escape handling, and trigger-focus restoration are
  unchanged.

The browser suite compares pre/post hover geometry and computed styles for both case studies. It
also verifies the ordinary-motion hero, reveal, and interaction budgets and traverses the complete
page by keyboard, including the gallery, location controls, and Celestial RSVP. All assertions
passed at 390 × 844.

## Runtime evidence

### Observers and layout stability

Measurements use a pre-navigation `IntersectionObserver` wrapper and buffered layout-shift observer,
followed by a complete section scroll pass at 390 × 844.

| Case      | Before instances | Before observed targets | Before signatures | After instances | After invitation reveal signatures | After CLS |
| --------- | ---------------: | ----------------------: | ----------------: | --------------: | ---------------------------------: | --------: |
| Celestial |               12 |                      26 |                 7 |               3 |                                  1 | 0.0007755 |
| Abril     |               10 |                      19 |                 6 |               1 |                                  1 | 0.0004562 |

The two extra Celestial observers use the neutral browser defaults and belong to lazy client
visibility/engagement behavior. The invitation section-reveal system uses exactly one signature in
both routes. Both totals are within the fixed maximum of three observers.

### Horizontal overflow

Both routes pass `scrollWidth <= clientWidth` at 320, 360, 390, 430, and 1440 CSS pixels. Abril's
pre-change one-pixel overflow is gone. The shared arch clips itself; no page-level blanket
`overflow-x: hidden` fix was introduced.

### JavaScript-disabled behavior

Both routes return HTTP 200 with JavaScript disabled, produce no `has-motion` elements, and leave
all audited sections visible. The locked RSVP remains complete static HTML.

### RSVP requests

After scrolling the Abril RSVP into view, the browser recorded:

- zero RSVP islands in the locked wrapper;
- zero requests matching the RSVP chunk, Framer Motion, or `use-reduced-motion` graph.

Celestial retains one lazy RSVP island; its attendance control remains interactive.

## Production bundle comparison

Both measurements came from successful client builds; the final build also completed the Vercel
server bundle.

| Artifact                          |      Before |       After |             Delta |
| --------------------------------- | ----------: | ----------: | ----------------: |
| emitted client JS files           |          63 |          52 |               -11 |
| total emitted client JS           | 1,191,774 B | 1,186,341 B | -5,433 B (-0.46%) |
| RSVP chunk                        |    35,005 B |    34,323 B |   -682 B (-1.95%) |
| shared `use-reduced-motion` chunk |   126,055 B |   126,055 B |         unchanged |

No dependency was added. The shared Framer Motion graph correctly remains available to interactive
surfaces, while the locked route no longer requests it.

## Screenshot evidence

Before captures:

- `output/playwright/motion-intersections/baseline/celestial-390-full.png`
- `output/playwright/motion-intersections/baseline/abril-390-full.png`
- `output/playwright/motion-intersections/baseline/celestial-1440-full.png`
- `output/playwright/motion-intersections/baseline/abril-1440-full.png`

After captures exist for both routes at every required viewport:

- `output/playwright/motion-intersections/after/{celestial,abril}-320-full.png`
- `output/playwright/motion-intersections/after/{celestial,abril}-360-full.png`
- `output/playwright/motion-intersections/after/{celestial,abril}-390-full.png`
- `output/playwright/motion-intersections/after/{celestial,abril}-430-full.png`
- `output/playwright/motion-intersections/after/{celestial,abril}-1440-full.png`

The after captures scroll every rendered wrapper first, wait for the bounded one-time reveals to
settle, and then capture lazy images and the interactive demo RSVP. Manual visual review found no
clipped content, unintended identity shift, or new hard boundary. Abril's locked RSVP and both
galleries are visible in the mobile captures.

## Finding disposition

| Finding                                 | Severity | Disposition | Closure evidence                                                                            |
| --------------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------- |
| F-01 contradictory guidance             | High     | Resolved    | One normative motion authority; animation and accessibility skills are thin loaders.        |
| F-02 reduced-motion transforms          | High     | Resolved    | Stable final accessibility layer plus computed-style and geometry browser assertions.       |
| F-03 theme/effect conflation            | Medium   | Resolved    | `timeline-paper` behavior ID, documented alias, and cross-theme import cleanup.             |
| F-04 observer fan-out                   | Medium   | Resolved    | One document coordinator and one reveal signature; 12→3 and 10→1 total instances.           |
| F-05 static RSVP hydration              | Medium   | Resolved    | Server-only locked Astro branch; zero island and client-graph requests.                     |
| F-06 brittle Abril intersections        | Medium   | Resolved    | Explicit render-plan profile metadata and reusable primitives; forbidden selectors removed. |
| F-07 nonexistent parallax terminology   | Low      | Resolved    | Canonical docs describe ambient scale/drift and explicitly exclude parallax.                |
| F-08 neutral-only Celestial transitions | Low      | Resolved    | Exactly two restrained narrative-pivot intersections, all others neutral.                   |
| F-09 Abril overflow boundary            | Low      | Resolved    | Self-clipping arch and zero overflow at all five required widths.                           |
| F-10 unnamed hero sequencing            | Low      | Resolved    | Named media/eyebrow/title/details/affordance roles and bounded role tokens.                 |

## Changed surfaces and purpose

- **Authority:** motion, intersection, theme architecture, content-section, core architecture, and
  gallery docs; animation/accessibility operational skills.
- **Contracts and assembly:** theme contract, section-style schema, event adapter, intersection
  profiles, render plan, section render descriptors, and Celestial explicit visual profile ID.
- **Runtime:** invitation coordinator, shared motion/intersection SCSS, hero role metadata/tokens,
  reveal item markers, and removal of section-local reveal/interlude observers.
- **Theme migration:** Abril profile/provision definition, Celestial and Leah bundle ownership,
  `timeline-paper` implementation, and the legacy alias.
- **RSVP:** locked Astro component, Astro render-mode split, and interactive-only React/Framer path.
- **Tests:** coordinator unit coverage, explicit intersection/render-plan assertions, reduced
  motion, overflow, no-JS, focus, RSVP request-boundary E2E coverage, and deterministic Jest asset
  discovery.

## Validation record

Commands completed successfully:

- `pnpm type-check`
- `pnpm validate:structure`
- `pnpm lint`
- `pnpm lint:styles`
- `pnpm validate:ui-governance`
- `pnpm validate:event-parity`
- `pnpm validate:no-pii`
- `pnpm ops check-links`
- `pnpm test -- --runInBand --silent` — 339 suites passed, 1 intentionally skipped; 4,140 tests
  passed, 1 intentionally skipped
- `pnpm test:e2e:ci` — 36 passed
- `pnpm exec playwright test tests/e2e/invitation-motion-system.spec.ts --project=chromium` — 24
  passed
- `pnpm build` — Astro SSR and Vercel server bundle completed

The final Git safety result and exact `git status --short` are recorded in the task handoff because
the worktree already contained staged owner changes when implementation began. No commit was created
by this task.
