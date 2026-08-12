# Invitation Section Intersection System

**Status:** Canonical theme-domain guidance

**Owns:** Visual and implementation rules for transitions between adjacent invitation sections.

**Related authority:** [`architecture.md`](architecture.md) owns theme tokens, presets, section
styles, and runtime CSS boundaries. This document does not redefine those contracts.

## Purpose

Section intersections can make an invitation read as one continuous editorial composition while
preserving clear section boundaries. They are hierarchy tools, not a requirement to decorate every
transition.

This system distills the approved Abril direction into reusable guidance. The reusable closed set
contains a neutral default and three primary patterns:

1. Neutral
2. Editorial arch
3. Layered overlap
4. Atmospheric blend

A discontinuous champagne or golden thread may appear as a secondary detail. It must never become a
continuous divider running through the full invitation.

## Restraint

- Use a geometric treatment at one meaningful boundary, or at most two when the narrative clearly
  benefits.
- Leave some boundaries deliberately neutral. Adjacent sections may share spacing or a compatible
  surface without an added transition.
- Never decorate every section boundary.
- Use one primary pattern at a boundary. A secondary golden thread may support it, but must not
  compete with the section content.
- Prefer depth, color continuity, and reserved whitespace over repeated ornaments.
- Treat Valentina as a lesson in restraint and tokenized depth, not as a source of client-specific
  code to copy.

## Primary Patterns

### Editorial arch

Use an editorial arch when the incoming section should feel as though it rises into the outgoing
composition.

- Keep the arch broad, shallow, and asymmetric.
- Fill it with the incoming surface so the relationship between sections remains clear.
- Reserve enough trailing space in the outgoing section for the arch before positioning it.
- Keep previous-section text, controls, faces, and important image detail outside the arch zone.
- Avoid waves, symmetrical ovals, deep scallops, and polygon clipping copied from another
  invitation.
- Do not let the arch cover previous content or create a false interactive layer.

### Layered overlap

Use a layered overlap only for a selected photograph or decorative element whose narrative role
connects the adjacent sections.

- Reserve the overlap depth statically in layout; negative margins or positioning must consume that
  reserved space rather than create cumulative layout shift.
- Limit overlap ownership to the selected media or decoration. Do not lift an entire content section
  over another section.
- Keep full-bleed media sharp and intact. The overlap must be legible through reserved space,
  surface continuity, or a restrained edge detail rather than a crop, blur, or opaque veil.
- Validate `object-fit`, focal points, and crops at every required viewport.
- Keep faces, captions, controls, and essential content outside the crop-risk and overlap zones.
- Bound shadows and stacking so the element reads as depth, not as a floating card detached from the
  composition.

### Atmospheric blend

Use an atmospheric blend when the adjacent surfaces have a close narrative relationship but a
geometric edge would be too literal.

- Build the transition from asymmetric radial light, color, or restrained texture.
- Match the blend's opening color to the outgoing surface and its ending color to the incoming
  surface.
- Give the blend enough static depth to finish before incoming content begins.
- Prefer one or two purposeful radial layers over an effect stack.
- Do not use a generic linear-gradient seam as a substitute for art direction.
- Keep texture subtle enough that text contrast and image detail remain stable.
- The shared mechanic paints the blend on the wrapper `::before`. Opaque backgrounds on the incoming
  section child cover that layer; if a profile needs the blend to read over a photo exit (for
  example with a shallow negative-margin overlap keyed by `data-intersection-source`), paint or open
  the top band on that child locally. Keep the treatment generic to the source attribute — do not
  hard-code a successor section kind.

## Secondary Golden Thread

A champagne, antique-gold, or theme-equivalent thread may connect selected moments:

- Use short, discontinuous segments or a small localized accent.
- Resolve the color through the active semantic or component token contract.
- Keep it secondary to typography, photography, and section hierarchy.
- Do not span every boundary, trace the full page, or imply that every section has equal narrative
  weight.

## Selection Matrix

| Adjacent condition                                                               | Preferred choice                             | Decision rule                                                                                                             |
| -------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Strong light-to-dark or dark-to-light surface change with a narrative turn       | Editorial arch                               | Use only when the incoming plane should visibly enter the outgoing composition and reserved space protects prior content. |
| A selected photo or decorative asset directly connects both sections             | Layered overlap                              | Use only when crop safety, static space reservation, and bounded stacking can be proven.                                  |
| Related surfaces or moods need continuity without a literal edge                 | Atmospheric blend                            | Match outgoing and incoming colors with asymmetric radial light or texture, then end the blend before content begins.     |
| Dense text, forms, maps, controls, or uncertain content height near the boundary | Neutral boundary                             | Preserve spacing and contrast; do not introduce a transition zone that can collide with content.                          |
| Low contrast between adjacent surfaces                                           | Neutral boundary or subtle atmospheric blend | Add a blend only when it clarifies hierarchy; otherwise use spacing and tokenized surface depth.                          |
| Both sections already contain strong photography or decoration                   | Neutral boundary                             | Avoid competing focal points and visual stacking.                                                                         |

Choose the treatment in this order:

1. Identify the outgoing and incoming surfaces, contrast, content density, and narrative
   relationship.
2. Mark content-safe zones, photographic focal points, and the maximum static transition depth.
3. Default to a neutral boundary.
4. Select one primary pattern only when it improves continuity or narrative emphasis.
5. If two adjacent sections cannot protect contrast, crop, or content safety at all proof viewports,
   remove the treatment.

## Composition Cadence

Each profile should classify its boundaries before styling them:

