# Romina Ríos Chaparro — Canonical Variant Reference

**Status:** Canonical encapsulation reference

**Historical record:**
[`romina-rios-chaparro-finalization.md`](romina-rios-chaparro-finalization.md)

Romina is the approved reference used to prove the reusable `split-cover` Hero architecture. Her
invitation is a consumer of that architecture, not its owner. No reusable identifier, renderer,
stylesheet, primitive, or asset path may contain her name, slug, profile ID, or historical origin.

## Explicit canonical configuration

- `hero.variant: 'split-cover'`
- `location.variant: 'standard'`
- `itinerary.variant: 'standard'`
- `gallery.variant: 'editorial-mosaic'`
- Remaining participating sections select their section-owned variants explicitly.
- `composition.intersections` is explicitly present; neutral boundaries do not rely on an
  identity-keyed render-plan map.

The Gallery layout is explicit to preserve the approved Premiere Floral mosaic after structural CSS
was removed from the theme bundle. This is contract wiring, not a redesign.

## Ownership boundary

`_split-cover.scss` owns the two-plane desktop layout, responsive behavior, image containment,
required title/details geometry, and reusable defaults. The Romina profile may set only her palette,
typography, crop, overlay, decoration, timing, and documented `--hero-split-*` presentation tokens.
It does not import the variant stylesheet or redefine the canonical grid, visibility, DOM order, or
breakpoints.

Romina's photographs remain owned by her managed definition and asset map. The Hero receives a
resolved semantic `backgroundImage`; the variant imports no invitation assets. Desktop and mobile
hero paths use distinct uploaded keys (`hero` / `hero-mobile`) encoded from the same source
photograph (`IMG_3263.jpeg`) so each path meets its delivery-role budget.

## Encapsulation evidence

- A non-origin Jewelry Box fixture selects `split-cover` in memory and propagates it through the
  adapter and render descriptor without Romina slug, profile, or assets.
- Browser portability checks apply the canonical stylesheet to that non-origin demo at mobile and
  desktop sizes and assert no Romina profile stylesheet is loaded.
- Reusable renderer/CSS governance scans reject client names, invitation slugs, historical theme
  identities, profile references, and invitation asset imports.
- The obsolete Romina condition in `GoogleMap.astro` was removed after a zero-consumer source
  search. Romina's maps retain the generic `premiere-floral` visual path; Location browser smoke
  remains a required verification because the shared primitive changed.

No database, Preview, Production, client copy, event facts, or photographic assets are changed by
this encapsulation.
