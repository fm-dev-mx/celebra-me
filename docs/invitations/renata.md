# Renata — Delivered State

The event took place on 2026-09-05. This record keeps only the delivered state; preparation notes,
photo inventory, and review passes live in Git history.

## Identity

| Parameter            | Value                                   |
| -------------------- | --------------------------------------- |
| **Slug**             | `renata`                                |
| **Route**            | `/xv/renata`                            |
| **Event Type**       | `xv`                                    |
| **Host Login Alias** | `renata` (no surname was supplied)      |
| **Event start**      | `2026-09-05T19:00` (`America/Mazatlan`) |

**Preparation Readiness (prepReadiness):** `NOT_READY`

Preparation never closed: the client did not supply the RSVP confirmation mode or guest cap, so the
delivered RSVP is a presentation shell without `confirmationMode`, `accessMode`, or `guestCap`.

## Fact Register

| field                | value | classification | notes                     |
| -------------------- | ----- | -------------- | ------------------------- |
| rsvpConfirmationMode | —     | missing        | Never supplied; not built |
| rsvpGuestCap         | —     | missing        | Never supplied; not built |

## Preset and variants

- Theme preset `editorial`; visual profile `renata` (frozen by digest); legacy `baseDemoId`
  `demo-xv-editorial`.
- Envelope `variant: premiere-floral` with a monogram seal.
- Variants: hero `standard`, family `asymmetric-groups`, countdown `standard`, location
  `stacked-venue-plates` (canonical `venues[]`, navigation buttons hidden), itinerary
  `editorial-program`, gifts `standard`, gallery `feature-stack`, RSVP `formal-register` with
  personalized access `formal-pass`, thank-you `full-bleed-photo`.

## Delivered state

- Managed definition `scripts/provision/invitations/renata.ts`, `lifecycle: published`,
  `deliveryScope: content-and-assets`. Contract test: `tests/content/renata-payload.test.ts`.
- Seven release keys keep the published originals (`<key>-published.webp`) that the owner confirmed
  on 2026-09-13, instead of recompressed preparation derivatives.
- Per-environment state comes from `pnpm dbs renata`; this record asserts none.

## Known constraints

- The parish name is inferred from the Maps page title; the address is client-stated.
- Leaving release planning requires an owner `archive` record in the definition.
