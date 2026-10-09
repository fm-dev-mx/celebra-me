# Romina Ríos Chaparro — Delivered State

The event took place on 2026-08-14. This record keeps only the delivered state and the variant
reference role; earlier notes live in Git history.

## Identity

| Parameter            | Value                                    |
| -------------------- | ---------------------------------------- |
| **Slug**             | `romina-rios-chaparro`                   |
| **Route**            | `/xv/romina-rios-chaparro`               |
| **Event Type**       | `xv`                                     |
| **Host Login Alias** | `romina_rios_chaparro` (legacy form)     |
| **Event start**      | `2026-08-14T17:00` (`America/Chihuahua`) |

## Preset and variants

- Theme preset `premiere-floral`; visual profile `romina-rios-chaparro` (frozen by digest); legacy
  `baseDemoId` `demo-xv-premiere-floral` (catalog-only).
- Variants: hero `split-cover`, family `standard`, countdown `standard`, location `standard`,
  itinerary `standard`, gallery `editorial-mosaic`, RSVP `standard` with personalized access
  `ornamented`, thank-you `standard`. `composition.intersections` is explicit.

## Variant reference role

Romina is the approved reference used to prove the reusable `split-cover` hero. Her invitation is a
consumer of that variant, not its owner: no reusable identifier, renderer, stylesheet, or asset path
may contain her name, slug, or profile ID. `_split-cover.scss` owns the layout; the profile supplies
only palette, crop, and documented `--hero-split-*` tokens. Portability is proven on a non-origin
fixture without her profile or assets ([variant system](../domains/theme/variant-system.md)).

## Delivered state

- Managed definition `scripts/provision/invitations/romina-rios-chaparro.ts`,
  `lifecycle: published`, `deliveryScope: content-and-assets`. Contract tests:
  `tests/content/romina-local-invitation.test.ts` and
  `tests/content/romina-family-rendering.test.ts`.
- RSVP `accessMode: personalized-only`, `confirmationMode: api`, `guestCap: 4`.
- Per-environment state comes from `pnpm dbs romina-rios-chaparro`; this record asserts none.

## Known constraints

- Desktop and mobile hero use distinct uploaded keys (`hero` / `hero-mobile`) encoded from one
  source photograph; focals `50% 42%` (mobile/tablet) and `58% 46%` (desktop).
- Ceremony and reception coordinates are inferred, not client-stated.
- Leaving release planning requires an owner `archive` record in the definition.
