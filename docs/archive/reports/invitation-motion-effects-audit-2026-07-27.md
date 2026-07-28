# Invitation transitions, animation, and visual-effects audit

**Audit date:** 2026-07-27  
**Case studies:** `abril-michelle-becerra-rea` and `demo-xv-celestial-blue`  
**Status:** implementation-ready point-in-time audit; not an active architecture authority  
**Scope:** invitation-page transitions, entrance animation, ambient motion, interactive motion,
section intersections, overlays, textures, masks, gallery behavior, and motion accessibility

## Executive conclusion

Celebra-me already has the pieces of a premium motion system: semantic tokens, SSR-first content,
fail-open intersection reveals, reduced-motion branches, editorial section intersections, themed
overlays, and a capable lightbox. The rendered pages are readable without JavaScript, do not show
meaningful section-driven layout shift, and produce no console errors in the audited paths.

The implementation is not yet one coherent system. Its active written authorities disagree about
allowed durations and continuous animation; reduced-motion protection fails for several hover
effects in both case studies; each section creates its own observer; effect variants are frequently
named after themes rather than behaviors; and the locked Abril RSVP hydrates React and Framer Motion
even though it is static. Abril demonstrates a strong editorial transition language, but that
language is encoded through slug- and screenshot-order selectors. Celestial Blue demonstrates the
neutral baseline, but its boundaries remain mostly straight and its cross-theme style imports make
ownership difficult to understand.

The recommended implementation goal is:

> Establish one documented, accessible invitation motion and intersection system, then migrate the
> two case studies to it without changing their content, information architecture, or visual
> identity.

This is one cross-cutting implementation goal, not a request for another discovery phase. It should
be delivered with bounded checkpoints: align authority; fix reduced motion; consolidate observation;
extract reusable intersection/effect primitives; avoid static RSVP hydration; then visually verify
both invitations.

## Audit method and evidence boundary

The audit combined repository authority review, live-code tracing, architecture-graph queries, and
direct browser verification against the local Astro server. Browser checks covered 390 × 844 and
1440 × 900 viewports, ordinary and reduced motion, JavaScript-disabled rendering, section-by-section
scrolling, gallery dialogs, RSVP hydration, console output, overflow, and layout shift.

The report distinguishes three evidence classes:

- **Active authority:** current owner instructions, rules, canonical domain documentation, schemas,
  and live implementation.
- **Case-study evidence:** invitation-specific documentation, content JSON, profile SCSS, rendered
  measurements, and current browser behavior.
- **Historical context:** archived plans and reports. These can explain intent but cannot override
  current code or active documentation.

Development-server transfer sizes are intentionally excluded from performance conclusions. They are
unbundled and are not valid production byte measurements.

## Inventory and authority map

