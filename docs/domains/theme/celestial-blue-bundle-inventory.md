# Celestial-blue section-bundle inventory (pilot)

**Date:** 2026-08-17  
**Bundle:** [`src/styles/invitation-sections-by-preset/celestial-blue.scss`](../../src/styles/invitation-sections-by-preset/celestial-blue.scss)  
**Ownership
contract:** [`architecture.md`](architecture.md#invitation-css-ownership-normative)

## Classification

### `theme-base/celestial-blue` — atmosphere-token

Single border token. **Merged into preset; removed from bundle.**

### `header/celestial-blue` — atmosphere-token (+ minor component paint)

Public header component tokens. Keep as preset-scoped component-token module.

### `countdown/celestial-blue` — mixed

Surface `background` / `padding-block` / `color` moved to **preset tokens**. Selector geometry
remains until semantic `standard` consumption is generalized.

### `hero/celestial-blue` — layout/skin

Preset-scoped layout on `data-variant='standard'`. Promote only when expressible as tokens or a
semantic variant (not this pilot).

### `gallery/celestial-blue` — layout/skin

Deferred (same as hero).

### `rsvp/celestial-blue` — layout/skin

Deferred.

### `personalized-access/celestial-blue` — layout/skin

Deferred.

### `thank-you/celestial-blue` — layout/skin

Deferred.

### `gifts/elegant` — layout/skin (shared name)

Shared gifts skin; not celestial-exclusive. Deferred.

### `reveal/shared-light` — shared primitive

Keep.

## Dependent profiles

Expected palette/rhythm only: `leslie-perez`, `america-johana`, `xareni-iyarit`, `leah-lexa`,
`demo-xv-celestial-blue`.

### Profile follow-up (this pilot)

- `xareni-iyarit`: countdown surface/color remapped onto `--countdown-section-*` tokens; removed
  direct `background` / `color` paint on `.countdown-section` (border token override retained).
