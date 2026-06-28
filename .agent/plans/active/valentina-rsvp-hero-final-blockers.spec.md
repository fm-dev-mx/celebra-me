# Spec: Valentina — RSVP mobile crowding & Hero intermediate breakpoints

## Current visual problems

1. **RSVP mobile crowding (Blocker 1)**: The editorial-magazine RSVP card uses large radio-card
   padding (1.1rem 1.2rem, min-height 4.75rem), generous form gap, and a tall response-heading
   banner. At 390px viewport width these accumulate into dense, hard-to-scan content with weak
   hierarchy.

2. **Redundant WhatsApp confirmation CTA (Blocker 2)**: The post-submission success state shows
   "Confirmar por WhatsApp" (`rsvp__contact-host`) because the Valentina payload has
   `confirmationMode: "both"`. Since the invitation itself is distributed via WhatsApp, this CTA is
   redundant for this event.

3. **Hero intermediate breakpoints (Blocker 3)**: The hero has two layouts — desktop grid (≥992px)
   and mobile full-bleed (≤767px). Between 768px and 991px neither applies cleanly, causing:
   portrait too small relative to canvas, background + foreground competing, microtext hard to read,
   and a squeezed desktop-spread feel at ~779px and ~989px.

## Scope

- `src/styles/themes/sections/_xv-valentina-hernandez.scss` — all three blockers
- No shared-component markup changes unless CSS is insufficient (it is not)
- No global theme/preset regression

## Non-goals

- Do not change the base editorial-magazine hero or RSVP styles
- Do not add new component props or new render-plan branching
- Do not modify the Valentina production data payload
- Do not remove the WhatsApp CTA globally
- Do not add Tailwind, new CSS frameworks, or JS-based responsive hooks
- Do not add interactive behaviours (scroll-triggered, intersection observer)

## Acceptance criteria

1. **390px mobile** — RSVP is readable, less crowded, clearly actionable in ~3 scrolls
2. **390px mobile** — submit button is visually dominant; not buried under decoration
3. **Valentina only** — success state has no WhatsApp confirmation button
4. **~779px and ~989px** — hero no longer feels broken, empty, or unbalanced
5. **~779px and ~989px** — foreground portrait is large enough to be the clear focal point
6. No global regression to the `editorial-magazine` preset
7. `pnpm build` passes
8. `pnpm agent:git-safety:check` passes before final report

## Files inspected

- `src/styles/themes/sections/_xv-valentina-hernandez.scss`
- `src/styles/themes/sections/rsvp/_editorial-magazine.scss`
- `src/styles/themes/sections/hero/_editorial-magazine.scss`
- `src/styles/invitation/_rsvp.scss`
- `src/styles/invitation-sections/hero/editorial-magazine.scss` (re-export)
- `src/components/invitation/RSVP.tsx`
- `src/components/invitation/RSVPComponents.tsx`
- `src/components/invitation/InvitationSections.astro`
- `src/lib/invitation/section-render-data.ts`
- `src/lib/invitation/render-plan.ts`
- `src/lib/invitation/page-data.ts`
- `src/lib/adapters/event.ts`
- `src/styles/global/_mixins.scss`
- `src/styles/tokens/_spacing.scss`
- `.agent/plans/active/xv-valentina-hernandez-db-payload.json`

## Files changed

- `src/styles/themes/sections/_xv-valentina-hernandez.scss`

## Implementation plan

### Blocker 1 — RSVP mobile crowding

Inside `.rsvp[data-variant='editorial-magazine']` block in Valentina SCSS, add:

```scss
@media (width <= 640px) {
  .rsvp__form {
    gap: 0.85rem;
  }
  .rsvp__response-heading {
    padding: 0.55rem 0;
    font-size: 0.6rem;
  }
  .rsvp__radio-card {
    min-height: 3.8rem;
    padding: 0.85rem 1rem;
  }
  .rsvp__radio-group {
    gap: 0.6rem;
  }
  input[type='text'],
  input[type='tel'],
  input[type='number'],
  textarea,
  select {
    min-height: 2.6rem;
  }
  .rsvp__button {
    min-height: 3rem;
  }
}
```

Rationale: reduces each unit of vertical space while keeping tap targets ≥ 44px. The title size is
already handled by the base `_editorial-magazine.scss` at ≤640px.

### Blocker 2 — Remove WhatsApp CTA

Inside `.rsvp[data-variant='editorial-magazine']` block, add:

```scss
.rsvp__contact-host {
  display: none;
}
```

Rationale: Valentina-scoped CSS rule, no shared markup or logic changes. The `showWhatsAppCta`
boolean will still be `true` but the rendered div is hidden. Since the sibling elements ("Agregar al
calendario" and "Cambiar mi respuesta") render independently, this has no layout side effects.

### Blocker 3 — Hero intermediate breakpoints

**Strategy**: Extend the mobile full-bleed composition from `respond-below(md)` (≤767px) to
`respond-below(lg)` (≤991px) so the tablet gap is eliminated. Add a tablet-specific sub-breakpoint
for refinements at 768–991px where the wider canvas needs larger text and adjusted background focal
point.

Changes:

1. At line 490, change `@include mixins.respond-below(md)` to `@include mixins.respond-below(lg)`.

2. Inside the same block, add a `@media (width >= 768px)` nested scope to tune the tablet
   experience:
   - Slightly larger first-name / last-name text
   - Wider title wrapper (`max-width: min(100%, 28rem)`)
   - Adjusted background `object-position` for landscape-friendly crop
   - Reduce background overlay gradient intensity
   - Increase metadata size for readability at the larger distance
   - Show the deck text at slightly larger size

3. The `respond-below(lg)` block (lines 451–488) will be partially overridden by the composition,
   but folio-header colours and other non-overridden items remain intact due to source order.

## Validation plan

1. `pnpm agent:git-safety:check`
2. `pnpm build`
3. Manual inspection at 390px, 779px, 989px, and 1200px (dev tools)
4. Confirm WhatsApp CTA is absent in Valentina success state
5. `git status --short`

## Rollback notes

- All changes are in one file (`_xv-valentina-hernandez.scss`).
- Revert with `git checkout -- src/styles/themes/sections/_xv-valentina-hernandez.scss`.
- The hero breakpoint change (respond-below(md) → respond-below(lg)) is the highest-impact change —
  verify at 991px before deploying.