| Source                                                                                         | Purpose in this audit                                                                    | Validity                                                      | Authority                                 |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------- |
| `AGENTS.md`                                                                                    | Repository boundaries, language, architecture, validation, and final-report requirements | Current                                                       | Repository-wide authority                 |
| `.agent/rules/gatekeeper.md`                                                                   | Review severity, remediation discipline, and validation tier                             | Current                                                       | Active rule                               |
| `.agent/rules/git-safety.md`                                                                   | Worktree preservation and closing safety check                                           | Current                                                       | Active rule                               |
| `.agent/rules/agent-routing.md`                                                                | Role and skill routing                                                                   | Current                                                       | Active rule                               |
| `.agent/workflows/system-doc-alignment.md`                                                     | Documentation/code alignment method                                                      | Current                                                       | Active workflow                           |
| `.agent/skills/animation-motion/SKILL.md`                                                      | Motion design guidance                                                                   | Current but internally and externally contradictory; see F-01 | Operational guidance below canonical docs |
| `.agent/skills/accessibility/SKILL.md`                                                         | Reduced-motion and interaction constraints                                               | Current                                                       | Operational guidance                      |
| `.agent/skills/astro-patterns/SKILL.md`                                                        | SSR/client-boundary expectations                                                         | Current                                                       | Operational guidance                      |
| `.agent/skills/theme-architecture/SKILL.md`                                                    | Theme and variant ownership                                                              | Current                                                       | Operational guidance                      |
| `.agent/skills/documentation-governance/SKILL.md`                                              | Placement and lifecycle of this report                                                   | Current                                                       | Operational guidance                      |
| `docs/core/architecture.md`                                                                    | Page, content, component, and server/client boundaries                                   | Current                                                       | Canonical architecture                    |
| `docs/core/project-conventions.md`                                                             | Platform and implementation conventions                                                  | Current                                                       | Canonical convention                      |
| `docs/domains/content/section-contracts.md`                                                    | Section data/rendering contracts                                                         | Current                                                       | Canonical domain authority                |
| `docs/domains/theme/architecture.md`                                                           | Theme bundle and section-style model                                                     | Current                                                       | Canonical theme authority                 |
| `docs/domains/theme/motion.md`                                                                 | Semantic motion tokens and reveal hard contract                                          | Current                                                       | Canonical motion authority                |
| `docs/domains/theme/section-intersections.md`                                                  | Neutral boundaries and approved arch, overlap, and blend patterns                        | Current                                                       | Canonical intersection authority          |
| `docs/domains/theme/gallery-variants.md`                                                       | Gallery variant behavior and known bundle coupling                                       | Current                                                       | Canonical gallery authority               |
| `docs/invitations/abril-michelle-becerra-rea.md`                                               | Abril-specific visual and content intent                                                 | Current case documentation                                    | Invitation-scoped evidence                |
| `src/pages/[eventType]/[slug].astro`                                                           | Route composition and theme/profile selection                                            | Live                                                          | Implementation truth                      |
| `src/components/invitation/InvitationSections.astro`                                           | Render plan, section wrappers, and RSVP island boundary                                  | Live                                                          | Implementation truth                      |
| `src/content/config.ts`, section schemas, and theme contracts                                  | Legal content and variant values                                                         | Live                                                          | Implementation truth                      |
| `src/utils/animations.ts`                                                                      | Intersection observer and reveal lifecycle                                               | Live                                                          | Implementation truth                      |
| `src/styles/global/_animations.scss` and motion tokens                                         | Shared keyframes, reveal classes, and semantic values                                    | Live                                                          | Implementation truth                      |
| `src/components/invitation/**` and `src/lib/invitation/interlude-observer.ts`                  | Section-local motion initialization and interlude behavior                               | Live                                                          | Implementation truth                      |
| `src/styles/invitation/**`, `src/styles/themes/**`, and `src/styles/invitation-profiles/**`    | Base, preset, section, and invitation-specific effects                                   | Live                                                          | Implementation truth                      |
| `scripts/provision/invitations/abril-michelle-becerra-rea.ts`                                  | Abril section order, variants, and media                                                 | Canonical single-file definition                              | Invitation-scoped implementation evidence |
| `src/content/event-demos/xv/demo-xv-celestial-blue.json`                                       | Celestial demo content, interludes, and RSVP mode                                        | Live case content                                             | Implementation truth                      |
| `.agent/plans/archived/demo-xv-celestial-blue-motion-audit.md` and archived transition reports | Prior observations and intent                                                            | Historical; some component claims are stale                   | Background only                           |
| `graphify-out/graph.json`                                                                      | Optional dependency and render-path leads                                                | Generated, non-authoritative                                  | Corroborating evidence only               |

### Authority differences requiring correction

The canonical motion document defines a 1.6-second reveal duration and a 14-second ambient duration.
The animation skill describes 400–600 ms reveals, 500–800 ms page transitions, prohibits continuous
loops, and characterizes interactions longer than one second as disallowed. The same skill also
contains a 1.2-second premium fade example. Live code contains 1.2–1.6 second hero entrances and 2-,
8-, and 14-second repeating ambient effects. These statements cannot all serve as normative rules
without distinguishing entrance, ambient, and interaction feedback.

The motion document also refers to interlude “parallax.” The live observer sets focal position,
lighting, overlay values, and reveal state; it performs no scroll-position transform math. The live
effect is ambient scaling, not parallax.

Archived plans mention implementation shapes that no longer exist, including an older countdown
component split. They remain useful provenance but must not be used as a present-tense inventory.

## Live implementation map

```text
route page
  -> content + theme/profile resolution
  -> InvitationSections render plan
     -> SSR Astro section markup
     -> section-local initSectionReveal() calls
        -> one IntersectionObserver per initialized section
        -> has-motion only after observer setup
        -> is-visible on intersection or fail-open
     -> RSVP React island (client:visible)
        -> Framer Motion for the interactive flow and the static locked preview branch
```

