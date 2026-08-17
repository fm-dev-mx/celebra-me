# Celestial-blue section-bundle inventory

**Date:** 2026-08-17  
**Bundle:** [`src/styles/invitation-sections-by-preset/celestial-blue.scss`](../../src/styles/invitation-sections-by-preset/celestial-blue.scss)  
**Ownership
contract:** [`architecture.md`](architecture.md#invitation-css-ownership-normative)  
**Full identity map:** [`corpus-bundle-inventory.md`](corpus-bundle-inventory.md)

## Consumers (all)

`leslie-perez`, `america-johana`, `xareni-iyarit`, `leah-lexa`, `ana-sofia-cota-guillen`,
`demo-xv-celestial-blue`, `demo-xv-xareni-profile`, `demo-baby-shower-celestial`.

## Classification

### `theme-base/celestial-blue` — atmosphere-token

Merged into preset; removed from bundle.

### `header/celestial-blue` — atmosphere-token (+ minor component paint)

Keep as preset-scoped component-token module.

### `countdown/celestial-blue` — mixed

Surface on `--countdown-section-*`. Selector geometry remains until semantic `standard` consumption
is generalized.

### `hero/celestial-blue` — mixed

Section surface on `--hero-section-*`. Layout/geometry on `data-variant='standard'` remains in the
section module.

### `gallery/celestial-blue` — layout/skin (+ token remap)

Keepsake presentation geometry; surfaces consume `--gallery-section-bg` where applicable.

### `rsvp/celestial-blue` — mixed

Root surface on `--rsvp-section-*`. Field/button skins remain in the module.

### `personalized-access/celestial-blue` — mixed

Section wash on `--pa-section-background`. Card geometry remains.

### `thank-you/celestial-blue` — mixed

Section surface/padding/color on `--thank-you-section-*`. Editorial grid remains.

### `gifts/elegant` — layout/skin (shared name)

Shared gifts skin; not celestial-exclusive.

### `reveal/shared-light` — shared primitive

Keep.

## Profile follow-up

- `xareni-iyarit`: gallery / RSVP / thank-you / hero / PA remapped onto section surface tokens;
  countdown already on `--countdown-section-*`.
- `leslie-perez`: rhythm/intersection only (no section LAYOUT paint).
- `america-johana` / `leah-lexa` / `demo-xv-celestial-blue`: client LAYOUT retained until
  `screenshot:css-parity` baselines exist for those slugs.
