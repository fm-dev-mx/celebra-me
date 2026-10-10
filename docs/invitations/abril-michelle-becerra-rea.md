# Abril Michelle Becerra Rea — Delivered State

The event took place on 2026-09-12. This record keeps only the delivered state; the earlier
changelog, two-lane spec, and QA snapshots live in Git history.

## Identity

| Parameter            | Value                                      |
| -------------------- | ------------------------------------------ |
| **Slug**             | `abril-michelle-becerra-rea`               |
| **Route**            | `/xv/abril-michelle-becerra-rea`           |
| **Event Type**       | `xv`                                       |
| **Host Login Alias** | `abril_becerra`                            |
| **Event start**      | `2026-09-12T15:00` (`America/Mexico_City`) |

## Preset and variants

- Theme preset `premiere-floral`; visual profile `abril-michelle-becerra-rea` (frozen by digest);
  legacy `baseDemoId` `demo-xv-premiere-floral` (catalog-only).
- Variants: hero `standard`, family `standard`, countdown `standard`, location `standard`, itinerary
  `timeline-paper`, gallery `paired-feature-band`, RSVP `standard` with personalized access
  `ornamented`, thank-you `standard`.

## Delivered state

- Managed definition `scripts/provision/invitations/abril-michelle-becerra-rea.ts`,
  `lifecycle: published`, `deliveryScope: content-and-assets`. Contract test:
  `tests/content/abril-local-invitation.test.ts`.
- RSVP `accessMode: personalized-only`, `confirmationMode: api`, `guestCap: 4`.
- Per-environment state comes from `pnpm dbs abril-michelle-becerra-rea`; this record asserts none.

## Known constraints

- The reception street spelling (`Macedio` vs `Macedonio Ayala`) was never confirmed by the client.
- The venue preview is the in-house `StaticVenueMap` illustration; no map tiles are loaded.
- `clientEmail` and `clientWhatsapp` are empty in the definition.
- Leaving release planning requires an owner `archive` record in the definition.