### Techniques currently present

| Technique                  | Implementation                                                                   | Current intensity     | Assessment                                                                |
| -------------------------- | -------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------- |
| Hero load entrance         | CSS opacity/transform keyframes with staggered delays                            | Editorial             | Keep, but standardize timing roles and ensure early readable content      |
| Section reveal             | `initSectionReveal()` plus `has-motion`/`is-visible`                             | Subtle to editorial   | Keep the fail-open contract; consolidate observers                        |
| Item stagger               | Section-specific delays for timeline, gallery, location, gifts, and family items | Editorial             | Keep within short bounded sequences; avoid long cumulative waits          |
| Interlude ambient scale    | 14-second alternating media scale                                                | Subtle ambient        | Keep only under `no-preference`; name accurately                          |
| Hero specular/scroll hints | 8-second specular loop and 2-second bounce                                       | Decorative            | Retain sparingly; stop under reduced motion                               |
| Card hover lift/tilt       | Transform, shadow, and occasional 3D rotation                                    | Subtle to editorial   | Keep only when reduced-motion behavior is reliable                        |
| Gallery mosaic             | Theme/profile grids and role-like placements                                     | Editorial             | Keep; separate layout behavior from theme naming                          |
| Gallery lightbox           | Native dialog behavior with focused close control                                | Editorial interaction | Keep; it worked in both case studies                                      |
| Section arch               | Pseudo-element/SVG mask at the Abril RSVP boundary                               | Editorial             | Promote as a reusable capability after removing screenshot-order coupling |
| Layered overlap            | Negative-margin interludes in Abril                                              | Editorial             | Keep as an opt-in intersection variant with mobile clamps                 |
| Atmospheric blend          | Gradient/texture blending at selected Abril boundaries                           | Editorial             | Keep as an opt-in visual treatment                                        |
| Static texture/overlay     | Theme gradients, overlays, grain/light treatments, and SVG filters               | Editorial             | Keep; isolate ownership and watch compositing cost                        |
| RSVP state transitions     | Framer Motion inside the React island                                            | Subtle interaction    | Keep for interactive RSVP states; do not hydrate the static locked branch |
| Scroll parallax            | No live implementation found                                                     | None                  | Do not add for this implementation goal                                   |

### Rendered section order

The order matters because intersection treatments must operate on rendered neighbors, not JSON key
order or inferred slugs.

**Celestial Blue:** hero → quote → personalized access → family → interlude → gallery → countdown →
location → interlude → itinerary → interlude → RSVP → interlude → gifts → thank-you.

**Abril:** hero → quote → interlude → family → countdown → location → interlude → itinerary →
gallery → gifts → locked RSVP → thank-you. Personalized access is absent in the audited public
context.

## Rendered behavior findings

### Mobile, 390 × 844

- Both heroes occupy one viewport height and transition into readable quote sections.
- Celestial uses four full-viewport interludes. Its ordinary section boundaries are straight: no
  wrapper margin, clipping, mask, or elevated stacking was observed.
- Abril uses two interludes with approximately `-100.8px` overlap at the tested viewport and
  elevated stacking. Its RSVP boundary uses the documented arch/mask treatment.
- Observer setup produced 11 `IntersectionObserver` instances and 25 observed targets in Celestial;
  Abril produced 10 instances and 19 targets.
- Sections below the fold received `has-motion` and stayed pending until observed. Scrolling caused
  them to receive `is-visible` as expected.
- Gallery dialogs opened in both invitations, exposed the “Vista ampliada de la imagen” dialog, and
  moved focus to the close button.
- No console errors or warnings were observed after scrolling and gallery interaction.

### Desktop, 1440 × 900

- Celestial had no horizontal overflow (`scrollWidth` 1425 for a 1440 viewport). Its locations form
  a balanced row and its gallery uses a varied multi-column mosaic.
- Abril measured one CSS pixel wider than the viewport (`scrollWidth` 1441). This is within the
  repository’s existing one-pixel tolerance but is consistent with the arch’s negative inset and
  should not be allowed to grow.
- Abril locations form a three-card row. Its gallery uses two columns plus a wider feature image.
- Abril interlude wrappers retained the mobile editorial overlap and elevated stacking; Celestial
  retained neutral boundaries.

