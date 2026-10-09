# Leslie — Delivered State

The event took place on 2026-09-26. This record keeps only the delivered state; preparation notes,
handoffs, and review criteria live in Git history.

## Identity

| Parameter            | Value                                    |
| -------------------- | ---------------------------------------- |
| **Slug**             | `leslie-perez`                           |
| **Route**            | `/xv/leslie-perez`                       |
| **Event Type**       | `xv`                                     |
| **Host Login Alias** | `leslie_perez`                           |
| **Event start**      | `2026-09-26T19:00` (`America/Monterrey`) |

## Preset and variants

- Theme preset `celestial-blue`; visual profile `leslie-perez` (frozen by digest); legacy
  `baseDemoId` `demo-xv-celestial-blue`.
- Variants: hero `split-cover`, family `asymmetric-groups`, countdown `editorial-folio`, location
  `split-map`, itinerary `standard`, gallery `index-choreography`, gifts `standard`, RSVP
  `formal-register` with personalized access `formal-pass`, thank-you `full-bleed-photo`.

## Delivered state

- Managed definition `scripts/provision/invitations/leslie-perez.ts`, `lifecycle: published`,
  `deliveryScope: content-and-assets`. Contract tests: `tests/content/leslie-perez-payload.test.ts`
  and `tests/content/leslie-image-budgets.test.ts`.
- Assets under `src/assets/invitations/leslie-perez/` keep the original 01–15 order; release inputs
  are the `delivery/` derivatives plus `delivery/01-mobile.webp` for the mobile hero.
- RSVP `accessMode: personalized-only`, `confirmationMode: api`, `guestCap: 1`.
- Per-environment state comes from `pnpm dbs leslie-perez`; this record asserts none.

## Known constraints

- Ceremony and godparents were intentionally omitted; there is no song URL.
- Leaving release planning requires an owner `archive` record in the definition.
