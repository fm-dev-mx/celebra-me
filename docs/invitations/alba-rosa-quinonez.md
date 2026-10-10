# Alba Rosa Quiñónez López — Delivered State

The 70th birthday took place on 2026-09-12. This record keeps only the delivered state; preparation
notes, photo-role audits, and refinement records live in Git history.

## Identity

| Parameter            | Value                                      |
| -------------------- | ------------------------------------------ |
| **Slug**             | `alba-rosa-quinonez`                       |
| **Route**            | `/cumple/alba-rosa-quinonez`               |
| **Event Type**       | `cumple`                                   |
| **Host Login Alias** | `alba_quinonez`                            |
| **Event start**      | `2026-09-12T20:00` (`America/Mexico_City`) |

## Preset and variants

- Theme preset `luxury-hacienda`; visual profile `alba-rosa-quinonez` (frozen by digest); legacy
  `baseDemoId` `demo-cumple-luxury-hacienda`.
- Variants: hero `standard`, location `split-map`, countdown `standard`, gallery `feature-stack`,
  gifts `standard` (legend only), RSVP `standard` with personalized access `ornamented`, family
  `standard`, thank-you `standard`.

## Delivered state

- Managed definition `scripts/provision/invitations/alba-rosa-quinonez.ts`, `lifecycle: published`,
  `deliveryScope: content-and-assets`. Contract test:
  `tests/content/alba-rosa-quinonez-payload.test.ts` (content golden for the Spanish copy).
- Release assets under `src/assets/invitations/alba-rosa-quinonez/`.
- RSVP `accessMode: hybrid`, `confirmationMode: api`, `guestCap: 6`.
- Per-environment state comes from `pnpm dbs alba-rosa-quinonez`; this record asserts none.

## Known constraints

- Several assigned photographs came from provisional (WhatsApp-class) sources; preparation never
  reached production-ready assets.
- Music and itinerary were intentionally omitted.
- Leaving release planning requires an owner `archive` record in the definition.