### JavaScript-disabled behavior

Both routes returned complete SSR content with all audited sections. No section acquired
`has-motion`, so the observer-dependent hidden state was never activated. Hero CSS entrances
completed without JavaScript; after three seconds no audited content remained at zero opacity. The
Abril hero’s final entrance can remain delayed for roughly 1.65 seconds, which is readable but near
the upper end of a defensible load sequence. RSVP content also rendered server-side: Celestial
showed its RSVP content and Abril showed the locked explanation.

### Reduced motion

Initial entrance/reveal behavior was broadly fail-safe: the tested pages had no hidden sections,
hero animation durations collapsed to approximately `0.01ms`, and interlude ambient animation
stopped.

Interactive motion is not fully disabled:

- Celestial’s location card retained one-second transitions and moved about five pixels during a
  reduced-motion hover check.
- Abril’s location card retained a one-second transform with lift and 3D rotation.
- Abril’s countdown segment retained a 600 ms hover transition and moved about eight pixels.
- The base location reduced-motion selector depends on `.event-location.has-motion`; the reduced
  branch returns before applying `has-motion`, so that selector cannot protect the element. Later
  preset/profile declarations also win in the cascade.

### Layout stability and hydration

The section/reveal system did not produce significant measured layout movement. Abril recorded zero
layout-shift entries during the scripted section pass. Celestial recorded a cumulative value of
approximately `0.015`; both entries were attributed to the floating music-player control, not a
section transition.

The `client:visible` RSVP island remained server-rendered at the top of the page and hydrated when
it approached the viewport. This is appropriate for Celestial’s interactive RSVP. Abril’s public
locked RSVP follows the same island and Framer Motion path even though the rendered state is static.
The cost is real, but production bundle measurement is required before assigning byte savings.

## Severity-ranked findings

### F-01 — High — Active motion guidance is contradictory

**Evidence:** `docs/domains/theme/motion.md` defines 1.6-second reveal and 14-second ambient tokens.
`.agent/skills/animation-motion/SKILL.md` gives shorter normative ranges, prohibits continuous
loops, contains a 1.2-second example, and does not distinguish ambient motion from UI feedback. Live
hero and interlude code follows yet another combination.

**Impact:** A future implementation cannot demonstrate compliance. Reviewers can reject the same
effect under one active document and accept it under another. Copy-pasted one-off timings and
unnecessary rewrites are likely.

**Recommendation:** Make `docs/domains/theme/motion.md` the sole normative timing/effect authority.
Define separate budgets for initial entrance, in-view reveal, direct interaction feedback, and
ambient decoration. Convert the skill to a thin operational guide that links to those budgets.
Resolve its internal 1.2-second contradiction. State explicitly that bounded ambient loops may run
only under `prefers-reduced-motion: no-preference` and must not communicate required information.

### F-02 — High — Reduced-motion hover transforms survive in both case studies

**Evidence:** Direct reduced-motion hover checks found motion on Celestial and Abril location cards
and on Abril countdown segments. The base location override targets `.has-motion`, but reduced-mode
initialization never applies that class; preset/profile declarations also override earlier rules.

**Impact:** The implementation violates its hard accessibility contract precisely for users who ask
for less motion. Tilt and lift are vestibularly riskier than opacity-only feedback.

**Recommendation:** Apply reduced-motion overrides to stable component roots without depending on
runtime reveal classes. Place final overrides after variant/profile declarations or use cascade
layers with an explicit accessibility layer. Under reduced motion, replace transform-based hover
with immediate color, border, or shadow feedback. Add computed-style browser assertions for all
interactive cards in both cases.

### F-03 — Medium — Effect behavior is conflated with theme identity

**Evidence:** Several section variant types are aliases of `ThemePreset`. Abril selects a
`celestial-blue` itinerary variant and retints it in its profile. The Celestial bundle imports a
location treatment named for another invitation/theme lineage. Gallery documentation already notes
that variant CSS is loaded through the active theme bundle, making cross-theme selection unreliable.

**Impact:** A variant value suggests reusable behavior but often works only because a particular
bundle imports its CSS. Visual reuse becomes implicit, cross-theme combinations fail silently, and
removing a theme can break unrelated invitations.