- **Neutral:** information-heavy, functional, or closing sections remain clean and fully spaced.
- **Bridge:** one selected overlap or atmospheric blend connects a related photograph and surface.
- **Climax:** an arch or the final atmospheric transition marks a narrative turn; reserve these for
  one or two moments in the invitation.

Record only the non-neutral mappings in typed `composition.intersections`; the absence of a mapping
is the intentional neutral default. A profile stylesheet may tune the selected treatment with tokens
and must document any non-obvious stacking relationship beside the selector. It must not select the
intersection from client identity. Do not promote a profile cadence to shared code until it has
proven reusable without depending on client identity.

Treat a bridge as a short material handoff, not a new section background: match the adjacent surface
colors, keep the transition zone shallow, and never hide, desaturate, or soften the selected media.

## Accessibility, Performance, and Responsive Constraints

- Keep all essential text, controls, focus indicators, and semantic content outside transition
  zones.
- Preserve required text and control contrast throughout the complete blend or overlap.
- Decorative pseudo-elements, masks, and SVGs must not enter the accessibility tree or intercept
  pointer input.
- A transition must not create horizontal overflow at any supported width.
- Reserve dimensions and overlap depth before media loads; zero cumulative layout shift is the
  target.
- Prefer lightweight SCSS, pseudo-elements, CSS masks, or simple inline SVG. Do not add JavaScript
  choreography solely for an intersection.
- Use the fewest stacking contexts necessary and document any non-obvious `z-index` relationship in
  the owning stylesheet.
- Treat mobile as the composition baseline. Reduce depth or remove a treatment when the smaller
  canvas cannot preserve content and crop safety.
- Motion is optional and non-essential. Honor `prefers-reduced-motion`; the static intersection must
  communicate the same hierarchy.

## Profile and Shared Ownership

Boundary selection and source relationships belong in the invitation's typed
`composition.intersections` configuration. Client profiles under
`src/styles/invitation-profiles/<slug>.scss` may own exact palette relationships, focal treatment,
decoration, and timing for those selected boundaries, scoped by the invitation's event class.

Shared capabilities must remain generic and configurable:

- Reusable values follow the three-level token architecture.
- Presets expose semantic or public component tokens; they do not own section selectors or layout.
- Selector-aware section behavior belongs in the owning shared section stylesheet or section
  variant, following [`architecture.md`](architecture.md).
- Shared code must not contain slug-specific selectors, screenshot labels, client asset keys, or
  assumptions about one invitation's section order.
- Promote profile behavior into shared theme architecture only after it proves reusable across
  invitations and can be expressed without client identity.

## Render-plan metadata contract

Reusable mechanics are selected before rendering and copied onto stable wrapper attributes:

- `data-intersection`: `neutral`, `arch`, `overlap`, or `atmospheric-blend`;
- `data-intersection-source`: explicit source identity from the selected composition profile;
- `data-section-kind`: stable incoming section kind.

Selection is owned by typed `composition.intersections` (with legacy profile injection only at the
variant-normalization boundary) and copied through the render plan. CSS must not infer a family from
route slug, JSON order, screenshot order, `nth-*`, incidental adjacency, or a theme name. Profiles
may set visual tokens against these stable attributes; shared mechanics live in
`src/styles/invitation/_section-intersections.scss`.

Current explicit mappings:

- Abril retains its two interlude overlaps, gallery → RSVP arch, and atmospheric blends through
  content-owned `composition.intersections` (plus invitation profile visual tokens).
- Celestial uses two photographic bridges (family → tiara and itinerary → lantern), a soft detail →
  gallery blend, the location → architecture arch, and the RSVP → tul atmospheric finale. Its
  remaining boundaries are intentionally neutral.

## Required Proof

Review every implemented intersection at all five repository viewports:

| Viewport   | Required evidence                                                            |
| ---------- | ---------------------------------------------------------------------------- |
| `320×800`  | Narrow-mobile crop, content clearance, and no horizontal overflow            |
| `360×800`  | Mobile crop, content clearance, focus visibility, and no horizontal overflow |
| `390×844`  | Primary mobile composition and complete transition depth                     |
| `430×932`  | Wide-mobile spacing, media focal safety, and stacking behavior               |
| `1440×900` | Desktop scale, restraint, and bounded transition depth                       |

Capture full-page screenshots at `390×844` and `1440×900`. Use the remaining three viewports for
focused visual evidence. At every viewport, check:

- no horizontal overflow;
- no content, control, focus-ring, or image-subject collision;
- no layout shift caused by the treatment;
- incoming and outgoing colors resolve cleanly;
- deliberately neutral boundaries remain visually intentional;
- reduced-motion mode preserves the static composition.

## Acceptance Checklist

- [ ] The boundary has a clear narrative purpose; neutral was considered first.
- [ ] No more than three primary pattern types exist in the invitation.
- [ ] Geometric treatments appear at no more than two meaningful boundaries.
- [ ] Some boundaries remain deliberately neutral.
- [ ] The selected pattern follows its geometry, crop, and content-safety rules.
- [ ] Any golden thread is short, discontinuous, tokenized, and secondary.
- [ ] Essential content remains outside transition zones with valid contrast and focus visibility.
- [ ] Space is reserved statically, with no horizontal overflow or cumulative layout shift.
- [ ] Motion is optional, reduced-motion safe, and not required to understand the boundary.
- [ ] Client composition stays in profile SCSS; shared capabilities remain generic and configurable.
- [ ] The five-viewport proof and full-page mobile/desktop screenshots pass.