**Recommendation:** Separate behavioral/structural variant IDs from palette/theme IDs. Use names
such as `timeline-paper`, `gallery-editorial-feature`, `location-glass-cards`, `intersection-arch`,
and `reveal-staggered`. Keep color and typography in theme tokens. Until migration is complete,
document legacy aliases and test every legal cross-theme variant.

### F-04 — Medium — Section-local initialization creates observer fan-out

**Evidence:** The mobile rendered pass created 11 observers for 25 targets in Celestial and 10 for
19 targets in Abril. Quote, personalized access, family, countdown, location, itinerary/timeline,
gallery, gifts, interlude, and thank-you initialize observation independently.

**Impact:** Native observers are efficient, but duplicating nearly identical instances makes failure
handling, threshold changes, debugging, and tests more complex. It increases the chance that one
section drifts from the fail-open contract.

**Recommendation:** Introduce a document-scoped observer pool keyed by threshold/root-margin
options, or one invitation reveal coordinator. Preserve progressive enhancement: SSR visible, add
`has-motion` only after successful registration, reveal once, enforce the existing timeout, and
immediately reveal under reduced motion. Keep item staggering in CSS rather than creating an
observer per item.

### F-05 — Medium — The static locked RSVP pays the interactive island cost

**Evidence:** `InvitationSections.astro` mounts RSVP as `client:visible`. `RSVP.tsx` imports Framer
Motion before returning its locked preview branch. Abril’s public route renders that static branch,
then hydrates the same React island when scrolled into view.

**Impact:** A static explanatory block incurs hydration and interactive motion-module parsing. It
also blurs the project’s Astro server/client boundary.

**Recommendation:** Decide the locked/public state in Astro and render a server-only
`LockedRsvpPreview.astro`. Mount the React island only when the resolved RSVP mode can become
interactive. Keep Framer Motion for meaningful RSVP state transitions; do not remove the dependency
globally because other live interfaces use it. Verify actual production chunks before and after.

### F-06 — Medium — Abril’s successful intersections are not reusable yet

**Evidence:** Abril implements the approved overlap, atmospheric blend, and arch families, but
selectors depend on the invitation slug, screenshot-section order, and adjacency. The active
intersection document explicitly permits profile-specific proof while a pattern is being validated.

**Impact:** The case study proves the visual direction but copying its selectors would spread
brittle content-order assumptions. Inserting or omitting a section can move an effect to the wrong
boundary.

**Recommendation:** Retain Abril as the reference implementation, then add explicit render-plan
metadata/classes for the incoming and outgoing intersection. Extract reusable arch, overlap, and
blend primitives driven by CSS custom properties. Keep invitation-specific art direction in the
profile as token values, not structural `nth`/order logic.

### F-07 — Low — Interlude terminology claims parallax that does not exist

**Evidence:** Active prose refers to parallax, while `interlude-observer.ts` sets CSS variables and
reveal state only. Search found no scroll-position transform calculation in the invitation path.

**Impact:** Maintainers may search for nonexistent behavior, overestimate runtime complexity, or add
duplicate scroll code.

**Recommendation:** Rename the documented behavior to ambient image drift/scale. If parallax is ever
proposed, treat it as a separate opt-in capability with performance and reduced-motion proof. It is
not recommended for the current implementation goal.

### F-08 — Low — Celestial does not demonstrate the documented transition language

**Evidence:** Its section wrappers showed straight boundaries with no mask, clip, overlap, or
elevated stacking. Four full-height interludes provide rhythm, but adjacent content sections do not
use the approved intersection families.

**Impact:** The demo presents each section well but does not serve as a convincing reusable showcase
for the intersection system. Repeated full-screen interludes also lengthen the page substantially.

**Recommendation:** Keep neutral boundaries as the default. Apply at most two restrained approved
intersections at narrative pivots—for example location → interlude and RSVP → interlude/gifts—and
evaluate whether every full-height interlude earns its scroll cost. Do not reproduce Abril
wholesale.

### F-09 — Low — Abril is at the horizontal-overflow tolerance boundary

**Evidence:** At 1440 pixels, rendered width measured 1441 pixels. The arch uses a small negative
horizontal inset.

**Impact:** It currently meets the repository’s one-pixel tolerance, but rounding, zoom, or future
shadow/mask changes could create a visible horizontal scrollbar.

**Recommendation:** Make the arch primitive self-clipping and test it at the five documented
intersection viewports plus zoomed desktop. Avoid page-level `overflow-x: hidden` as a blanket fix.

### F-10 — Low — Hero sequencing is coherent but not governed by named roles

**Evidence:** Celestial’s observed entrance sequence ends around 1.2 seconds; Abril’s later content
can finish around 1.65 seconds. Durations and delays are authored directly across base, preset, and
profile SCSS.

**Impact:** Small changes can elongate the total sequence or cause two layers to compete. The first
screen remains readable, but future profiles may cross into ornamental delay.

**Recommendation:** Define named hero roles (`media`, `eyebrow`, `title`, `details`, `affordance`)
and a maximum sequence end. Keep the title prioritized, never delay primary information behind an
ambient loop, and collapse all roles under reduced motion.

## Section-by-section recommendations

“Maximum” is the strongest treatment recommended for routine use, not a target every invitation must
reach.

| Section                       | Purpose                                         | Current case-study behavior                                                                              | Viable reusable variants                                                                 | Avoid                                                                                                   | Maximum                                                   |
| ----------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Hero                          | Establish identity and first emotional beat     | Both use layered CSS entrances; Abril is slower and more cinematic; both include decorative ambient cues | `hero-entrance-editorial`, `hero-entrance-minimal`, static-first reduced mode            | Letter-by-letter title motion, scroll-linked parallax, delayed essential text, multiple competing loops | Editorial entrance with one ambient decorative loop       |
| Intro/quote                   | Reset pace and frame the invitation voice       | Fade/reveal through the shared observer path                                                             | Fade-up, soft crossfade, no-motion                                                       | Kinetic typography, long quote stagger, masked text that starts unreadable                              | Subtle reveal                                             |
| Family                        | Present names and relationships with dignity    | In-view group and item sequencing; large content height on mobile                                        | Group reveal with short CSS stagger; static formal variant                               | Per-name observer, playful bounce, continuous ornaments                                                 | Editorial stagger lasting no more than one short sequence |
| Countdown                     | Create anticipation and communicate time        | Reveal plus hoverable units; Abril reduced-motion hover currently fails                                  | Static numbers with fade, restrained unit stagger, immediate non-transform hover         | Flips, ticking transforms, perpetual pulsing, reduced-mode lift                                         | Subtle reveal; no continuous unit motion                  |
| Event information / itinerary | Explain schedule clearly                        | Celestial structure is reused by Abril and retinted; timeline rows reveal                                | `timeline-paper`, `timeline-line`, `schedule-cards`; behavior IDs independent of palette | Theme-named structural APIs, observers per row, motion that delays scanning                             | Editorial container reveal with short row stagger         |
| Locations                     | Support decisions and map actions               | Card reveals plus lift/tilt; both fail reduced-motion hover checks                                       | `location-cards`, `location-editorial`, immediate border/shadow feedback                 | 3D tilt under reduced motion, map-like parallax, motion on primary links                                | Subtle lift for no-preference users only                  |
| Gallery                       | Deliver the strongest visual memory             | Celestial mosaic; Abril two-column/editorial feature; both lightboxes work                               | Role-based layouts (`feature`, `portrait`, `supporting`), fade/scale-once, shared dialog | Theme-only layout names, revealing every image independently on long galleries, autoplay carousel       | Editorial mosaic plus one-time bounded reveal             |
| Personalized access           | Confirm guest context                           | Present in Celestial public demo, absent in audited Abril context; observed reveal                       | Static card, subtle confirm reveal                                                       | Celebration bursts on load, motion before identity is known                                             | Subtle                                                    |
| RSVP                          | Convert intention to response                   | Celestial interactive React/Framer flow; Abril static locked branch hydrates                             | Server-only locked preview; interactive island with short state transitions              | Hydrating static state, large route-like transitions inside the invitation, repeated celebratory loops  | Subtle interaction motion; one bounded success accent     |
| Gifts                         | Clarify optional contribution                   | In-view reveal and card treatments                                                                       | Static editorial list, small group stagger                                               | Attention-seeking pulse, animated monetary controls                                                     | Subtle                                                    |
| Interludes                    | Create pacing and visual breath                 | Celestial uses four full-height intervals; Abril uses two overlapped intervals                           | Neutral, `overlap`, `atmospheric-blend`; ambient scale under no-preference               | Scroll-linked parallax in this phase, required text over unstable imagery, too many full-height breaks  | Editorial boundary plus subtle ambient media              |
| Thank-you / closing           | Resolve the narrative                           | Shared reveal, themed decoration, static message                                                         | Soft reveal, atmospheric blend from preceding section                                    | New high-energy animation after RSVP, infinite CTA pulse                                                | Subtle closure                                            |
| Section intersections         | Make the page feel composed rather than stacked | Abril proves arch/overlap/blend; Celestial stays neutral                                                 | Explicit `neutral`, `arch`, `overlap`, `atmospheric-blend` metadata/classes              | Screenshot-order selectors as the reusable API, random boundary changes, masks on every section         | One editorial intersection per narrative pivot            |

## Reusable variant and utility recommendation

### Retain

- The SSR-visible / enhance-after-registration reveal contract.
- `has-motion` and `is-visible` as the stable state vocabulary, unless a migration can preserve all
  tests and fail-open behavior.
- Semantic duration/easing/distance tokens.
- CSS-driven item staggering.
- The three approved intersection families and neutral default.
- Theme tokens for palette, type, texture, overlay strength, focal point, and intensity.
- The accessible gallery dialog behavior.
- Framer Motion where React state transitions materially benefit from it.

### Consolidate

- Repeated section observer setup into an observer pool/coordinator.
- Reduced-motion overrides into a final, stable accessibility layer.
- Repeated reveal selectors into a small recipe set: fade, fade-up, media-scale, stagger-group.
- Arch, overlap, and blend mechanics into reusable primitives with custom properties.
- Hero timing into named roles and a bounded sequence.
- Gallery layout behavior into role-based variants independent of the theme palette.

### Replace

- Theme preset names used as structural/effect variant IDs.
- Cross-theme imports whose names conceal the actual behavior being reused.
- Slug/screenshot-order selectors as the public intersection mechanism.
- Static locked RSVP rendering inside the hydrated interactive component.
- Reduced-motion rules that depend on classes intentionally absent in reduced mode.
- “Parallax” wording for a non-parallax ambient effect.

### Do not introduce

- A second animation library.
- JavaScript scroll loops, continuous `scroll` handlers, or motion tied to raw scroll position.
- Tailwind or another styling system.
- Per-invitation duplicated keyframes when a tokenized recipe is sufficient.
- Animation required to discover content or complete an action.

## Recommended visual intensity model

Use intensity as a content decision, not a theme synonym:

| Level       | Allowed behavior                                                          | Typical use                                 |
| ----------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| `none`      | Immediate final state; non-transform interactive feedback                 | Reduced motion and utility-first contexts   |
| `subtle`    | One short opacity/position reveal or immediate hover feedback             | Quote, countdown, locations, gifts, closing |
| `editorial` | Bounded stagger, one media entrance, one compositional boundary treatment | Hero, gallery, itinerary, interlude pivot   |
| `ambient`   | Slow decorative loop with no semantic content, only under `no-preference` | Hero light, interlude image drift           |

No “spectacle” level is recommended as a reusable invitation-system capability. A one-off campaign
could justify it separately, but it should not enter the base invitation contract.

## Risks and decisions to make before implementation

1. **Authority decision:** approve one timing budget by motion category and decide whether a
   1.6-second standard reveal is intentional or should be narrowed.
2. **Schema decision:** decide whether intersection metadata belongs in content, the render plan, or
   profile configuration. Prefer render-plan metadata with content-safe defaults; do not infer from
   slug equality.
3. **Compatibility decision:** define a deprecation path for theme-named section variants before
   renaming live JSON values.
4. **Accessibility decision:** choose whether reduced motion permits opacity crossfades. The safest
   default is immediate state for direct interactions and near-instant opacity for entrances.
5. **RSVP boundary decision:** confirm which resolved RSVP modes are genuinely interactive before
   moving the locked branch to Astro.
6. **Interlude decision:** decide whether Celestial needs all four full-height interludes. This is
   an art-direction/content choice, not a motion-system requirement.
7. **Performance decision:** establish production bundle and Web Vitals baselines before claiming
   savings from the RSVP split or observer consolidation.
8. **Migration decision:** keep Abril visually stable while replacing selectors underneath it; use
   screenshot comparison rather than redesigning during extraction.

## Concrete implementation scope

### Checkpoint 1 — Align authority

Likely files:

- `docs/domains/theme/motion.md`
- `.agent/skills/animation-motion/SKILL.md`
- `docs/domains/theme/section-intersections.md`
- `docs/domains/theme/gallery-variants.md`

Deliverable: one normative taxonomy for entrance, reveal, interaction, ambient motion, intersection,
and reduced mode; historical reports remain historical.

### Checkpoint 2 — Fix reduced motion first

Likely files:

- Base location/countdown invitation SCSS
- Celestial section/preset SCSS
- `src/styles/invitation-profiles/abril-michelle-becerra-rea.scss`
- Focused browser or end-to-end accessibility tests

Deliverable: no transform, transition, or ambient animation survives reduced motion on audited
interactive elements; focus and color feedback remain clear.

### Checkpoint 3 — Consolidate reveal infrastructure

Likely files:

- `src/utils/animations.ts`
- Section scripts in Quote, PersonalizedAccess, Family, Countdown, EventLocation, Interlude,
  ItineraryProgram/TimelineList, PhotoGallery, Gifts, and ThankYou
- `src/styles/global/_animations.scss`
- Unit tests for observer success, failure, timeout, reduced motion, and multiple option signatures

Deliverable: one observer pool/coordinator with the existing SSR-visible and fail-open guarantees.

### Checkpoint 4 — Extract effect and intersection primitives

Likely files:

- Theme contract/schema definitions
- Shared invitation intersection/reveal SCSS
- Theme bundle entry points
- `src/styles/invitation-profiles/abril-michelle-becerra-rea.scss`
- `src/styles/invitation-sections-by-preset/celestial-blue.scss`
- Both case-study JSON files only if explicit metadata is approved

Deliverable: behavior-named variants, explicit boundary metadata, reusable
neutral/arch/overlap/blend mechanics, and visual parity for Abril. Celestial receives no more than
two intentional intersection treatments.

### Checkpoint 5 — Correct the RSVP client boundary

Likely files:

- `src/components/invitation/InvitationSections.astro`
- `src/components/invitation/RSVP.tsx`
- A new server-rendered locked-preview Astro component, if extraction is approved
- RSVP unit and browser tests

Deliverable: locked public RSVP is server-only; interactive modes retain lazy hydration and
accessible state transitions.

### Checkpoint 6 — Verify the complete story

Required verification:

- Mobile widths 320, 360, 390, and 430 pixels plus desktop 1440 pixels for intersections.
- Ordinary and reduced motion computed-style assertions.
- JavaScript-disabled content readability.
- Keyboard gallery and RSVP flows.
- No horizontal overflow beyond the existing one-pixel tolerance, with a goal of zero.
- Console-clean scroll through every section.
- Production build/chunk comparison, not development-server module sizes.
- Screenshot comparison for both case studies at stable section landmarks.
- Unit coverage for observer pooling and fail-open behavior.

## Implementation acceptance criteria

The implementation goal is complete when:

- Active motion guidance has one non-contradictory authority and named timing categories.
- Every section is readable in SSR/no-JavaScript mode and observation failure remains fail-open.
- Reduced motion eliminates location/countdown transforms, hero/interlude loops, and transition lag.
- The two pages use a shared observer mechanism with demonstrably fewer observer instances.
- Intersection variants are behavior-named and do not depend on screenshot order as their reusable
  API.
- Abril retains its current art direction; Celestial gains only deliberately approved transitions.
- Static locked RSVP does not hydrate; interactive RSVP still works when visible.
- Both galleries remain keyboard-accessible and focus-managed.
- Mobile and desktop checks remain console-clean, stable, and free of visible horizontal overflow.
- No new animation dependency is introduced.

## Final disposition

The system should be **consolidated and corrected**, not replaced. The strongest assets are the
progressive-enhancement reveal contract, the approved intersection vocabulary, the theme token
model, and the two complementary case studies. The highest-priority work is documentation authority
alignment and the reduced-motion bug. Observer pooling, behavioral variant naming, reusable
intersections, and RSVP boundary cleanup then turn existing proofs into a maintainable system.
